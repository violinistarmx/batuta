import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { aulas, instrumentos, niveles, programas } from "./catalogo";
import { alumnos, docentes, usuarios } from "./personas";

/**
 * La inscripcion es el eje del sistema, no el alumno.
 *
 * Juan puede cursar violin en Allegro Virtuoso y piano en Allegro Andante al mismo
 * tiempo: son dos inscripciones, cada una con su programa, maestro, horario, saldo
 * de clases y cobranza. Cualquier campo "programa" sobre el alumno se rompe aqui.
 */
export const inscripciones = sqliteTable("inscripciones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id),
  programaId: integer("programa_id").notNull().references(() => programas.id),
  instrumentoId: integer("instrumento_id").notNull().references(() => instrumentos.id),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),
  nivelId: integer("nivel_id").references(() => niveles.id),
  estado: text("estado", {
    enum: ["activa", "suspendida", "finalizada", "cancelada"],
  }).notNull().default("activa"),
  fechaInicio: text("fecha_inicio").notNull(),
  fechaFin: text("fecha_fin"),
  /** Clausula 12a: la baja exige 72 h de aviso. Se guarda cuando aviso, no cuando se proceso. */
  avisoBajaEn: integer("aviso_baja_en", { mode: "timestamp" }),
  /**
   * Planes familiares: apunta a la inscripcion TITULAR que paga por todo el grupo.
   *
   * El precio de un Family Duet es del grupo, no de cada nino, pero cada hermano
   * necesita su propia inscripcion: su maestro, su horario y su saldo de clases son
   * suyos. Cobrar el precio completo en las dos inscripciones cobraria doble; por eso
   * la cubierta abre su ciclo en cero y el cargo vive una sola vez, en el titular.
   *
   * NULL en toda inscripcion individual y en el titular de una familia.
   */
  cubiertaPorId: integer("cubierta_por_id"),
  notas: text("notas"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_inscripciones_alumno").on(t.alumnoId, t.estado),
  index("ix_inscripciones_docente").on(t.docenteId, t.estado),
  index("ix_inscripciones_cubierta").on(t.cubiertaPorId),
]);

/**
 * Un ciclo es un paquete de N clases anclado a la fecha de alta del alumno, no al
 * mes calendario (clausula 3a: el pago se hace al inicio de la primera clase del
 * periodo). Asi "4 clases contratadas" siempre significa cuatro exactas.
 */
export const ciclos = sqliteTable("ciclos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inscripcionId: integer("inscripcion_id").notNull().references(() => inscripciones.id),
  numero: integer("numero").notNull(),
  iniciaEl: text("inicia_el").notNull(),
  terminaEl: text("termina_el").notNull(),
  clasesContratadas: integer("clases_contratadas").notNull(),
  minutosPorClase: integer("minutos_por_clase").notNull(),
  precioCentavos: integer("precio_centavos").notNull(),
  /** Clausula 4a: tope de 2 posposiciones por periodo. Se lleva la cuenta aqui. */
  posposicionesUsadas: integer("posposiciones_usadas").notNull().default(0),
  estado: text("estado", { enum: ["abierto", "cerrado"] }).notNull().default("abierto"),
  cerradoEn: integer("cerrado_en", { mode: "timestamp" }),
}, (t) => [
  uniqueIndex("ux_ciclos_inscripcion_numero").on(t.inscripcionId, t.numero),
  index("ix_ciclos_estado").on(t.estado),
]);

export const clases = sqliteTable("clases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inscripcionId: integer("inscripcion_id").notNull().references(() => inscripciones.id),
  cicloId: integer("ciclo_id").notNull().references(() => ciclos.id),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),
  /** NULL cuando la clase es en linea: no ocupa cubiculo ni entra al conflicto de aula. */
  aulaId: integer("aula_id").references(() => aulas.id),
  iniciaEn: integer("inicia_en", { mode: "timestamp" }).notNull(),
  terminaEn: integer("termina_en", { mode: "timestamp" }).notNull(),
  minutos: integer("minutos").notNull(),
  modalidad: text("modalidad", { enum: ["presencial", "en_linea"] }).notNull().default("presencial"),
  /**
   * ORIGEN y ESTADO son ejes distintos. El brief los mezclaba y no funciona: una
   * clase de recuperacion tambien se asiste o se falta, asi que necesita su propio
   * estado. "Clase recuperada" es procedencia, no resultado.
   */
  origen: text("origen", {
    enum: ["regular", "recuperacion", "extra", "cortesia"],
  }).notNull().default("regular"),
  estado: text("estado", {
    enum: ["programada", "asistio", "falta", "falta_justificada", "cancelada", "reprogramada"],
  }).notNull().default("programada"),
  /** Si esta clase nacio de una posposicion, apunta a la original. Traza completa. */
  claseOriginalId: integer("clase_original_id"),
  observaciones: text("observaciones"),
  registradoPor: integer("registrado_por").references(() => usuarios.id),
  registradoEn: integer("registrado_en", { mode: "timestamp" }),
  /** Identificador del evento en Google Calendar. Hace idempotente la sincronizacion. */
  eventoExternoId: text("evento_externo_id"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_clases_ciclo").on(t.cicloId),
  index("ix_clases_docente_fecha").on(t.docenteId, t.iniciaEn),
  index("ix_clases_aula_fecha").on(t.aulaId, t.iniciaEn),
  index("ix_clases_inscripcion_fecha").on(t.inscripcionId, t.iniciaEn),
  index("ix_clases_estado").on(t.estado),
]);

/**
 * LIBRO MAYOR DE CREDITOS -- append-only.
 *
 * El saldo de clases nunca se escribe: se suma. Un campo "clases_restantes" que se
 * incrementa y decrementa no es auditable, y el brief exige que lo sea. Aqui cada
 * movimiento lleva signo, motivo, autor y fecha, y "clases restantes" es
 * SUM(delta) WHERE ciclo_id = ?
 *
 * La garantia contra el doble conteo no es codigo, es un indice: ux_credito_debito
 * impide que una clase debite mas de una vez en toda su vida.
 */
export const creditosClase = sqliteTable("creditos_clase", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cicloId: integer("ciclo_id").notNull().references(() => ciclos.id),
  claseId: integer("clase_id").references(() => clases.id),
  /** +N emite, -1 consume, 0 no deberia existir (una posposicion no genera fila). */
  delta: integer("delta").notNull(),
  motivo: text("motivo", {
    enum: [
      "emision_ciclo",
      "clase_tomada",
      "falta_sin_aviso",
      "expiracion_ciclo",
      "cancelada_por_academia",
      "credito_cortesia",
      "ajuste_manual",
    ],
  }).notNull(),
  nota: text("nota"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_creditos_ciclo").on(t.cicloId),
  /**
   * Una clase consume por asistencia a lo sumo UNA vez. La base lo impide, no la
   * aplicacion.
   *
   * El indice cubre solo los motivos de consumo. Los ajustes quedan fuera a
   * proposito: corregir un registro equivocado ("marque asistio y en realidad
   * aviso con dos dias") tiene que poder mover el saldo en sentido contrario, y
   * bloquearlo dejaria el expediente mal para siempre. Un ajuste es explicito y
   * queda marcado como tal; un doble consumo sigue siendo imposible.
   */
  uniqueIndex("ux_credito_debito").on(t.claseId).where(
    sql`delta < 0 AND clase_id IS NOT NULL AND motivo IN ('clase_tomada','falta_sin_aviso')`,
  ),
]);

/**
 * Registro de la posposicion. Guarda CUANDO aviso el tutor, que es lo unico que
 * determina si se cumplio el umbral de 24 h de la clausula 4a. La hora en que el
 * personal capturo el aviso es irrelevante para la regla.
 */
export const posposiciones = sqliteTable("posposiciones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claseOriginalId: integer("clase_original_id").notNull().references(() => clases.id),
  claseRecuperacionId: integer("clase_recuperacion_id").references(() => clases.id),
  avisoEn: integer("aviso_en", { mode: "timestamp" }).notNull(),
  horasAnticipacion: integer("horas_anticipacion").notNull(),
  canal: text("canal", { enum: ["whatsapp", "telefono", "presencial", "correo", "otro"] })
    .notNull().default("whatsapp"),
  cumplioUmbral: integer("cumplio_umbral", { mode: "boolean" }).notNull(),
  /** Si no cumplio el umbral pero el director autorizo de todas formas. */
  autorizadaPor: integer("autorizada_por").references(() => usuarios.id),
  motivoExcepcion: text("motivo_excepcion"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_posposicion_clase").on(t.claseOriginalId),
  index("ix_posposiciones_recuperacion").on(t.claseRecuperacionId),
]);

/** Bitacora append-only. No se actualiza ni se borra nunca. */
export const bitacora = sqliteTable("bitacora", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  entidadId: integer("entidad_id"),
  /** JSON con el antes y el despues de los campos que cambiaron. */
  cambios: text("cambios"),
  ip: text("ip"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_bitacora_entidad").on(t.entidad, t.entidadId),
  index("ix_bitacora_fecha").on(t.creadoEn),
]);
