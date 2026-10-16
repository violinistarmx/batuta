"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso, exigirSesionUsable } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { docentesActivos, enviarAviso, marcarAvisosLeidos, type ArchivoNuevo } from "@/lib/datos/avisos";
import { validarArchivo } from "@/lib/dominio/archivos";

export type EstadoAviso = { error?: string; ok?: string };

/** Cuántos archivos puede llevar un solo envío. */
const MAXIMO_ARCHIVOS = 3;

const Aviso = z.object({
  destino: z.string().trim().min(1, "Elige a quién va el aviso."),
  asunto: z.string().trim().min(3, "El asunto necesita al menos 3 letras.").max(120),
  cuerpo: z.string().trim().min(5, "Escribe el mensaje.").max(2000),
});

/**
 * Envía un aviso a un maestro o a todos, con hasta tres archivos (PDF, JPG o PNG).
 *
 * El destino se valida contra los maestros con cuenta activa: no se puede escribir
 * a una cuenta de director o de asistente por este medio. Los archivos se validan
 * todos antes de guardar nada: si uno no sirve, no se envía nada.
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

  const subidos = datos.getAll("archivos").filter(
    (x): x is File => x instanceof File && x.size > 0,
  );
  if (subidos.length > MAXIMO_ARCHIVOS) {
    return { error: `Puedes adjuntar hasta ${MAXIMO_ARCHIVOS} archivos por aviso.` };
  }

  // Validar todos antes de guardar: un archivo malo no deja a medias el envío.
  const archivos: ArchivoNuevo[] = [];
  for (const f of subidos) {
    const v = validarArchivo(f.type, f.size);
    if (!v.ok) return { error: `«${f.name}»: ${v.razon}` };
    archivos.push({
      nombre: f.name,
      tipo: v.tipo,
      contenido: Buffer.from(await f.arrayBuffer()),
    });
  }

  await enviarAviso({
    remitenteId: sesion.usuarioId,
    destinatarioIds: destinatarios,
    asunto,
    cuerpo,
    archivos,
  });

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "mensaje.enviar",
    entidad: "avisos",
    cambios: { destinatarios: destinatarios.length, asunto, archivos: archivos.length },
  });

  revalidatePath("/", "layout");
  const plural = destinatarios.length === 1 ? "" : `a ${destinatarios.length} maestros`;
  return { ok: plural ? `Aviso enviado ${plural}.` : "Aviso enviado." };
}

/** Lo llama la propia bandeja al abrirse: lo que se ve ahí ya se considera leído. */
export async function marcarAvisosLeidosAccion(): Promise<void> {
  const sesion = await exigirSesionUsable();
  marcarAvisosLeidos(sesion.usuarioId);
  revalidatePath("/", "layout");
}
