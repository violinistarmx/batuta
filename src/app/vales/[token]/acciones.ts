"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { entregarVale } from "@/lib/datos/vales";

export type EstadoEntrega = { error?: string; ok?: string };

const Esquema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  motivo: z.string().trim().max(300).transform((s) => (s === "" ? null : s)),
});

/**
 * Confirma la entrega. Solo desde un botón con sesión: escanear el QR nunca llega aquí.
 * Las reglas (ya entregado, cancelado, sin pagar, excepción) viven en `resolverEntrega`.
 */
export async function entregarValeAccion(_previo: EstadoEntrega, datos: FormData): Promise<EstadoEntrega> {
  const sesion = await exigirPermiso("vales.entregar");
  const p = Esquema.safeParse({ token: datos.get("token"), motivo: datos.get("motivo") ?? "" });
  if (!p.success) return { error: "No se encontró el vale." };

  const r = entregarVale(
    p.data.token,
    { id: sesion.usuarioId, puedeAutorizarExcepcion: tienePermiso(sesion, "vales.autorizar_excepcion") },
    p.data.motivo,
  );
  if (!r.ok) return { error: r.mensaje };

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "vale.entregar",
    entidad: "vales_entrega",
    entidadId: r.valeId,
    cambios: {
      codigo: r.codigo,
      ...(r.conExcepcion ? { excepcion: true, motivo: p.data.motivo } : {}),
    },
  });

  revalidatePath(`/vales/${p.data.token}`);
  revalidatePath("/entregas");
  return { ok: r.conExcepcion ? "Entrega registrada con excepción." : "Entrega registrada." };
}
