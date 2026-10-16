"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { alumnosTutores, tutores } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";

const Datos = z.object({
  alumnoId: z.coerce.number().int().positive(),
  tutorId: z.coerce.number().int().positive(),
  tratamiento: z.enum(["", "Sr.", "Sra."]),
});

/**
 * Fija cómo se saluda a un tutor (Sr. / Sra. / sin especificar). Solo se acepta
 * si el tutor está vinculado a ese alumno: la ficha no edita tutores ajenos.
 */
export async function fijarTratamientoTutor(datos: FormData): Promise<void> {
  const sesion = await exigirPermiso("alumnos.editar");
  const d = Datos.parse({
    alumnoId: datos.get("alumnoId"),
    tutorId: datos.get("tutorId"),
    tratamiento: datos.get("tratamiento") ?? "",
  });

  const vinculo = db.select({ tutorId: alumnosTutores.tutorId }).from(alumnosTutores)
    .where(and(eq(alumnosTutores.alumnoId, d.alumnoId), eq(alumnosTutores.tutorId, d.tutorId)))
    .get();
  if (!vinculo) throw new Error("Ese tutor no está vinculado a este alumno.");

  const anterior = db.select({ tratamiento: tutores.tratamiento }).from(tutores)
    .where(eq(tutores.id, d.tutorId)).get();
  const nuevo = d.tratamiento === "" ? null : d.tratamiento;

  db.update(tutores).set({ tratamiento: nuevo }).where(eq(tutores.id, d.tutorId)).run();

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "tutor.editar",
    entidad: "tutores",
    entidadId: d.tutorId,
    cambios: { tratamiento: [anterior?.tratamiento ?? null, nuevo] },
  });

  revalidatePath(`/alumnos/${d.alumnoId}`);
}
