"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso, exigirSesionUsable } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { crearAvisos, docentesActivos, marcarAvisosLeidos } from "@/lib/datos/avisos";

export type EstadoAviso = { error?: string; ok?: string };

const Aviso = z.object({
  destino: z.string().trim().min(1, "Elige a quién va el aviso."),
  asunto: z.string().trim().min(3, "El asunto necesita al menos 3 letras.").max(120),
  cuerpo: z.string().trim().min(5, "Escribe el mensaje.").max(2000),
});

/**
 * Envía un aviso a un maestro o a todos. El destino se valida contra los maestros
 * con cuenta activa: no se puede escribir a una cuenta de director o de asistente
 * por este medio.
 */
export async function enviarAvisoAccion(
  _previo: EstadoAviso,
  datos: FormData,
): Promise<EstadoAviso> {
  const sesion = await exigirPermiso("avisos.enviar");

  const parsed = Aviso.safeParse({
    destino: datos.get("destino") ?? "",
    asunto: datos.get("asunto") ?? "",
    cuerpo: datos.get("cuerpo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { destino, asunto, cuerpo } = parsed.data;

  const maestros = docentesActivos();
  const destinatarios =
    destino === "todos"
      ? maestros.map((m) => m.id)
      : maestros.some((m) => String(m.id) === destino)
        ? [Number(destino)]
        : [];
  if (destinatarios.length === 0) return { error: "Elige un maestro activo o «Todos»." };

  crearAvisos(sesion.usuarioId, destinatarios, asunto, cuerpo);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "mensaje.enviar",
    entidad: "avisos",
    cambios: { destinatarios: destinatarios.length, asunto },
  });

  revalidatePath("/", "layout");
  return {
    ok: destinatarios.length === 1
      ? "Aviso enviado."
      : `Aviso enviado a ${destinatarios.length} maestros.`,
  };
}

/** Lo llama la propia bandeja al abrirse: lo que se ve ahí ya se considera leído. */
export async function marcarAvisosLeidosAccion(): Promise<void> {
  const sesion = await exigirSesionUsable();
  marcarAvisosLeidos(sesion.usuarioId);
  revalidatePath("/", "layout");
}
