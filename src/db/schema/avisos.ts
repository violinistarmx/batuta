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
 */
export const avisos = sqliteTable("avisos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  remitenteId: integer("remitente_id").notNull().references(() => usuarios.id),
  destinatarioId: integer("destinatario_id").notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  asunto: text("asunto").notNull(),
  cuerpo: text("cuerpo").notNull(),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  leidoEn: integer("leido_en", { mode: "timestamp" }),
}, (t) => [index("ix_avisos_destinatario").on(t.destinatarioId, t.leidoEn)]);
