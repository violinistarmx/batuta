import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { panelesFinanzas } from "@/db/schema/index";
import { leerDiseno, validarDiseno, type Diseno } from "@/lib/finanzas/diseno";

/** El diseño del dashboard de un usuario, o el inicial si nunca lo personalizó. */
export function disenoDe(usuarioId: number): Diseno {
  const fila = db.select({ diseno: panelesFinanzas.diseno }).from(panelesFinanzas)
    .where(eq(panelesFinanzas.usuarioId, usuarioId)).get();
  return leerDiseno(fila?.diseno);
}

/** Guarda el diseño ya validado. */
export function guardarDiseno(usuarioId: number, crudo: unknown): Diseno {
  const d = validarDiseno(crudo);
  const json = JSON.stringify(d);
  db.insert(panelesFinanzas).values({ usuarioId, diseno: json, actualizadoEn: new Date() })
    .onConflictDoUpdate({ target: panelesFinanzas.usuarioId, set: { diseno: json, actualizadoEn: new Date() } })
    .run();
  return d;
}

export function borrarDiseno(usuarioId: number): void {
  db.delete(panelesFinanzas).where(eq(panelesFinanzas.usuarioId, usuarioId)).run();
}
