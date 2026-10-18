"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { cambiarTarifa } from "@/lib/datos/tarifas";

export type EstadoTarifa = { error?: string; ok?: string };

const Esquema = z.object({
  docenteId: z.coerce.number().int().positive(),
  tarifa: z.string().trim().transform((s) => (s === "" ? null : Math.round(Number(s) * 100)))
    .refine((n) => n === null || (Number.isFinite(n) && n > 0 && n <= 1_000_000), "Escribe una tarifa válida."),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige desde qué fecha aplica."),
});

/**
 * Cambia la tarifa por hora de un maestro a partir de una fecha. Las clases
 * anteriores conservan la tarifa de su día; las partidas de nómina ya generadas no
 * se recalculan (llevan su tarifa congelada).
 */
export async function cambiarTarifaAccion(_prev: EstadoTarifa, datos: FormData): Promise<EstadoTarifa> {
  const sesion = await exigirPermiso("nomina.leer");
  const p = Esquema.safeParse({
    docenteId: datos.get("docenteId"), tarifa: datos.get("tarifa"), desde: datos.get("desde"),
  });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisa los datos." };

  let anterior: number | null;
  try {
    ({ anterior } = cambiarTarifa(p.data.docenteId, p.data.tarifa, p.data.desde, sesion.usuarioId));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar la tarifa." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "tarifa.cambiar",
    entidad: "tarifas_docente",
    entidadId: p.data.docenteId,
    cambios: { tarifaHoraCentavos: [anterior, p.data.tarifa], vigenteDesde: [null, p.data.desde] },
  });
  revalidatePath("/finanzas/tarifas");
  revalidatePath("/finanzas");
  return {
    ok: p.data.tarifa === null
      ? `Desde el ${p.data.desde} usa la tarifa del programa o la general.`
      : `Desde el ${p.data.desde}: $${(p.data.tarifa / 100).toFixed(2)} por hora.`,
  };
}
