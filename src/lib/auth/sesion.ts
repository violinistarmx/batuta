import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "@/db";
import { roles, sesiones, usuarios } from "@/db/schema/index";
import { ABSOLUTO_MS, evaluarVigencia } from "./vigencia";

export const COOKIE = "batuta_sesion";

export type Sesion = {
  usuarioId: number;
  nombre: string;
  email: string;
  rol: "director" | "docente" | "asistente";
  sesionId: number;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crea la sesión y fija la cookie.
 *
 * El token se genera nuevo en cada inicio de sesión, así que no existe fijación:
 * un token que un atacante haya plantado antes del login nunca queda autenticado.
 */
export async function iniciarSesion(
  usuarioId: number,
  datos: { ip?: string | null; navegador?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const ahora = Date.now();

  const [fila] = db.insert(sesiones).values({
    tokenHash: hashToken(token),
    usuarioId,
    expiraEn: new Date(ahora + ABSOLUTO_MS),
    ip: datos.ip ?? null,
    navegador: datos.navegador ?? null,
  }).returning({ id: sesiones.id }).all();

  if (!fila) throw new Error("No se pudo crear la sesión.");

  const almacen = await cookies();
  almacen.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // La cookie vive lo que el cierre absoluto. La inactividad se evalúa en la base:
    // una caducidad de cookie no es una garantía, porque el cliente puede mentir.
    maxAge: Math.floor(ABSOLUTO_MS / 1000),
  });
}

/** Lee la sesión activa, o null. Es la única puerta de entrada a la identidad. */
export async function sesionActual(): Promise<Sesion | null> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE)?.value;
  if (!token) return null;

  const fila = db
    .select({
      sesionId: sesiones.id,
      usuarioId: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      activo: usuarios.activo,
      rol: roles.clave,
      expiraEn: sesiones.expiraEn,
      ultimaActividadEn: sesiones.ultimaActividadEn,
      revocadaEn: sesiones.revocadaEn,
    })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .where(and(eq(sesiones.tokenHash, hashToken(token)), isNull(sesiones.revocadaEn)))
    .get();

  if (!fila) return null;

  const estado = evaluarVigencia({
    expiraEn: fila.expiraEn,
    ultimaActividadEn: fila.ultimaActividadEn,
    revocadaEn: fila.revocadaEn,
    usuarioActivo: fila.activo,
  });

  if (!estado.vigente) {
    revocarPorId(fila.sesionId);
    return null;
  }

  if (estado.refrescarActividad) {
    db.update(sesiones).set({ ultimaActividadEn: new Date() })
      .where(eq(sesiones.id, fila.sesionId)).run();
  }

  return {
    usuarioId: fila.usuarioId,
    nombre: fila.nombre,
    email: fila.email,
    rol: fila.rol,
    sesionId: fila.sesionId,
  };
}

function revocarPorId(sesionId: number): void {
  db.update(sesiones).set({ revocadaEn: new Date() }).where(eq(sesiones.id, sesionId)).run();
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE)?.value;
  if (token) {
    db.update(sesiones).set({ revocadaEn: new Date() })
      .where(eq(sesiones.tokenHash, hashToken(token))).run();
  }
  almacen.delete(COOKIE);
}

/** Cierra todas las sesiones de un usuario. Para cambio de contraseña o robo de equipo. */
export function revocarSesionesDe(usuarioId: number): number {
  const r = db.update(sesiones).set({ revocadaEn: new Date() })
    .where(and(eq(sesiones.usuarioId, usuarioId), isNull(sesiones.revocadaEn))).run();
  return r.changes;
}
