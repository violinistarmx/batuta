import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { usuarios } from "./personas";

/**
 * Avisos internos de la dirección a los maestros. Son distintos de la comunicación
 * con familias por WhatsApp (`comunicacion`): aquí nadie sale del sistema.
 *
 * Un aviso por destinatario: si se manda a todos los maestros, se crean tantas
 * filas como maestros. Así cada quien lo marca como leído por separado y la
 * campana cuenta solo lo que le falta a esa persona.
 *
 * `grupo` une los renglones de un mismo envío. Los adjuntos cuelgan del grupo y
 * no de cada renglón: un PDF de 10 MB se guarda una sola vez aunque vayan a
 * veinte maestros.
 */
export const avisos = sqliteTable("avisos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  remitenteId: integer("remitente_id").notNull().references(() => usuarios.id),
  destinatarioId: integer("destinatario_id").notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  grupo: text("grupo"),
  asunto: text("asunto").notNull(),
  cuerpo: text("cuerpo").notNull(),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  leidoEn: integer("leido_en", { mode: "timestamp" }),
}, (t) => [
  index("ix_avisos_destinatario").on(t.destinatarioId, t.leidoEn),
  index("ix_avisos_grupo").on(t.grupo),
]);

/**
 * Archivos adjuntos de un envío (PDF, JPG o PNG). Viven en el almacén, fuera de
 * `public/`: se descargan solo por `/api/avisos/[id]`, que verifica que quien pide
 * sea remitente o destinatario del envío.
 */
export const avisosAdjuntos = sqliteTable("avisos_adjuntos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grupo: text("grupo").notNull(),
  nombreOriginal: text("nombre_original").notNull(),
  tipoMime: text("tipo_mime").notNull(),
  bytes: integer("bytes").notNull(),
  hashSha256: text("hash_sha256").notNull(),
  ruta: text("ruta").notNull(),
  subidoPor: integer("subido_por").notNull().references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("ix_avisos_adjuntos_grupo").on(t.grupo)]);
