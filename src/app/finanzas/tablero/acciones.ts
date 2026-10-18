"use server";

import { revalidatePath } from "next/cache";

import { exigirPermiso } from "@/lib/auth/permisos";
import { borrarDiseno, guardarDiseno } from "@/lib/datos/paneles";
import type { Diseno } from "@/lib/finanzas/diseno";

/**
 * Guarda el diseño del dashboard del usuario que lo edita. Cada quien tiene el
 * suyo; el servidor lo valida antes de guardarlo (nunca confía en el navegador).
 */
export async function guardarDisenoAccion(crudo: unknown): Promise<{ ok: boolean; diseno?: Diseno; error?: string }> {
  const sesion = await exigirPermiso("finanzas.leer");
  if (JSON.stringify(crudo ?? null).length > 20_000) return { ok: false, error: "Diseño demasiado grande." };
  const diseno = guardarDiseno(sesion.usuarioId, crudo);
  revalidatePath("/finanzas");
  return { ok: true, diseno };
}

export async function restablecerDisenoAccion(): Promise<{ ok: boolean }> {
  const sesion = await exigirPermiso("finanzas.leer");
  borrarDiseno(sesion.usuarioId);
  revalidatePath("/finanzas");
  return { ok: true };
}
