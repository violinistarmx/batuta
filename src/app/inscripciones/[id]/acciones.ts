"use server";

import { revalidatePath } from "next/cache";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { sincronizarDescripcionFamiliar } from "@/lib/datos/finanzas";
import { asignarResponsableDelPlan, cambiarProgramaDelPlan, inscripcionPorId } from "@/lib/datos/inscripciones";

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

export type EstadoCambioPlan = { error?: string; ok?: string };

/**
 * Cambia el plan familiar a otro programa: típicamente de Duet de 2 a Duet de 3 cuando la
 * familia suma un integrante. Ver cambiarProgramaDelPlan para lo que mueve y lo que no.
 */
export async function cambiarPlan(
  _previo: EstadoCambioPlan,
  datos: FormData,
): Promise<EstadoCambioPlan> {
  const sesion = await exigirPermiso("inscripciones.crear");
  const inscripcionId = Number(datos.get("inscripcionId"));
  const programaId = Number(datos.get("programaId"));
  if (!Number.isInteger(inscripcionId) || !Number.isInteger(programaId) || programaId <= 0) {
    return { error: "Elige el programa al que pasa el plan." };
  }
  if (!inscripcionPorId(inscripcionId, alcanceDe(sesion))) return { error: "No se encontró la inscripción." };

  let r: ReturnType<typeof cambiarProgramaDelPlan>;
  try {
    r = cambiarProgramaDelPlan(inscripcionId, programaId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el plan." };
  }
  // El cargo nombra el programa y a quiénes cubre: se reescribe con el programa nuevo.
  sincronizarDescripcionFamiliar(inscripcionId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inscripcion.cambiar_programa",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    cambios: {
      programa: [r.de, r.a],
      precioCentavos: [r.precioAntesCentavos, r.precioDespuesCentavos],
      alumnos: r.miembros,
    },
  });

  revalidatePath(`/inscripciones/${inscripcionId}`);
  return { ok: `Listo: el plan ahora es «${r.a}».` };
}
