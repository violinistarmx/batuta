import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, aplicaciones, cargos, ciclos, clases, docentes, inscripciones,
  nominaPartidas, pagos, programas,
} from "@/db/schema/index";
import { costoDeClaseSql, parametrosNomina } from "@/lib/datos/costo-docente";
import { instanteEnMexico } from "@/lib/zona";

/**
 * Reportes de dirección.
 *
 * Todos reciben un rango de fechas civiles y devuelven números que se pueden
 * cuadrar contra las pantallas operativas. Ninguno guarda nada: un reporte que
 * escribe es un reporte que puede mentir cuando alguien lo corre dos veces.
 */

type Rango = { desde: string; hasta: string };

/**
 * Segundos desde epoch, para interpolar dentro de un `sql` en crudo.
 *
 * Dentro de una plantilla `sql` Drizzle no aplica el conversor de la columna, así
 * que un `Date` llega tal cual al driver y revienta: «SQLite3 can only bind
 * numbers, strings, bigints, buffers, and null». Los operadores (`gte`, `lte`) sí
 * lo convierten; las subconsultas escritas a mano necesitan esto.
 */
const epoch = (d: Date) => Math.floor(d.getTime() / 1000);

const enRango = ({ desde, hasta }: Rango) => and(
  gte(clases.iniciaEn, instanteEnMexico(desde, "00:00")),
  lte(clases.iniciaEn, instanteEnMexico(hasta, "23:59")),
);

export type FilaAsistencia = {
  clave: string;
  nombre: string;
  total: number;
  asistio: number;
  falta: number;
  justificada: number;
  cancelada: number;
  programada: number;
};

const CUENTA = {
  total: sql<number>`count(*)`,
  asistio: sql<number>`sum(CASE WHEN clases.estado = 'asistio' THEN 1 ELSE 0 END)`,
  falta: sql<number>`sum(CASE WHEN clases.estado = 'falta' THEN 1 ELSE 0 END)`,
  justificada: sql<number>`sum(CASE WHEN clases.estado = 'falta_justificada' THEN 1 ELSE 0 END)`,
  cancelada: sql<number>`sum(CASE WHEN clases.estado IN ('cancelada','reprogramada') THEN 1 ELSE 0 END)`,
  programada: sql<number>`sum(CASE WHEN clases.estado = 'programada' THEN 1 ELSE 0 END)`,
};

/** Asistencia agrupada por maestro. Responde «¿a quién le faltan?». */
export function asistenciaPorDocente(r: Rango): FilaAsistencia[] {
  return db
    .select({ clave: sql<string>`'d' || docentes.id`, nombre: docentes.nombre, ...CUENTA })
    .from(clases)
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(enRango(r))
    .groupBy(docentes.id, docentes.nombre)
    .orderBy(asc(docentes.nombre))
    .all();
}

/** Asistencia agrupada por programa. Responde «¿qué plan retiene mejor?». */
export function asistenciaPorPrograma(r: Rango): FilaAsistencia[] {
  return db
    .select({ clave: sql<string>`'p' || programas.id`, nombre: programas.nombre, ...CUENTA })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .where(enRango(r))
    .groupBy(programas.id, programas.nombre)
    .orderBy(asc(programas.orden))
    .all();
}

export type FilaOcupacion = {
  docenteId: number;
  docente: string;
  clases: number;
  minutos: number;
  alumnos: number;
  costoCentavos: number;
};

/**
 * Carga real de cada maestro en el rango: horas impartidas y lo que costaron.
 *
 * Solo cuenta lo que genera pago —asistió y falta sin aviso—, que es la misma
 * regla de la nómina. Si contara las canceladas, el costo aquí no cuadraría con
 * lo que se paga y habría dos verdades.
 */
export function ocupacionDocente(r: Rango): FilaOcupacion[] {
  const param = parametrosNomina();
  return db
    .select({
      docenteId: docentes.id,
      docente: docentes.nombre,
      clases: sql<number>`count(*)`,
      minutos: sql<number>`coalesce(sum(clases.minutos), 0)`,
      alumnos: sql<number>`count(DISTINCT inscripciones.alumno_id)`,
      costoCentavos: sql<number>`coalesce(sum(${costoDeClaseSql(
        param.tarifaHoraCentavos, param.factorFaltaSinAviso,
      )}), 0)`,
    })
    .from(clases)
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .where(and(enRango(r), sql`${clases.estado} IN ('asistio','falta')`))
    .groupBy(docentes.id, docentes.nombre)
    .orderBy(desc(sql`sum(clases.minutos)`))
    .all();
}

export type FilaPrograma = {
  programaId: number;
  programa: string;
  inscripciones: number;
  cobradoCentavos: number;
  porCobrarCentavos: number;
  costoDocenteCentavos: number;
};

/**
 * Dinero por programa: cobrado, pendiente y lo que costó impartirlo.
 *
 * El margen se calcula sobre lo COBRADO, no sobre lo facturado. Un programa con
 * $10,000 emitidos y $2,000 cobrados no tiene un margen sano, tiene un problema
 * de cobranza, y el reporte tiene que dejar ver la diferencia.
 */
export function dineroPorPrograma(r: Rango): FilaPrograma[] {
  const param = parametrosNomina();
  return db
    .select({
      programaId: programas.id,
      programa: programas.nombre,
      inscripciones: sql<number>`count(DISTINCT inscripciones.id)`,
      cobradoCentavos: sql<number>`coalesce((
        SELECT sum(ap.monto_centavos)
        FROM aplicaciones ap
        JOIN cargos ca ON ca.id = ap.cargo_id
        JOIN pagos pg ON pg.id = ap.pago_id
        JOIN inscripciones i2 ON i2.id = ca.inscripcion_id
        WHERE i2.programa_id = programas.id
          AND pg.recibido_el >= ${r.desde} AND pg.recibido_el <= ${r.hasta}
      ), 0)`,
      porCobrarCentavos: sql<number>`coalesce((
        SELECT sum(ca.monto_centavos) - coalesce(sum((
          SELECT sum(ap2.monto_centavos) FROM aplicaciones ap2 WHERE ap2.cargo_id = ca.id
        )), 0)
        FROM cargos ca
        JOIN inscripciones i3 ON i3.id = ca.inscripcion_id
        WHERE i3.programa_id = programas.id AND ca.cancelado = 0
      ), 0)`,
      // La subconsulta usa los nombres reales de las tablas, no alias, porque el
      // fragmento de costo los referencia así y dos formas de nombrarlos serían
      // dos formas de equivocarse.
      costoDocenteCentavos: sql<number>`coalesce((
        SELECT sum(${costoDeClaseSql(param.tarifaHoraCentavos, param.factorFaltaSinAviso)})
        FROM clases
        JOIN docentes ON docentes.id = clases.docente_id
        JOIN inscripciones i4 ON i4.id = clases.inscripcion_id
        WHERE i4.programa_id = programas.id
          AND clases.inicia_en >= ${epoch(instanteEnMexico(r.desde, "00:00"))}
          AND clases.inicia_en <= ${epoch(instanteEnMexico(r.hasta, "23:59"))}
      ), 0)`,
    })
    .from(programas)
    .leftJoin(inscripciones, and(
      eq(inscripciones.programaId, programas.id),
      eq(inscripciones.estado, "activa"),
    ))
    .groupBy(programas.id, programas.nombre, programas.orden)
    .orderBy(asc(programas.orden))
    .all();
}

export type Movimiento = {
  altas: number;
  bajas: number;
  activasAlCierre: number;
};

/**
 * Altas y bajas del rango. Es el número de retención, que no aparece en ningún
 * otro lado: la academia puede crecer en alumnos y encogerse en inscripciones.
 */
export function movimientoDeInscripciones(r: Rango): Movimiento {
  const altas = db.select({ n: sql<number>`count(*)` }).from(inscripciones)
    .where(and(gte(inscripciones.fechaInicio, r.desde), lte(inscripciones.fechaInicio, r.hasta)))
    .get()?.n ?? 0;

  const bajas = db.select({ n: sql<number>`count(*)` }).from(inscripciones)
    .where(and(
      sql`${inscripciones.fechaFin} IS NOT NULL`,
      gte(inscripciones.fechaFin, r.desde),
      lte(inscripciones.fechaFin, r.hasta),
    )).get()?.n ?? 0;

  const activasAlCierre = db.select({ n: sql<number>`count(*)` }).from(inscripciones)
    .where(and(
      lte(inscripciones.fechaInicio, r.hasta),
      sql`(${inscripciones.fechaFin} IS NULL OR ${inscripciones.fechaFin} > ${r.hasta})`,
    )).get()?.n ?? 0;

  return { altas, bajas, activasAlCierre };
}

export type FilaAlumnoEnRiesgo = {
  alumnoId: number;
  alumno: string;
  programa: string;
  faltas: number;
  total: number;
};

/**
 * Alumnos con más faltas que asistencias en el rango.
 *
 * Es la señal temprana de una baja. Llamar a tiempo es más barato que reponer al
 * alumno, y es lo único que el sistema puede hacer antes de que avisen las 72 h
 * de la cláusula 12ª.
 */
export function alumnosEnRiesgo(r: Rango, minimoClases = 2): FilaAlumnoEnRiesgo[] {
  return db
    .select({
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      programa: programas.nombre,
      faltas: sql<number>`sum(CASE WHEN clases.estado IN ('falta','falta_justificada') THEN 1 ELSE 0 END)`,
      total: sql<number>`count(*)`,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .where(and(enRango(r), sql`${clases.estado} <> 'programada'`))
    .groupBy(alumnos.id, alumnos.nombre, programas.nombre)
    .having(sql`sum(CASE WHEN clases.estado IN ('falta','falta_justificada') THEN 1 ELSE 0 END) * 2 >= count(*)
                AND count(*) >= ${minimoClases}`)
    .orderBy(desc(sql`sum(CASE WHEN clases.estado IN ('falta','falta_justificada') THEN 1 ELSE 0 END)`))
    .all();
}
