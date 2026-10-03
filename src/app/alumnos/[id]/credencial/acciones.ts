"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { registrarEntregaCredencial } from "@/lib/datos/estatus";
import { hoyEnMexico } from "@/lib/zona";

const Entrega = z.object({
  alumnoId: z.coerce.number().int().positive(),
  medio: z.enum(["whatsapp", "correo", "impresa", "en_persona"]),
});

const TEXTO: Record<string, string> = {
  whatsapp: "QR digital enviado por WhatsApp",
  correo: "QR digital enviado por correo",
  impresa: "Credencial impresa entregada",
  en_persona: "QR mostrado y registrado en la academia",
};

export type EstadoEntrega = { error?: string; ok?: string };

/**
 * Registra que la credencial ya llegó a su destinatario.
 *
 * Mientras el diseño de la credencial física siga pendiente, lo que se entrega es
 * el QR digital, y el sistema tiene que poder decir cuál de las dos cosas fue:
 * dentro de seis meses «entregada» a secas no distingue una tarjeta de un enlace.
 */
export async function registrarEntrega(
  _previo: EstadoEntrega,
  datos: FormData,
): Promise<EstadoEntrega> {
  const sesion = await exigirPermiso("alumnos.editar");

  const parsed = Entrega.safeParse({
    alumnoId: datos.get("alumnoId"),
    medio: datos.get("medio") ?? "whatsapp",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { alumnoId, medio } = parsed.data;
  if (!alumnoPorId(alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  const dias = Number(
    db.select().from(configuracion)
      .where(eq(configuracion.clave, "dias_entrega_credencial")).get()?.valor ?? 7,
  );

  try {
    registrarEntregaCredencial(alumnoId, sesion.usuarioId, TEXTO[medio] ?? medio, hoyEnMexico());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.editar",
    entidad: "credenciales",
    entidadId: alumnoId,
    cambios: { entregada: TEXTO[medio] ?? medio, plazoDias: dias },
  });

  revalidatePath(`/alumnos/${alumnoId}/credencial`);
  revalidatePath(`/alumnos/${alumnoId}`);
  revalidatePath("/");
  return { ok: "Entrega registrada. La alerta del tablero se apaga." };
}
