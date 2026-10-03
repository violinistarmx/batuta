"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  crearBorrador, editarBorrador, moverMensaje, prepararDesdePlantilla,
} from "@/lib/datos/comunicacion";

const texto = (max = 4000) =>
  z.string().trim().max(max).optional().transform((s) => (!s ? null : s));

/**
 * Cuerpo del mensaje, con los saltos de línea normalizados.
 *
 * Al enviar un formulario, el navegador convierte los saltos de un textarea a CRLF
 * aunque la caja contuviera LF. Guardarlo tal cual hace que el texto aprobado no sea
 * byte a byte el que se redactó, y cualquier comparación posterior —una prueba, un
 * cotejo contra la plantilla— falla por una diferencia que nadie puede ver.
 */
const cuerpoDelMensaje = z.string()
  .transform((s) => s.replace(/\r\n/g, "\n").trim())
  .refine((s) => s.length > 0, "El mensaje está vacío.")
  .refine((s) => s.length <= 4000, "El mensaje es demasiado largo.");

export type EstadoMensajeUI = { error?: string; ok?: string };

// --------------------------------------------------------------- redactar ---

const Redactar = z.object({
  plantillaId: z.coerce.number().int().positive(),
  alumnoId: z.string().trim().optional().transform((s) => (!s ? null : Number(s))),
  prospectoId: z.string().trim().optional().transform((s) => (!s ? null : Number(s))),
  cuerpo: cuerpoDelMensaje,
  telefono: texto(20),
  destinatario: z.string().trim().min(1, "Falta a quién va dirigido."),
});

export async function guardarBorrador(
  _previo: EstadoMensajeUI,
  datos: FormData,
): Promise<EstadoMensajeUI> {
  const sesion = await exigirPermiso("comunicacion.redactar");

  const parsed = Redactar.safeParse({
    plantillaId: datos.get("plantillaId"),
    alumnoId: datos.get("alumnoId") ?? "",
    prospectoId: datos.get("prospectoId") ?? "",
    cuerpo: datos.get("cuerpo"),
    telefono: datos.get("telefono") ?? "",
    destinatario: datos.get("destinatario"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  let id: number;
  try {
    id = crearBorrador({
      plantillaId: d.plantillaId,
      alumnoId: d.alumnoId,
      prospectoId: d.prospectoId,
      destinatario: d.destinatario,
      telefono: d.telefono,
      canal: "whatsapp",
      asunto: null,
      cuerpo: d.cuerpo,
    }, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "mensaje.redactar",
    entidad: "mensajes",
    entidadId: id,
    cambios: { destinatario: d.destinatario, plantillaId: d.plantillaId },
  });

  redirect(`/comunicacion/${id}`);
}

/** Vuelve a renderizar la plantilla sin guardar: alimenta la vista previa. */
export async function previsualizar(
  plantillaId: number,
  origen: { alumnoId?: number; prospectoId?: number },
  extra: Record<string, string>,
) {
  await exigirPermiso("comunicacion.redactar");
  const r = prepararDesdePlantilla(plantillaId, origen, extra);
  return { texto: r.texto, faltantes: r.faltantes, destinatario: r.contexto.destinatario,
           telefono: r.contexto.telefono };
}

// ------------------------------------------------------------------ editar ---

const Editar = z.object({
  id: z.coerce.number().int().positive(),
  cuerpo: cuerpoDelMensaje,
  telefono: texto(20),
});

export async function guardarEdicion(
  _previo: EstadoMensajeUI,
  datos: FormData,
): Promise<EstadoMensajeUI> {
  const sesion = await exigirPermiso("comunicacion.redactar");
  const parsed = Editar.safeParse({
    id: datos.get("id"), cuerpo: datos.get("cuerpo"), telefono: datos.get("telefono") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    editarBorrador(parsed.data.id, parsed.data.cuerpo, parsed.data.telefono);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "mensaje.redactar",
    entidad: "mensajes",
    entidadId: parsed.data.id,
    cambios: { editado: true },
  });

  revalidatePath(`/comunicacion/${parsed.data.id}`);
  return { ok: "Borrador actualizado." };
}

// ------------------------------------------------------- aprobar y enviar ---

const Mover = z.object({
  id: z.coerce.number().int().positive(),
  hacia: z.enum(["aprobado", "rechazado", "enviado", "cancelado", "borrador"]),
  motivoRechazo: texto(300),
  notaEnvio: texto(300),
});

export async function mover(
  _previo: EstadoMensajeUI,
  datos: FormData,
): Promise<EstadoMensajeUI> {
  // Redactar y aprobar son permisos distintos a propósito: quien prepara el
  // mensaje no es necesariamente quien autoriza que salga.
  const hacia = String(datos.get("hacia") ?? "");
  const sesion = await exigirPermiso(
    hacia === "borrador" ? "comunicacion.redactar" : "comunicacion.aprobar",
  );

  const parsed = Mover.safeParse({
    id: datos.get("id"),
    hacia: datos.get("hacia"),
    motivoRechazo: datos.get("motivoRechazo") ?? "",
    notaEnvio: datos.get("notaEnvio") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  try {
    moverMensaje(d.id, d.hacia, sesion.usuarioId, {
      motivoRechazo: d.motivoRechazo, notaEnvio: d.notaEnvio,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el estado." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: d.hacia === "enviado" ? "mensaje.enviar"
      : d.hacia === "aprobado" ? "mensaje.aprobar" : "mensaje.rechazar",
    entidad: "mensajes",
    entidadId: d.id,
    cambios: { hacia: d.hacia, motivoRechazo: d.motivoRechazo },
  });

  revalidatePath(`/comunicacion/${d.id}`);
  revalidatePath("/comunicacion");
  return { ok: `Mensaje ${d.hacia}.` };
}
