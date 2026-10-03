import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { intentosLogin } from "@/db/schema/index";

/**
 * Límite de intentos de acceso.
 *
 * Dos ventanas distintas a propósito: por correo protege una cuenta concreta de
 * que le adivinen la contraseña; por IP protege al sistema de que alguien recorra
 * muchos correos desde el mismo lugar. Un atacante que rote correos evade la
 * primera pero no la segunda.
 */

const VENTANA_MS = 15 * 60 * 1000;
const MAX_POR_EMAIL = 5;
const MAX_POR_IP = 20;

export type Veredicto = { permitido: true } | { permitido: false; minutosEspera: number };

export function evaluarIntentos(email: string, ip: string | null): Veredicto {
  const desde = new Date(Date.now() - VENTANA_MS);

  const porEmail = db
    .select({ n: sql<number>`count(*)` })
    .from(intentosLogin)
    .where(and(
      eq(intentosLogin.email, email.toLowerCase()),
      eq(intentosLogin.exito, false),
      gt(intentosLogin.creadoEn, desde),
    ))
    .get();

  if ((porEmail?.n ?? 0) >= MAX_POR_EMAIL) {
    return { permitido: false, minutosEspera: Math.ceil(VENTANA_MS / 60000) };
  }

  if (ip) {
    const porIp = db
      .select({ n: sql<number>`count(*)` })
      .from(intentosLogin)
      .where(and(
        eq(intentosLogin.ip, ip),
        eq(intentosLogin.exito, false),
        gt(intentosLogin.creadoEn, desde),
      ))
      .get();

    if ((porIp?.n ?? 0) >= MAX_POR_IP) {
      return { permitido: false, minutosEspera: Math.ceil(VENTANA_MS / 60000) };
    }
  }

  return { permitido: true };
}

export function registrarIntento(
  email: string,
  ip: string | null,
  exito: boolean,
  motivo?: string,
): void {
  db.insert(intentosLogin).values({
    email: email.toLowerCase(),
    ip,
    exito,
    motivo: motivo ?? null,
  }).run();
}

/** Tras un acceso correcto se limpia el contador de esa cuenta. */
export function limpiarIntentosDe(email: string): void {
  db.delete(intentosLogin)
    .where(and(eq(intentosLogin.email, email.toLowerCase()), eq(intentosLogin.exito, false)))
    .run();
}
