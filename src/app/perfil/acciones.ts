"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSesion } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { cambiarPasswordPropia } from "@/lib/datos/usuarios";

const Cambio = z.object({
  actual: z.string().max(128),
  nueva: z.string().max(128),
  repetida: z.string().max(128),
});

export type EstadoPerfil = { error?: string; ok?: string };

export async function cambiarMiPassword(
  _previo: EstadoPerfil,
  datos: FormData,
): Promise<EstadoPerfil> {
  const sesion = await exigirSesion();

  const parsed = Cambio.safeParse({
    actual: datos.get("actual") ?? "",
    nueva: datos.get("nueva") ?? "",
    repetida: datos.get("repetida") ?? "",
  });
  if (!parsed.success) return { error: "Revisa los datos." };

  try {
    await cambiarPasswordPropia(
      sesion.usuarioId,
      parsed.data.actual,
      parsed.data.nueva,
      parsed.data.repetida,
      sesion.sesionId,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar." };
  }

  // La contraseña NUNCA entra a la bitácora, ni la vieja ni la nueva: solo el hecho.
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "usuario.editar",
    entidad: "usuarios",
    entidadId: sesion.usuarioId,
    cambios: { passwordCambiada: true },
  });

  revalidatePath("/perfil");
  return { ok: "Contraseña cambiada. Las demás sesiones se cerraron." };
}
