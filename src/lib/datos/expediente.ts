import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, clases, docentes, documentos, inscripciones, instrumentos,
  planeaciones, progreso, programas, tareas,
} from "@/db/schema/index";
import { guardar } from "@/lib/almacen";
import type { TipoPermitido } from "@/lib/dominio/archivos";
import type { Alcance } from "@/lib/auth/permisos";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Guarda el archivo en disco y su fila en la base, en ese orden.
 *
 * Si la base falla después de escribir el archivo, queda un huérfano en el
 * almacén: ocupa espacio pero no es alcanzable desde ninguna parte. El caso
 * contrario —fila sin archivo— rompería la descarga, así que se prefiere este.
 */
export async function guardarDocumento(
  contenido: Buffer,
  tipo: TipoPermitido,
  meta: {
    alumnoId: number | null;
    inscripcionId: number | null;
    claseId: number | null;
    categoria: "planeacion" | "contrato" | "comprobante" | "recibo" | "otro";
    nombreOriginal: string;
    subidoPor: number;
  },
  tx?: Tx,
): Promise<number> {
  const archivo = await guardar(contenido, tipo);
  const ejecutor = tx ?? db;

  const fila = ejecutor.insert(documentos).values({
    alumnoId: meta.alumnoId,
    inscripcionId: meta.inscripcionId,
    claseId: meta.claseId,
    categoria: meta.categoria,
    nombreOriginal: meta.nombreOriginal,
    ruta: archivo.ruta,
    tipoMime: tipo,
    bytes: archivo.bytes,
    hashSha256: archivo.hash,
    subidoPor: meta.subidoPor,
  }).returning({ id: documentos.id }).get();

  if (!fila) throw new Error("No se pudo registrar el documento.");
  return fila.id;
}

/**
 * Documento con el alcance ya aplicado.
 *
 * Un docente solo alcanza documentos de clases suyas. Se resuelve aquí y no en el
 * endpoint: así una ruta de descarga nueva no puede olvidarse de filtrar.
 */
export function documentoPorId(id: number, alcance: Alcance) {
  const base = db
    .select({
      id: documentos.id,
      ruta: documentos.ruta,
      nombreOriginal: documentos.nombreOriginal,
      tipoMime: documentos.tipoMime,
      bytes: documentos.bytes,
      categoria: documentos.categoria,
      claseId: documentos.claseId,
      alumnoId: documentos.alumnoId,
    })
    .from(documentos);

  if (alcance.tipo === "todo") return base.where(eq(documentos.id, id)).get();
  if (alcance.docenteId === null) return undefined;

  return base
    .where(and(
      eq(documentos.id, id),
      sql`EXISTS (
        SELECT 1 FROM clases c
        WHERE c.id = ${documentos.claseId} AND c.docente_id = ${alcance.docenteId}
      )`,
    ))
    .get();
}

export type DatosPlaneacion = {
  claseId: number;
  docenteId: number;
  documentoId: number | null;
  objetivos: string | null;
  temas: string | null;
  evaluacion: string | null;
};

/** Una planeación por clase: subir otra reemplaza la anterior. */
export function guardarPlaneacion(d: DatosPlaneacion, usuarioId: number): number {
  const existente = db.select({ id: planeaciones.id, documentoId: planeaciones.documentoId })
    .from(planeaciones).where(eq(planeaciones.claseId, d.claseId)).get();

  if (existente) {
    db.update(planeaciones).set({
      objetivos: d.objetivos,
      temas: d.temas,
      evaluacion: d.evaluacion,
      // Si esta vez no vino archivo, se conserva el que ya estaba.
      documentoId: d.documentoId ?? existente.documentoId,
      actualizadoEn: new Date(),
    }).where(eq(planeaciones.id, existente.id)).run();
    return existente.id;
  }

  const fila = db.insert(planeaciones).values({
    claseId: d.claseId,
    docenteId: d.docenteId,
    documentoId: d.documentoId,
    objetivos: d.objetivos,
    temas: d.temas,
    evaluacion: d.evaluacion,
    creadoPor: usuarioId,
  }).returning({ id: planeaciones.id }).get();

  if (!fila) throw new Error("No se pudo guardar la planeación.");
  return fila.id;
}

export function planeacionDeClase(claseId: number) {
  return db
    .select({
      id: planeaciones.id,
      objetivos: planeaciones.objetivos,
      temas: planeaciones.temas,
      evaluacion: planeaciones.evaluacion,
      documentoId: planeaciones.documentoId,
      nombreArchivo: documentos.nombreOriginal,
      bytes: documentos.bytes,
      creadoEn: planeaciones.creadoEn,
      actualizadoEn: planeaciones.actualizadoEn,
    })
    .from(planeaciones)
    .leftJoin(documentos, eq(documentos.id, planeaciones.documentoId))
    .where(eq(planeaciones.claseId, claseId))
    .get();
}

export function crearTarea(d: {
  inscripcionId: number; claseId: number | null; descripcion: string;
  repertorio: string | null; fechaRevision: string | null;
}, usuarioId: number): number {
  const fila = db.insert(tareas).values({ ...d, creadoPor: usuarioId })
    .returning({ id: tareas.id }).get();
  if (!fila) throw new Error("No se pudo crear la tarea.");
  return fila.id;
}

export function marcarTarea(id: number, completada: boolean): void {
  db.update(tareas)
    .set({ completadaEn: completada ? new Date().toISOString().slice(0, 10) : null })
    .where(eq(tareas.id, id)).run();
}

export function tareasDeInscripcion(inscripcionId: number) {
  return db.select().from(tareas)
    .where(eq(tareas.inscripcionId, inscripcionId))
    .orderBy(desc(tareas.creadoEn)).all();
}

export function tareasDeClase(claseId: number) {
  return db.select().from(tareas).where(eq(tareas.claseId, claseId))
    .orderBy(desc(tareas.creadoEn)).all();
}

export function crearProgreso(d: {
  inscripcionId: number; claseId: number | null; cicloId: number | null;
  fecha: string; valoracion: "requiere_apoyo" | "en_desarrollo" | "consolidado" | "destacado" | null;
  notas: string;
}, usuarioId: number): number {
  const fila = db.insert(progreso).values({ ...d, creadoPor: usuarioId })
    .returning({ id: progreso.id }).get();
  if (!fila) throw new Error("No se pudo registrar el avance.");
  return fila.id;
}

export function progresoDeInscripcion(inscripcionId: number) {
  return db
    .select({
      id: progreso.id,
      fecha: progreso.fecha,
      valoracion: progreso.valoracion,
      notas: progreso.notas,
      autor: docentes.nombre,
    })
    .from(progreso)
    .leftJoin(clases, eq(clases.id, progreso.claseId))
    .leftJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(eq(progreso.inscripcionId, inscripcionId))
    .orderBy(desc(progreso.fecha))
    .all();
}

/**
 * Clases impartidas sin planeación entregada.
 *
 * Es el pendiente que el brief pide mostrar en el tablero: el director quiere
 * saber qué maestros deben planeaciones sin tener que revisar clase por clase.
 */
export function planeacionesPendientes(alcance: Alcance, limite = 20) {
  const filtro = alcance.tipo === "propio"
    ? (alcance.docenteId === null ? sql`0 = 1` : eq(clases.docenteId, alcance.docenteId))
    : undefined;

  const base = and(
    eq(clases.estado, "asistio"),
    sql`NOT EXISTS (SELECT 1 FROM planeaciones p WHERE p.clase_id = ${clases.id})`,
  );

  return db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      alumno: alumnos.nombre,
      docente: docentes.nombre,
      programa: programas.nombre,
      instrumento: instrumentos.nombre,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .where(filtro ? and(base, filtro) : base)
    .orderBy(desc(clases.iniciaEn))
    .limit(limite)
    .all();
}
