"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { generarMensualidad, sincronizarDescripcionFamiliar } from "@/lib/datos/finanzas";
import {
  cicloAbiertoDe, crearInscripcion, inscripcionPorId, renovarCiclo,
} from "@/lib/datos/inscripciones";

const Inscripcion = z.object({
  alumnoId: z.coerce.number().int().positive(),
  programaId: z.coerce.number().int().positive("Elige un programa."),
  instrumentoId: z.coerce.number().int().positive("Elige un instrumento."),
  docenteId: z.coerce.number().int().positive("Asigna un maestro."),
  fechaInicio: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de inicio."),
  notas: z.string().trim().max(500).transform((s) => (s === "" ? null : s)),
  /** Plan familiar al que se suma. Vacío = individual o titular de uno nuevo. */
  cubiertaPorId: z.string().trim().transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Plan familiar inválido."),
});

export type EstadoInscripcion = { error?: string };

export async function inscribir(
  _previo: EstadoInscripcion,
  datos: FormData,
): Promise<EstadoInscripcion> {
  const sesion = await exigirPermiso("inscripciones.crear");

  const parsed = Inscripcion.safeParse({
    alumnoId: datos.get("alumnoId"),
    programaId: datos.get("programaId"),
    instrumentoId: datos.get("instrumentoId"),
    docenteId: datos.get("docenteId"),
    fechaInicio: datos.get("fechaInicio"),
    notas: datos.get("notas") ?? "",
    cubiertaPorId: datos.get("cubiertaPorId") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const d = parsed.data;

  // El alcance se verifica antes de escribir: un docente no puede inscribir a un
  // alumno que no es suyo aunque conozca su id.
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) {
    return { error: "No se encontró el alumno." };
  }

  let inscripcionId: number;
  try {
    inscripcionId = crearInscripcion(d, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la inscripción." };
  }

  // Abrir un período genera su mensualidad. Sin esto, el alumno queda con clases
  // emitidas y sin nada que cobrar, y el reporte de adeudos miente.
  const ciclo = cicloAbiertoDe(inscripcionId);
  if (ciclo) generarMensualidad(ciclo.id, sesion.usuarioId);

  // Al entrar un hermano, el cargo del titular deja de nombrar a la familia completa.
  if (d.cubiertaPorId !== null) sincronizarDescripcionFamiliar(d.cubiertaPorId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inscripcion.crear",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    cambios: {
      alumnoId: d.alumnoId,
      programaId: d.programaId,
      instrumentoId: d.instrumentoId,
      docenteId: d.docenteId,
      fechaInicio: d.fechaInicio,
      cubiertaPorId: d.cubiertaPorId,
    },
  });

  redirect(`/inscripciones/${inscripcionId}`);
}

export type EstadoRenovacion = { error?: string };

export async function renovar(
  _previo: EstadoRenovacion,
  datos: FormData,
): Promise<EstadoRenovacion> {
  const sesion = await exigirPermiso("inscripciones.crear");
  const id = Number(datos.get("inscripcionId"));
  if (!Number.isInteger(id)) return { error: "Inscripción inválida." };

  if (!inscripcionPorId(id, alcanceDe(sesion))) return { error: "No se encontró la inscripción." };

  let cicloId: number;
  try {
    cicloId = renovarCiclo(id, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo renovar." };
  }

  generarMensualidad(cicloId, sesion.usuarioId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "ciclo.renovar",
    entidad: "ciclos",
    entidadId: cicloId,
    cambios: { inscripcionId: id },
  });

  redirect(`/inscripciones/${id}`);
}
