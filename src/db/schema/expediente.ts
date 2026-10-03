import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { alumnos, docentes, usuarios } from "./personas";
import { ciclos, clases, inscripciones } from "./academico";

/**
 * Archivos del expediente.
 *
 * La fila guarda metadatos; el contenido vive en el almacen, fuera de public/.
 * `ruta` la genera el sistema, nunca el cliente: un nombre como `../../.env`
 * escribiria fuera del almacen.
 */
export const documentos = sqliteTable("documentos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alumnoId: integer("alumno_id").references(() => alumnos.id, { onDelete: "cascade" }),
  inscripcionId: integer("inscripcion_id").references(() => inscripciones.id),
  claseId: integer("clase_id").references(() => clases.id),
  categoria: text("categoria", {
    enum: [
      "contrato", "comprobante", "recibo", "identificacion", "documento_tutor",
      "planeacion", "evaluacion", "constancia", "reconocimiento", "fotografia", "otro",
    ],
  }).notNull(),
  /** Como lo llamo quien lo subio. Solo se muestra; no se usa para abrir nada. */
  nombreOriginal: text("nombre_original").notNull(),
  ruta: text("ruta").notNull(),
  tipoMime: text("tipo_mime").notNull(),
  bytes: integer("bytes").notNull(),
  /** Para detectar corrupcion y verificar que un respaldo restauro el archivo. */
  hashSha256: text("hash_sha256").notNull(),
  subidoPor: integer("subido_por").references(() => usuarios.id),
  subidoEn: integer("subido_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_documentos_alumno").on(t.alumnoId, t.categoria),
  index("ix_documentos_clase").on(t.claseId),
]);

/**
 * Planeacion de clase.
 *
 * El brief la marca como modulo prioritario: el PDF debe quedar atado a alumno,
 * inscripcion, clase y maestro a la vez. Con la clase basta —de ella cuelgan los
 * otros tres— y asi no hay forma de que los cuatro se contradigan.
 */
export const planeaciones = sqliteTable("planeaciones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claseId: integer("clase_id").notNull().references(() => clases.id, { onDelete: "cascade" }),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),
  documentoId: integer("documento_id").references(() => documentos.id),
  objetivos: text("objetivos"),
  temas: text("temas"),
  evaluacion: text("evaluacion"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  actualizadoEn: integer("actualizado_en", { mode: "timestamp" }),
}, (t) => [
  // Una planeacion por clase. Subir una nueva reemplaza la anterior.
  uniqueIndex("ux_planeacion_clase").on(t.claseId),
  index("ix_planeaciones_docente").on(t.docenteId),
]);

/** Tarea asignada al terminar la clase: repertorio, ejercicio, objetivo de practica. */
export const tareas = sqliteTable("tareas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inscripcionId: integer("inscripcion_id").notNull().references(() => inscripciones.id, { onDelete: "cascade" }),
  claseId: integer("clase_id").references(() => clases.id, { onDelete: "set null" }),
  descripcion: text("descripcion").notNull(),
  repertorio: text("repertorio"),
  fechaRevision: text("fecha_revision"),
  completadaEn: text("completada_en"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_tareas_inscripcion").on(t.inscripcionId),
  index("ix_tareas_clase").on(t.claseId),
]);

/** Avance academico: una nota fechada sobre como va el alumno. */
export const progreso = sqliteTable("progreso", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inscripcionId: integer("inscripcion_id").notNull().references(() => inscripciones.id, { onDelete: "cascade" }),
  claseId: integer("clase_id").references(() => clases.id, { onDelete: "set null" }),
  cicloId: integer("ciclo_id").references(() => ciclos.id),
  fecha: text("fecha").notNull(),
  valoracion: text("valoracion", {
    enum: ["requiere_apoyo", "en_desarrollo", "consolidado", "destacado"],
  }),
  notas: text("notas").notNull(),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("ix_progreso_inscripcion").on(t.inscripcionId, t.fecha)]);
