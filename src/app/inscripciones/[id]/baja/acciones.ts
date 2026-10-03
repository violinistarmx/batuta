"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { darDeBaja } from "@/lib/datos/bajas";
import { valorEntero } from "@/lib/datos/ajustes";
import { hoyEnMexico } from "@/lib/zona";

export type EstadoBaja = { error?: string };

const Baja = z.object({
  inscripcionId: z.coerce.number().int().positive(),
  fechaAviso: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del aviso."),
  motivo: z.string().trim().min(5, "Escribe por qué se va. En tres meses nadie se acuerda.").max(500),
});

export async function confirmarBaja(
  _previo: EstadoBaja,
  datos: FormData,
): Promise<EstadoBaja> {
  const sesion = await exigirPermiso("inscripciones.baja");

  const parsed = Baja.safeParse({
    inscripcionId: datos.get("inscripcionId"),
    fechaAviso: datos.get("fechaAviso"),
    motivo: datos.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { inscripcionId, fechaAviso, motivo } = parsed.data;

  // Un aviso futuro dejaría la baja programada para algo que todavía no ocurre.
  if (fechaAviso > hoyEnMexico()) return { error: "El aviso no puede ser de un día que no ha llegado." };

  const horasAviso = valorEntero("horas_aviso_baja", 72);

  let r: { fechaEfectiva: string; clasesCanceladas: number; condonadoCentavos: number };
  try {
    r = darDeBaja(inscripcionId, fechaAviso, horasAviso, motivo, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dar la baja." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inscripcion.baja",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    cambios: {
      fechaAviso,
      fechaEfectiva: r.fechaEfectiva,
      motivo,
      clasesCanceladas: r.clasesCanceladas,
      condonadoCentavos: r.condonadoCentavos,
    },
  });

  redirect(`/inscripciones/${inscripcionId}`);
}
