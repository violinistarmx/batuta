import "server-only";

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, alumnosTutores, cargos, ciclos, clases, credenciales, docentes,
  inscripciones, instrumentos, programas, tutores,
} from "@/db/schema/index";
import { adeudoDe, type Cargo } from "@/lib/dominio/cobranza";
import { diasRestantes } from "@/lib/dominio/ciclos";
import type { Alcance } from "@/lib/auth/permisos";

/**
 * Lo que hace falta saber de un alumno en diez segundos, de pie en recepción.
 *
 * Es lo que se ve al escanear su QR. Antes el escaneo aterrizaba en el expediente
 * completo, que responde bien a «cuéntame todo» y mal a «¿este niño puede pasar a
 * su clase?»: la pregunta de mostrador se contesta con el saldo, el período y el
 * adeudo, y esos tres datos estaban repartidos en tres bloques distintos.
 */
export type EstatusInscripcion = {
  inscripcionId: number;
  programa: string;
  instrumento: string;
  docente: string;
  estado: string;
  cicloId: number | null;
  iniciaEl: string | null;
  terminaEl: string | null;
  contratadas: number | null;
  saldo: number;
  /** NULL cuando la inscripción no tiene período abierto. */
  posposicionesUsadas: number | null;
  /** El precio lo paga el titular del plan familiar; aquí no hay adeudo propio. */
  cubiertaPorId: number | null;
};

export type Estatus = {
  alumno: {
    id: number;
    nombre: string;
    codigo: string;
    fechaNacimiento: string | null;
    telefono: string | null;
    estado: string;
  };
  tutor: { nombre: string; telefono: string | null; parentesco: string } | null;
  inscripciones: EstatusInscripcion[];
  proxima: { id: number; iniciaEn: Date; minutos: number; docente: string; programa: string } | null;
  /** Solo se llena para quien puede ver finanzas. */
  adeudoCentavos: number | null;
  vencidoCentavos: number | null;
  credencial: { emitirDesde: string; entregadaEn: string | null } | null;
};

export function estatusDeAlumno(
  alumnoId: number,
  alcance: Alcance,
  verFinanzas: boolean,
  hoy: string,
): Estatus | null {
  const filtroDocente = alcance.tipo === "propio"
    ? (alcance.docenteId === null ? sql`0 = 1` : eq(inscripciones.docenteId, alcance.docenteId))
    : undefined;

  const a = db.select({
    id: alumnos.id,
    nombre: alumnos.nombre,
    codigo: alumnos.codigo,
    fechaNacimiento: alumnos.fechaNacimiento,
    telefono: alumnos.telefono,
    estado: alumnos.estado,
  }).from(alumnos).where(eq(alumnos.id, alumnoId)).get();
  if (!a) return null;

  const tutor = db.select({
    nombre: tutores.nombre,
    telefono: tutores.telefono,
    parentesco: alumnosTutores.parentesco,
  })
    .from(alumnosTutores)
    .innerJoin(tutores, eq(tutores.id, alumnosTutores.tutorId))
    .where(eq(alumnosTutores.alumnoId, alumnoId))
    .orderBy(desc(alumnosTutores.esResponsablePago))
    .get() ?? null;

  const base = and(eq(inscripciones.alumnoId, alumnoId), eq(inscripciones.estado, "activa"));

  const insc = db.select({
    inscripcionId: inscripciones.id,
    programa: programas.nombre,
    instrumento: instrumentos.nombre,
    docente: docentes.nombre,
    estado: inscripciones.estado,
    cubiertaPorId: inscripciones.cubiertaPorId,
    cicloId: ciclos.id,
    iniciaEl: ciclos.iniciaEl,
    terminaEl: ciclos.terminaEl,
    contratadas: ciclos.clasesContratadas,
    posposicionesUsadas: ciclos.posposicionesUsadas,
    // Prefijo explícito de tabla: dentro de un `sql` en crudo Drizzle renderiza las
    // columnas sin él, y la subconsulta compararía `ciclo_id = id` en silencio.
    saldo: sql<number>`coalesce((
      SELECT sum(cc.delta) FROM creditos_clase cc WHERE cc.ciclo_id = ciclos.id
    ), 0)`,
  })
    .from(inscripciones)
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .innerJoin(docentes, eq(docentes.id, inscripciones.docenteId))
    .leftJoin(ciclos, and(eq(ciclos.inscripcionId, inscripciones.id), eq(ciclos.estado, "abierto")))
    .where(filtroDocente ? and(base, filtroDocente) : base)
    .orderBy(asc(programas.orden))
    .all();

  const proxima = db.select({
    id: clases.id,
    iniciaEn: clases.iniciaEn,
    minutos: clases.minutos,
    docente: docentes.nombre,
    programa: programas.nombre,
  })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(and(
      eq(inscripciones.alumnoId, alumnoId),
      eq(clases.estado, "programada"),
      ...(filtroDocente ? [filtroDocente] : []),
    ))
    .orderBy(asc(clases.iniciaEn))
    .get() ?? null;

  let adeudoCentavos: number | null = null;
  let vencidoCentavos: number | null = null;
  if (verFinanzas) {
    const abiertos = db.select({
      id: cargos.id,
      montoCentavos: cargos.montoCentavos,
      venceEl: cargos.venceEl,
      aplicadoCentavos: sql<number>`coalesce((
        SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
      ), 0)`,
    })
      .from(cargos)
      .where(and(eq(cargos.alumnoId, alumnoId), eq(cargos.cancelado, false)))
      .all() as Cargo[];

    adeudoCentavos = abiertos.reduce((s, c) => s + adeudoDe(c), 0);
    vencidoCentavos = abiertos
      .filter((c) => c.venceEl < hoy)
      .reduce((s, c) => s + adeudoDe(c), 0);
  }

  const credencial = db.select({
    emitirDesde: credenciales.emitirDesde,
    entregadaEn: credenciales.entregadaEn,
  }).from(credenciales).where(eq(credenciales.alumnoId, alumnoId)).get() ?? null;

  return { alumno: a, tutor, inscripciones: insc, proxima, adeudoCentavos, vencidoCentavos, credencial };
}

/** Días que le quedan al período, o null si no hay período abierto. */
export function diasDePeriodo(i: EstatusInscripcion, hoy: string): number | null {
  if (!i.iniciaEl || !i.terminaEl) return null;
  return diasRestantes({ iniciaEl: i.iniciaEl, terminaEl: i.terminaEl }, hoy);
}

// ------------------------------------------------------------- credencial ---

/**
 * Registra la entrega de la credencial.
 *
 * Mientras la credencial física esté pendiente de diseño, lo que se entrega es el
 * QR digital. Se guarda por qué medio para que dentro de seis meses se pueda
 * distinguir a quién se le dio una tarjeta y a quién un enlace.
 */
export function registrarEntregaCredencial(
  alumnoId: number,
  usuarioId: number,
  medio: string,
  hoy: string,
): void {
  const c = db.select({ id: credenciales.id, entregadaEn: credenciales.entregadaEn })
    .from(credenciales).where(eq(credenciales.alumnoId, alumnoId)).get();
  if (!c) throw new Error("Este alumno no tiene credencial registrada.");
  if (c.entregadaEn) throw new Error("La credencial ya estaba entregada.");

  db.update(credenciales)
    .set({ entregadaEn: hoy, entregadaPor: usuarioId, notas: medio })
    .where(eq(credenciales.id, c.id)).run();
}
