"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { exigirSesionUsable } from "@/lib/auth/permisos";
import { COOKIE_TEMA, temaValido, type Tema } from "@/lib/tema";

/** Guarda el tema de esta persona en su navegador. No toca nada de la academia. */
export async function cambiarTemaAccion(tema: Tema): Promise<void> {
  await exigirSesionUsable();
  (await cookies()).set(COOKIE_TEMA, temaValido(tema), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
