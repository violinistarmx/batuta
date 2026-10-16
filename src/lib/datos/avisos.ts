import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import { avisos, roles, usuarios } from "@/db/schema/index";

/** Cuántos avisos no ha leído esta persona. Alimenta la campana y el banner. */
export function avisosSinLeer(usuarioId: number): number {
  const fila = db.select({ n: sql<number>`count(*)` }).from(avisos)
    .where(and(eq(avisos.destinatarioId, usuarioId), isNull(avisos.leidoEn)))
    .get();
  return fila?.n ?? 0;
}

/** La bandeja de una persona, los más recientes primero. Lee el nombre de quien lo envió. */
export function bandejaDe(usuarioId: number) {
  const remitente = alias(usuarios, "remitente");
  return db
    .select({
      id: avisos.id,
      asunto: avisos.asunto,
      cuerpo: avisos.cuerpo,
      creadoEn: avisos.creadoEn,
      leidoEn: avisos.leidoEn,
      remitente: remitente.nombre,
    })
    .from(avisos)
    .innerJoin(remitente, eq(remitente.id, avisos.remitenteId))
    .where(eq(avisos.destinatarioId, usuarioId))
    .orderBy(desc(avisos.creadoEn), desc(avisos.id))
    .limit(100)
    .all();
}

/** Maestros con cuenta activa: los únicos a quienes se les puede escribir. */
export function docentesActivos() {
  return db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .where(and(eq(roles.clave, "docente"), eq(usuarios.activo, true)))
    .orderBy(usuarios.nombre)
    .all();
}

/** Un renglón por destinatario, en una sola transacción: o llegan todos o ninguno. */
export function crearAvisos(
  remitenteId: number,
  destinatarioIds: readonly number[],
  asunto: string,
  cuerpo: string,
): void {
  db.transaction((tx) => {
    for (const destinatarioId of destinatarioIds) {
      tx.insert(avisos).values({ remitenteId, destinatarioId, asunto, cuerpo }).run();
    }
  });
}

/** Marca como leídos los avisos que todavía no lo estaban. */
export function marcarAvisosLeidos(usuarioId: number): void {
  db.update(avisos)
    .set({ leidoEn: new Date() })
    .where(and(eq(avisos.destinatarioId, usuarioId), isNull(avisos.leidoEn)))
    .run();
}
