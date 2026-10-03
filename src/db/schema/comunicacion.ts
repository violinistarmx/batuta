import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { alumnos, usuarios } from "./personas";
import { prospectos } from "./prospectos";

/**
 * Plantillas de los mensajes que la academia manda.
 *
 * El texto vive en la base y no en el codigo por la misma razon que las reglas del
 * contrato: cambiar como se le habla a un tutor no puede exigir un despliegue.
 */
export const plantillas = sqliteTable("plantillas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clave: text("clave").notNull(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull(),
  canal: text("canal", { enum: ["whatsapp", "correo", "sms"] }).notNull().default("whatsapp"),
  asunto: text("asunto"),
  cuerpo: text("cuerpo").notNull(),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
  orden: integer("orden").notNull().default(0),
}, (t) => [uniqueIndex("ux_plantillas_clave").on(t.clave)]);

/**
 * Cada mensaje concreto, desde que se redacta hasta que se manda.
 *
 * Se guarda el texto YA renderizado, no la plantilla mas los datos. Lo que el
 * director aprueba tiene que ser exactamente lo que sale: si se guardara la receta,
 * editar la plantilla despues cambiaria el contenido de un mensaje ya aprobado y la
 * aprobacion dejaria de significar nada.
 */
export const mensajes = sqliteTable("mensajes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plantillaId: integer("plantilla_id").references(() => plantillas.id),

  /** A quien se refiere. Uno de los dos, o ninguno si es un mensaje suelto. */
  alumnoId: integer("alumno_id").references(() => alumnos.id, { onDelete: "cascade" }),
  prospectoId: integer("prospecto_id").references(() => prospectos.id, { onDelete: "cascade" }),

  /** A quien se le manda, congelado: si el tutor cambia de numero, el registro no miente. */
  destinatario: text("destinatario").notNull(),
  telefono: text("telefono"),
  canal: text("canal", { enum: ["whatsapp", "correo", "sms"] }).notNull().default("whatsapp"),
  asunto: text("asunto"),
  cuerpo: text("cuerpo").notNull(),

  estado: text("estado", {
    enum: ["borrador", "aprobado", "rechazado", "enviado", "cancelado"],
  }).notNull().default("borrador"),
  motivoRechazo: text("motivo_rechazo"),

  redactadoPor: integer("redactado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  aprobadoPor: integer("aprobado_por").references(() => usuarios.id),
  aprobadoEn: integer("aprobado_en", { mode: "timestamp" }),
  enviadoPor: integer("enviado_por").references(() => usuarios.id),
  enviadoEn: integer("enviado_en", { mode: "timestamp" }),
  notaEnvio: text("nota_envio"),
}, (t) => [
  index("ix_mensajes_estado").on(t.estado, t.creadoEn),
  index("ix_mensajes_alumno").on(t.alumnoId),
  index("ix_mensajes_prospecto").on(t.prospectoId),
  /**
   * Nada sale sin aprobacion previa.
   *
   * Es el requisito central del modulo y por eso no vive solo en el codigo: un
   * mensaje en estado «enviado» sin quien lo aprobo es un dato imposible, y la
   * base lo rechaza aunque el flujo que lo produjo tuviera un hueco.
   */
  check("ck_mensaje_aprobado_antes_de_enviar",
    sql`estado <> 'enviado' OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL)`),
  /** Un mensaje aprobado siempre dice quien lo aprobo. */
  check("ck_mensaje_aprobacion_completa",
    sql`estado <> 'aprobado' OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL)`),
  /** Un rechazo sin motivo no le sirve a quien tiene que corregirlo. */
  check("ck_mensaje_rechazo_con_motivo",
    sql`estado <> 'rechazado' OR motivo_rechazo IS NOT NULL`),
]);
