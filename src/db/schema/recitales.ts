import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { alumnos, docentes, usuarios } from "./personas";
import { inscripciones } from "./academico";

/**
 * Un recital: la fecha, la sede y el precio del boleto.
 *
 * El precio vive en el recital y no en la configuracion porque cada evento pone el
 * suyo: un recital de fin de curso en un teatro rentado no cuesta lo que una tarde
 * de alumnos en la academia.
 */
export const recitales = sqliteTable("recitales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  fecha: text("fecha").notNull(),
  hora: text("hora").notNull(),
  sede: text("sede").notNull(),
  direccionSede: text("direccion_sede"),
  /** Aforo de la sede. NULL cuando no se declara: no es lo mismo que cero. */
  capacidad: integer("capacidad"),
  /** Centavos. Cero es entrada libre. */
  precioBoletoCentavos: integer("precio_boleto_centavos").notNull().default(0),

  estado: text("estado", {
    enum: ["planeado", "abierto", "programa_cerrado", "realizado", "cancelado"],
  }).notNull().default("planeado"),

  notas: text("notas"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_recitales_fecha").on(t.fecha),
  check("ck_recital_precio_no_negativo", sql`precio_boleto_centavos >= 0`),
  check("ck_recital_capacidad", sql`capacidad IS NULL OR capacidad > 0`),
]);

/**
 * Quien toca y que toca.
 *
 * El maestro propone y la direccion confirma. Son dos manos a proposito: el maestro
 * sabe quien tiene una pieza lista, y la direccion es la unica que ve el adeudo que
 * puede impedir la participacion.
 */
export const participaciones = sqliteTable("participaciones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recitalId: integer("recital_id").notNull()
    .references(() => recitales.id, { onDelete: "cascade" }),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id, { onDelete: "cascade" }),
  inscripcionId: integer("inscripcion_id").notNull().references(() => inscripciones.id),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),

  pieza: text("pieza").notNull(),
  compositor: text("compositor"),
  duracionMinutos: integer("duracion_minutos"),
  /** Lugar en el programa. NULL hasta que se ordena. */
  orden: integer("orden"),

  estado: text("estado", {
    enum: ["propuesta", "confirmada", "rechazada", "cancelada"],
  }).notNull().default("propuesta"),
  motivoRechazo: text("motivo_rechazo"),

  propuestaPor: integer("propuesta_por").references(() => usuarios.id),
  propuestaEn: integer("propuesta_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  confirmadaPor: integer("confirmada_por").references(() => usuarios.id),
  confirmadaEn: integer("confirmada_en", { mode: "timestamp" }),

  /** El dia del evento. NULL mientras no se pase lista. */
  asistio: integer("asistio", { mode: "boolean" }),
  notas: text("notas"),
}, (t) => [
  index("ix_participaciones_recital").on(t.recitalId, t.estado),
  index("ix_participaciones_alumno").on(t.alumnoId),
  /**
   * Dos alumnos no ocupan el mismo lugar del programa.
   *
   * Un programa con dos numeros tres no se puede leer en voz alta, y el error
   * aparece cuando ya se imprimio. Solo cuenta para las confirmadas: una propuesta
   * rechazada no estorba el orden.
   */
  uniqueIndex("ux_participacion_orden").on(t.recitalId, t.orden)
    .where(sql`orden IS NOT NULL AND estado = 'confirmada'`),
  /** Un rechazo sin motivo no le dice al maestro que corregir. */
  check("ck_participacion_rechazo_con_motivo",
    sql`estado <> 'rechazada' OR motivo_rechazo IS NOT NULL`),
  /** Una confirmacion siempre dice quien la autorizo. */
  check("ck_participacion_confirmacion_completa",
    sql`estado <> 'confirmada' OR (confirmada_por IS NOT NULL AND confirmada_en IS NOT NULL)`),
]);

/**
 * Taquilla. Es otro negocio que las mensualidades y vive aparte a proposito.
 *
 * Un boleto no es un cargo a un alumno: lo compra quien viene al recital, que
 * muchas veces no es familia de nadie. Mezclarlo con `cargos` obligaria a inventar
 * un alumno para cada abuelo que compra dos entradas.
 */
export const boletos = sqliteTable("boletos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recitalId: integer("recital_id").notNull()
    .references(() => recitales.id, { onDelete: "cascade" }),
  folio: text("folio").notNull(),
  cantidad: integer("cantidad").notNull(),
  precioUnitarioCentavos: integer("precio_unitario_centavos").notNull(),
  totalCentavos: integer("total_centavos").notNull(),

  compradorNombre: text("comprador_nombre").notNull(),
  compradorTelefono: text("comprador_telefono"),
  /** Cuando quien compra es familia de un alumno. Opcional. */
  alumnoId: integer("alumno_id").references(() => alumnos.id),

  metodo: text("metodo", {
    enum: ["efectivo", "transferencia", "tarjeta", "deposito", "cortesia", "otro"],
  }).notNull().default("efectivo"),
  vendidoEl: text("vendido_el").notNull(),
  vendidoPor: integer("vendido_por").references(() => usuarios.id),

  cancelado: integer("cancelado", { mode: "boolean" }).notNull().default(false),
  motivoCancelacion: text("motivo_cancelacion"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_boletos_folio").on(t.folio),
  index("ix_boletos_recital").on(t.recitalId, t.cancelado),
  check("ck_boleto_cantidad", sql`cantidad > 0`),
  /**
   * La taquilla no puede descuadrar.
   *
   * total = cantidad x precio unitario, comprobado por la base. Un total tecleado a
   * mano o calculado en pesos y redondeado despues es como se cuelan los descuadres
   * de un peso que nadie sabe explicar al cerrar la caja.
   */
  check("ck_boleto_total_cuadra", sql`total_centavos = cantidad * precio_unitario_centavos`),
  check("ck_boleto_cancelacion_con_motivo",
    sql`cancelado = 0 OR motivo_cancelacion IS NOT NULL`),
]);
