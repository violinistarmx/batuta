import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, alumnosTutores, ciclos, creditosClase, docentes, inscripciones,
  instrumentos, preciosVigencia, programas,
} from "@/db/schema/index";
import { movimientoDeCierre } from "@/lib/dominio/creditos";
import { periodoMensual, sumarDias } from "@/lib/dominio/ciclos";
import {
  cupoRestante, motivoParaRechazarCobertura, precioDelCicloCentavos,
} from "@/lib/dominio/familia";
import type { Alcance } from "@/lib/auth/permisos";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Abre un ciclo y emite sus créditos.
 *
 * La emisión y la apertura van juntas siempre: un ciclo sin créditos deja al
 * alumno con saldo cero el día que pagó, y unos créditos sin ciclo no se pueden
 * caducar.
 */
function abrirCiclo(
  tx: Tx,
  inscripcionId: number,
  numero: number,
  inicio: string,
  programa: { clasesPorCiclo: number; minutosPorClase: number },
  precioCentavos: number,
  usuarioId: number,
): number {
  const periodo = periodoMensual(inicio);

  const ciclo = tx.insert(ciclos).values({
    inscripcionId,
    numero,
    iniciaEl: periodo.iniciaEl,
    terminaEl: periodo.terminaEl,
    clasesContratadas: programa.clasesPorCiclo,
    minutosPorClase: programa.minutosPorClase,
    precioCentavos,
  }).returning({ id: ciclos.id }).get();

  if (!ciclo) throw new Error("No se pudo abrir el ciclo.");

  tx.insert(creditosClase).values({
    cicloId: ciclo.id,
    delta: programa.clasesPorCiclo,
    motivo: "emision_ciclo",
    nota: `Período ${periodo.iniciaEl} a ${periodo.terminaEl}`,
    creadoPor: usuarioId,
  }).run();

  return ciclo.id;
}

export type DatosInscripcion = {
  alumnoId: number;
  programaId: number;
  instrumentoId: number;
  docenteId: number;
  fechaInicio: string;
  notas: string | null;
  /** Plan familiar al que se suma. NULL si es individual o si es la titular. */
  cubiertaPorId?: number | null;
};

/**
 * Comprueba dentro de la transacción que esta inscripción puede colgarse del plan.
 *
 * Validar en la pantalla no basta: el id del titular viaja en el formulario y quien
 * lo cambie a mano se colgaría del plan de otra familia sin pagar.
 */
function exigirCoberturaValida(
  tx: Tx,
  titularId: number,
  d: { alumnoId: number; programaId: number },
  alumnosIncluidos: number,
): void {
  const titular = tx.select({
    id: inscripciones.id,
    alumnoId: inscripciones.alumnoId,
    programaId: inscripciones.programaId,
    estado: inscripciones.estado,
    cubiertaPorId: inscripciones.cubiertaPorId,
  }).from(inscripciones).where(eq(inscripciones.id, titularId)).get();

  if (!titular) throw new Error("El plan familiar no existe.");

  const cubiertas = tx.select({ n: sql<number>`count(*)` })
    .from(inscripciones).where(eq(inscripciones.cubiertaPorId, titularId)).get()?.n ?? 0;

  const tutorEnComun = tx.select({ n: sql<number>`count(*)` })
    .from(alumnosTutores)
    .where(and(
      eq(alumnosTutores.alumnoId, d.alumnoId),
      sql`${alumnosTutores.tutorId} IN (
        SELECT at2.tutor_id FROM alumnos_tutores at2 WHERE at2.alumno_id = ${titular.alumnoId}
      )`,
    )).get()?.n ?? 0;

  const motivo = motivoParaRechazarCobertura({
    programaIdTitular: titular.programaId,
    programaIdNuevo: d.programaId,
    alumnosIncluidos,
    cubiertasActuales: cubiertas,
    titularYaEstaCubierto: titular.cubiertaPorId !== null,
    titularActivo: titular.estado === "activa",
    compartenTutor: tutorEnComun > 0,
    mismoAlumno: titular.alumnoId === d.alumnoId,
  });

  if (motivo) throw new Error(motivo);
}

export function crearInscripcion(d: DatosInscripcion, usuarioId: number): number {
  return db.transaction((tx) => {
    const programa = tx.select({
      clasesPorCiclo: programas.clasesPorCiclo,
      minutosPorClase: programas.minutosPorClase,
      alumnosIncluidos: programas.alumnosIncluidos,
    }).from(programas).where(eq(programas.id, d.programaId)).get();

    if (!programa) throw new Error("El programa no existe.");

    const cubiertaPorId = d.cubiertaPorId ?? null;
    if (cubiertaPorId !== null) {
      exigirCoberturaValida(tx, cubiertaPorId, d, programa.alumnosIncluidos);
    }

    // El precio se congela al abrir el ciclo. Un cambio de tarifa posterior no
    // reescribe contratos vigentes.
    const precio = tx.select({ v: preciosVigencia.precioCentavos })
      .from(preciosVigencia)
      .where(and(
        eq(preciosVigencia.programaId, d.programaId),
        isNull(preciosVigencia.vigenteHasta),
      )).get();

    if (!precio) throw new Error("El programa no tiene precio vigente.");

    const inscripcion = tx.insert(inscripciones).values({
      alumnoId: d.alumnoId,
      programaId: d.programaId,
      instrumentoId: d.instrumentoId,
      docenteId: d.docenteId,
      fechaInicio: d.fechaInicio,
      notas: d.notas,
      cubiertaPorId,
    }).returning({ id: inscripciones.id }).get();

    if (!inscripcion) throw new Error("No se pudo crear la inscripción.");

    // La cubierta abre su ciclo en cero: su mensualidad ya viene en el cargo del
    // titular. Los créditos y las clases son suyos; solo el precio se comparte.
    abrirCiclo(
      tx, inscripcion.id, 1, d.fechaInicio, programa,
      precioDelCicloCentavos(precio.v, cubiertaPorId !== null), usuarioId,
    );
    return inscripcion.id;
  });
}

/**
 * Renueva: cierra el período vigente y abre el siguiente.
 *
 * Cláusula 4ª: lo que no se tomó no se acumula. El cierre emite un movimiento que
 * lleva el saldo a cero en vez de borrar filas, así que el tutor puede ver
 * exactamente cuántas clases expiraron y cuándo.
 */
export function renovarCiclo(inscripcionId: number, usuarioId: number): number {
  return db.transaction((tx) => {
    const vigente = tx.select().from(ciclos)
      .where(and(eq(ciclos.inscripcionId, inscripcionId), eq(ciclos.estado, "abierto")))
      .orderBy(desc(ciclos.numero)).get();

    if (!vigente) throw new Error("La inscripción no tiene un período abierto.");

    const saldo = tx.select({ s: sql<number>`coalesce(sum(${creditosClase.delta}), 0)` })
      .from(creditosClase).where(eq(creditosClase.cicloId, vigente.id)).get()?.s ?? 0;

    const cierre = movimientoDeCierre(saldo);
    if (cierre) {
      tx.insert(creditosClase).values({
        cicloId: vigente.id,
        delta: cierre.delta,
        motivo: cierre.motivo,
        nota: `${saldo} ${saldo === 1 ? "clase expiró" : "clases expiraron"} al cerrar el período`,
        creadoPor: usuarioId,
      }).run();
    }

    tx.update(ciclos).set({ estado: "cerrado", cerradoEn: new Date() })
      .where(eq(ciclos.id, vigente.id)).run();

    const inscripcion = tx.select({
      programaId: inscripciones.programaId,
      cubiertaPorId: inscripciones.cubiertaPorId,
    }).from(inscripciones).where(eq(inscripciones.id, inscripcionId)).get();
    if (!inscripcion) throw new Error("La inscripción no existe.");

    const programa = tx.select({
      clasesPorCiclo: programas.clasesPorCiclo,
      minutosPorClase: programas.minutosPorClase,
    }).from(programas).where(eq(programas.id, inscripcion.programaId)).get();
    if (!programa) throw new Error("El programa no existe.");

    const precio = tx.select({ v: preciosVigencia.precioCentavos })
      .from(preciosVigencia)
      .where(and(
        eq(preciosVigencia.programaId, inscripcion.programaId),
        isNull(preciosVigencia.vigenteHasta),
      )).get();
    if (!precio) throw new Error("El programa no tiene precio vigente.");

    return abrirCiclo(
      tx, inscripcionId, vigente.numero + 1,
      sumarDias(vigente.terminaEl, 1), programa,
      precioDelCicloCentavos(precio.v, inscripcion.cubiertaPorId !== null), usuarioId,
    );
  });
}

function filtroAlcance(alcance: Alcance) {
  if (alcance.tipo === "todo") return undefined;
  if (alcance.docenteId === null) return sql`0 = 1`;
  return eq(inscripciones.docenteId, alcance.docenteId);
}

export type InscripcionResumen = {
  id: number;
  estado: "activa" | "suspendida" | "finalizada" | "cancelada";
  programa: string;
  instrumento: string;
  docente: string;
  fechaInicio: string;
  cicloId: number | null;
  cicloNumero: number | null;
  iniciaEl: string | null;
  terminaEl: string | null;
  contratadas: number | null;
  minutos: number | null;
  precio: number | null;
  saldo: number;
};

/** Inscripciones de un alumno con el saldo del período vigente ya calculado. */
export function inscripcionesDe(alumnoId: number, alcance: Alcance): InscripcionResumen[] {
  const filtro = filtroAlcance(alcance);

  return db
    .select({
      id: inscripciones.id,
      estado: inscripciones.estado,
      programa: programas.nombre,
      instrumento: instrumentos.nombre,
      docente: docentes.nombre,
      fechaInicio: inscripciones.fechaInicio,
      cicloId: ciclos.id,
      cicloNumero: ciclos.numero,
      iniciaEl: ciclos.iniciaEl,
      terminaEl: ciclos.terminaEl,
      contratadas: ciclos.clasesContratadas,
      minutos: ciclos.minutosPorClase,
      precio: ciclos.precioCentavos,
      // El saldo nunca se guarda: se suma. Ésta es la consulta auditable.
      //
      // Las tablas van calificadas a mano con un alias. Interpolar las columnas de
      // Drizzle aquí las renderiza SIN prefijo de tabla, y entonces `ciclo_id = id`
      // resuelve ambas contra creditos_clase: la subconsulta devuelve 0 en silencio
      // y el saldo que ve el director queda mal sin que nada falle.
      saldo: sql<number>`coalesce((
        SELECT sum(cc.delta) FROM creditos_clase cc
        WHERE cc.ciclo_id = ciclos.id
      ), 0)`,
    })
    .from(inscripciones)
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .innerJoin(docentes, eq(docentes.id, inscripciones.docenteId))
    .leftJoin(ciclos, and(eq(ciclos.inscripcionId, inscripciones.id), eq(ciclos.estado, "abierto")))
    .where(filtro ? and(eq(inscripciones.alumnoId, alumnoId), filtro) : eq(inscripciones.alumnoId, alumnoId))
    .orderBy(desc(inscripciones.creadoEn))
    .all();
}

export function inscripcionPorId(id: number, alcance: Alcance) {
  const filtro = filtroAlcance(alcance);
  return db
    .select({
      id: inscripciones.id,
      alumnoId: inscripciones.alumnoId,
      alumno: alumnos.nombre,
      alumnoCodigo: alumnos.codigo,
      estado: inscripciones.estado,
      programaId: inscripciones.programaId,
      programa: programas.nombre,
      instrumento: instrumentos.nombre,
      docenteId: inscripciones.docenteId,
      docente: docentes.nombre,
      fechaInicio: inscripciones.fechaInicio,
      fechaFin: inscripciones.fechaFin,
      notas: inscripciones.notas,
    })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .innerJoin(docentes, eq(docentes.id, inscripciones.docenteId))
    .where(filtro ? and(eq(inscripciones.id, id), filtro) : eq(inscripciones.id, id))
    .get();
}

/** El período abierto de una inscripción, si lo hay. */
export function cicloAbiertoDe(inscripcionId: number) {
  return db.select({ id: ciclos.id }).from(ciclos)
    .where(and(eq(ciclos.inscripcionId, inscripcionId), eq(ciclos.estado, "abierto")))
    .orderBy(desc(ciclos.numero)).get();
}

export function ciclosDe(inscripcionId: number) {
  return db
    .select({
      id: ciclos.id,
      numero: ciclos.numero,
      iniciaEl: ciclos.iniciaEl,
      terminaEl: ciclos.terminaEl,
      contratadas: ciclos.clasesContratadas,
      minutos: ciclos.minutosPorClase,
      precio: ciclos.precioCentavos,
      posposicionesUsadas: ciclos.posposicionesUsadas,
      estado: ciclos.estado,
      saldo: sql<number>`coalesce((
        SELECT sum(cc.delta) FROM creditos_clase cc
        WHERE cc.ciclo_id = ciclos.id
      ), 0)`,
    })
    .from(ciclos)
    .where(eq(ciclos.inscripcionId, inscripcionId))
    .orderBy(desc(ciclos.numero))
    .all();
}

/** El libro mayor de un período, en orden cronológico. Esto es la auditoría. */
export function movimientosDe(cicloId: number) {
  return db
    .select({
      id: creditosClase.id,
      delta: creditosClase.delta,
      motivo: creditosClase.motivo,
      nota: creditosClase.nota,
      creadoEn: creditosClase.creadoEn,
    })
    .from(creditosClase)
    .where(eq(creditosClase.cicloId, cicloId))
    .orderBy(asc(creditosClase.id))
    .all();
}

export function docentesActivos() {
  return db.select({ id: docentes.id, nombre: docentes.nombre })
    .from(docentes).where(eq(docentes.activo, true)).orderBy(asc(docentes.nombre)).all();
}

export function catalogoParaInscribir() {
  return {
    programas: db.select({
      id: programas.id,
      nombre: programas.nombre,
      descripcion: programas.descripcion,
      clases: programas.clasesPorCiclo,
      minutos: programas.minutosPorClase,
      alumnosIncluidos: programas.alumnosIncluidos,
      precio: preciosVigencia.precioCentavos,
    })
      .from(programas)
      .innerJoin(preciosVigencia, and(
        eq(preciosVigencia.programaId, programas.id),
        isNull(preciosVigencia.vigenteHasta),
      ))
      .where(eq(programas.activo, true))
      .orderBy(asc(programas.orden)).all(),
    instrumentos: db.select({ id: instrumentos.id, nombre: instrumentos.nombre })
      .from(instrumentos).where(eq(instrumentos.activo, true))
      .orderBy(asc(instrumentos.orden)).all(),
    docentes: docentesActivos(),
  };
}

// ------------------------------------------------------- planes familiares ---

export type PlanFamiliarDisponible = {
  inscripcionId: number;
  titular: string;
  titularCodigo: string;
  programa: string;
  alumnosIncluidos: number;
  ocupados: number;
  restantes: number;
  precioCentavos: number;
};

/**
 * Planes familiares con lugar libre a los que ESTE alumno puede sumarse.
 *
 * Se exige tutor en común, no apellido: los apellidos se repiten en Pachuca y el
 * parentesco que la academia sí registró es el del tutor. Un plan lleno no aparece,
 * de modo que la pantalla no ofrece algo que el servidor va a rechazar.
 */
export function planesFamiliaresDisponibles(
  alumnoId: number,
  programaId: number,
): PlanFamiliarDisponible[] {
  const filas = db
    .select({
      inscripcionId: inscripciones.id,
      titular: alumnos.nombre,
      titularCodigo: alumnos.codigo,
      programa: programas.nombre,
      alumnosIncluidos: programas.alumnosIncluidos,
      precioCentavos: preciosVigencia.precioCentavos,
      ocupados: sql<number>`(
        SELECT count(*) FROM inscripciones cub WHERE cub.cubierta_por_id = inscripciones.id
      )`,
    })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(preciosVigencia, and(
      eq(preciosVigencia.programaId, programas.id),
      isNull(preciosVigencia.vigenteHasta),
    ))
    .where(and(
      eq(inscripciones.programaId, programaId),
      eq(inscripciones.estado, "activa"),
      isNull(inscripciones.cubiertaPorId),
      sql`${inscripciones.alumnoId} <> ${alumnoId}`,
      sql`EXISTS (
        SELECT 1 FROM alumnos_tutores a
        JOIN alumnos_tutores b ON b.tutor_id = a.tutor_id
        WHERE a.alumno_id = inscripciones.alumno_id AND b.alumno_id = ${alumnoId}
      )`,
    ))
    .orderBy(asc(alumnos.nombre))
    .all();

  return filas
    .map((f) => ({ ...f, restantes: cupoRestante(f.alumnosIncluidos, f.ocupados) }))
    .filter((f) => f.restantes > 0);
}

export type Familia = {
  titularInscripcionId: number;
  titularAlumnoId: number;
  titular: string;
  programa: string;
  alumnosIncluidos: number;
  precioCentavos: number;
  /** El titular NO aparece aquí: son las que él cubre. */
  cubiertos: { inscripcionId: number; alumnoId: number; alumno: string }[];
};

/**
 * La familia a la que pertenece una inscripción, vista desde cualquiera de sus
 * miembros. Devuelve null cuando la inscripción es individual.
 */
export function familiaDe(inscripcionId: number): Familia | null {
  const yo = db.select({
    id: inscripciones.id,
    cubiertaPorId: inscripciones.cubiertaPorId,
    alumnosIncluidos: programas.alumnosIncluidos,
  })
    .from(inscripciones)
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .where(eq(inscripciones.id, inscripcionId)).get();

  if (!yo || yo.alumnosIncluidos <= 1) return null;

  const titularId = yo.cubiertaPorId ?? yo.id;

  const t = db.select({
    inscripcionId: inscripciones.id,
    alumnoId: alumnos.id,
    alumno: alumnos.nombre,
    programa: programas.nombre,
    alumnosIncluidos: programas.alumnosIncluidos,
    precioCentavos: ciclos.precioCentavos,
  })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .leftJoin(ciclos, and(eq(ciclos.inscripcionId, inscripciones.id), eq(ciclos.estado, "abierto")))
    .where(eq(inscripciones.id, titularId)).get();

  if (!t) return null;

  const cubiertos = db.select({
    inscripcionId: inscripciones.id,
    alumnoId: alumnos.id,
    alumno: alumnos.nombre,
  })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .where(eq(inscripciones.cubiertaPorId, titularId))
    .orderBy(asc(alumnos.nombre))
    .all();

  return {
    titularInscripcionId: t.inscripcionId,
    titularAlumnoId: t.alumnoId,
    titular: t.alumno,
    programa: t.programa,
    alumnosIncluidos: t.alumnosIncluidos,
    precioCentavos: t.precioCentavos ?? 0,
    cubiertos,
  };
}
