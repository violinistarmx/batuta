"use server";

import { revalidatePath } from "next/cache";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { asignarResponsableDelPlan, inscripcionPorId } from "@/lib/datos/inscripciones";

export type EstadoResponsable = { error?: string; ok?: string };

/**
 * Pasa un plan familiar de un titular menor a su tutor responsable de pago. Pensado para los
 * planes abiertos antes de que el titular fuera el adulto que paga. Ver asignarResponsableDelPlan.
 */
export async function asignarResponsable(
  _previo: EstadoResponsable,
  datos: FormData,
): Promise<EstadoResponsable> {
  const sesion = await exigirPermiso("inscripciones.crear");
  const inscripcionId = Number(datos.get("inscripcionId"));
  const tutorId = Number(datos.get("tutorId"));
  if (!Number.isInteger(inscripcionId) || !Number.isInteger(tutorId) || tutorId <= 0) {
    return { error: "Elige al tutor responsable del pago." };
  }
  if (!inscripcionPorId(inscripcionId, alcanceDe(sesion))) return { error: "No se encontró la inscripción." };

  let resultado: { cargosMovidos: number; cuentaId: number };
  try {
    resultado = asignarResponsableDelPlan(inscripcionId, tutorId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo asignar el responsable." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inscripcion.responsable_pago",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    cambios: { tutorId, cuentaId: resultado.cuentaId, cargosMovidos: resultado.cargosMovidos },
  });

  revalidatePath(`/inscripciones/${inscripcionId}`);
  return {
    ok: resultado.cargosMovidos > 0
      ? "Listo. El plan y su mensualidad vigente pasaron a la cuenta del responsable."
      : "Listo. Desde el próximo período el plan se le cargará al responsable; lo ya cobrado no cambia.",
  };
}
