import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { usuarios } from "./personas";

/**
 * Sesiones respaldadas en base de datos.
 *
 * Un token firmado tipo JWT no se puede revocar sin consultar la base de todas
 * formas, y aquí hacen falta tres cosas que lo exigen: cierre por inactividad,
 * cierre absoluto y revocación desde la interfaz cuando un docente pierde el
 * teléfono. Con eso, el JWT no aporta nada y sí quita control.
 *
 * En la tabla se guarda el SHA-256 del token, nunca el token. Una fuga de la base
 * no entrega sesiones activas, igual que no entrega contraseñas.
 */
export const sesiones = sqliteTable("sesiones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull(),
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  creadaEn: integer("creada_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  /** Mueve el cierre por inactividad. Se actualiza con throttle, no en cada petición. */
  ultimaActividadEn: integer("ultima_actividad_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  /** Cierre absoluto: 12 h desde el inicio, pase lo que pase. */
  expiraEn: integer("expira_en", { mode: "timestamp" }).notNull(),
  revocadaEn: integer("revocada_en", { mode: "timestamp" }),
  ip: text("ip"),
  navegador: text("navegador"),
}, (t) => [
  uniqueIndex("ux_sesiones_token").on(t.tokenHash),
  index("ix_sesiones_usuario").on(t.usuarioId),
  index("ix_sesiones_expira").on(t.expiraEn),
]);

/**
 * Intentos de acceso, para limitar fuerza bruta.
 *
 * Se registran los exitosos también: "alguien entró a mi cuenta a las 3 a.m." es
 * una pregunta que el director va a querer poder responder.
 */
export const intentosLogin = sqliteTable("intentos_login", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  ip: text("ip"),
  exito: integer("exito", { mode: "boolean" }).notNull(),
  motivo: text("motivo"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_intentos_email_fecha").on(t.email, t.creadoEn),
  index("ix_intentos_ip_fecha").on(t.ip, t.creadoEn),
]);
