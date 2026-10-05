"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId, descartarAlumno } from "@/lib/datos/alumnos";

export type EstadoDescarte = { error?: string };

const Descarte = z.object({
  alumnoId: z.coerce.number().int().positive(),
  confirmacion: z.string().trim(),
});

export async function confirmarDescarte(
  _previo: EstadoDescarte,
  datos: FormData,
): Promise<EstadoDescarte> {
  const sesion = await exigirPermiso("alumnos.descartar");

  const parsed = Descarte.safeParse({
    alumnoId: datos.get("alumnoId"),
    confirmacion: datos.get("confirmacion"),
  });
  if (!parsed.success) return { error: "Revisa los datos." };

  const { alumnoId, confirmacion } = parsed.data;

  // Alcance "todo": solo el director tiene este permiso, así que no hace
  // falta filtrar por docente asignado.
  const alumno = alumnoPorId(alumnoId, { tipo: "todo" });
  if (!alumno) return { error: "Ese alumno no existe." };

  if (confirmacion.trim().toUpperCase() !== alumno.nombre.trim().toUpperCase()) {
    return { error: "Escribe el nombre exacto del alumno para confirmar." };
  }

  try {
    descartarAlumno(alumnoId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo descartar." };
  }

  // La bitácora no puede apuntar a un alumno que ya no existe: se guarda el
  // nombre y el folio en el detalle del cambio, no una referencia viva.
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.eliminar",
    entidad: "alumnos",
    entidadId: alumnoId,
    cambios: { nombre: alumno.nombre, codigo: alumno.codigo },
  });

  redirect("/alumnos");
}
