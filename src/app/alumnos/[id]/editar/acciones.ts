"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { alumnos, alumnosTutores, saludAlumno, tutores } from "@/db/schema/index";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { cifrarOpcional } from "@/lib/cifrado";
import { tutoresDe } from "@/lib/datos/alumnos";
import { esMenorDeEdad } from "@/lib/formato";

export type EstadoEdicion = { error?: string; campo?: string };

const texto = (max = 200) =>
  z.string().trim().max(max).transform((s) => (s === "" ? null : s));

const correo = z.string().trim().max(150)
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "Correo inválido.");

const ORIGENES = [
  "instagram", "facebook", "tiktok", "recomendacion", "whatsapp", "google", "paso_por_la_calle", "evento", "otro",
];

const Alumno = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo del alumno.").max(150),
  fechaNacimiento: z.string().trim()
    .transform((s) => (s === "" ? null : s))
    .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "Fecha de nacimiento inválida."),
  sexo: z.string().trim().transform((s) => (s === "" ? null : s))
    .refine((s) => s === null || ["F", "M", "otro", "no_especifica"].includes(s), "Valor inválido.")
    .transform((s) => s as "F" | "M" | "otro" | "no_especifica" | null),
  telefono: texto(20),
  email: correo,
  direccion: texto(250),
  colonia: texto(120),
  objetivoMusical: texto(500),
  experienciaPrevia: texto(500),
  observaciones: texto(1000),
  // Canal por el que llegó. Alimenta el costo de adquisición por canal.
  origen: z.string().trim().transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || ORIGENES.includes(v), "Origen inválido."),
});

const Tutor = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo del tutor.").max(150),
  parentesco: texto(60),
  telefono: texto(20),
  whatsapp: texto(20),
  email: correo,
});

const NuevoTutor = z.object({
  nombre: texto(150),
  parentesco: texto(60),
  telefono: texto(20),
  whatsapp: texto(20),
  email: correo,
});

const Salud = z.object({
  condicionSalud: texto(500),
  trastornoAprendizaje: texto(500),
  discapacidadSensorial: texto(500),
  medicamentos: texto(500),
  consideracionEmocional: texto(500),
  saludObservaciones: texto(1000),
});

/** Lee del formulario solo las claves pedidas. Lo que la pantalla no envía queda vacío. */
function leer(datos: FormData, claves: readonly string[]): Record<string, string> {
  return Object.fromEntries(claves.map((k) => [k, String(datos.get(k) ?? "")]));
}

const CLAVES_ALUMNO = Object.keys(Alumno.shape);
const CLAVES_SALUD = Object.keys(Salud.shape);
const CLAVES_TUTOR = Object.keys(Tutor.shape);
/** Nombre de cada campo del formulario para el tutor extra. */
const CAMPOS_NUEVO = {
  nombre: "nuevoNombre",
  parentesco: "nuevoParentesco",
  telefono: "nuevoTelefono",
  whatsapp: "nuevoWhatsapp",
  email: "nuevoEmail",
} as const;

function diferencias(antes: Record<string, unknown>, despues: Record<string, unknown>) {
  const cambios: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(despues)) {
    if ((antes[k] ?? null) !== (despues[k] ?? null)) cambios[k] = [antes[k] ?? null, despues[k] ?? null];
  }
  return cambios;
}

/**
 * Corrige los datos de un alumno ya dado de alta: datos generales, objetivo y
 * experiencia, tutores vinculados y, si el usuario tiene ambos permisos, la ficha
 * de salud. Cada bloque se valida antes de escribir nada.
 */
export async function editarAlumnoAccion(_previo: EstadoEdicion, datos: FormData): Promise<EstadoEdicion> {
  const sesion = await exigirPermiso("alumnos.editar");

  const alumnoId = Number(datos.get("alumnoId"));
  if (!Number.isInteger(alumnoId) || alumnoId <= 0) return { error: "Alumno inválido." };

  const actual = db.select().from(alumnos).where(eq(alumnos.id, alumnoId)).get();
  if (!actual) return { error: "El alumno ya no existe." };

  const parsed = Alumno.safeParse(leer(datos, CLAVES_ALUMNO));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Revisa los datos.", campo: String(issue?.path[0] ?? "") };
  }
  const d = parsed.data;

  // Los tutores vinculados hoy: solo se toca lo que ya está en la ficha.
  const vinculados = tutoresDe(alumnoId);
  const nuevoNombre = String(datos.get("nuevoNombre") ?? "").trim();
  const hayNuevo = nuevoNombre !== "";

  const tutoresEditados: { id: number; nombre: string; parentesco: string | null;
    telefono: string | null; whatsapp: string | null; email: string | null; antes: Record<string, unknown> }[] = [];

  for (const t of vinculados) {
    const crudoTutor = Object.fromEntries(
      CLAVES_TUTOR.map((k) => [k, String(datos.get(`tutor_${t.id}_${k}`) ?? "")]),
    );
    const p = Tutor.safeParse(crudoTutor);
    if (!p.success) {
      const issue = p.error.issues[0];
      return { error: `${t.nombre}: ${issue?.message ?? "Revisa los datos."}`, campo: `tutor_${t.id}_${String(issue?.path[0] ?? "")}` };
    }
    tutoresEditados.push({
      id: t.id,
      nombre: p.data.nombre,
      parentesco: p.data.parentesco,
      telefono: p.data.telefono,
      whatsapp: p.data.whatsapp,
      email: p.data.email,
      antes: { nombre: t.nombre, parentesco: t.parentesco, telefono: t.telefono, whatsapp: t.whatsapp, email: t.email },
    });
  }

  let nuevo: z.infer<typeof NuevoTutor> | null = null;
  if (hayNuevo) {
    const crudoNuevo = Object.fromEntries(
      Object.entries(CAMPOS_NUEVO).map(([k, campo]) => [k, String(datos.get(campo) ?? "")]),
    );
    const p = NuevoTutor.safeParse(crudoNuevo);
    if (!p.success) {
      const issue = p.error.issues[0];
      return { error: issue?.message ?? "Revisa el tutor nuevo.", campo: "nuevoNombre" };
    }
    nuevo = p.data;
  }

  // El alumno sigue siendo menor de edad: debe quedar al menos un tutor.
  const quedaraConTutor = vinculados.length > 0 || nuevo !== null;
  if (esMenorDeEdad(d.fechaNacimiento) && !quedaraConTutor) {
    return { error: "El alumno es menor de edad: el contrato exige un padre, madre o tutor.", campo: "fechaNacimiento" };
  }

  // Salud: solo con los dos permisos. Sin lectura, guardar la ficha en blanco borraría datos.
  const editarSalud = tienePermiso(sesion, "salud.editar") && tienePermiso(sesion, "salud.leer");
  const salud = editarSalud ? Salud.safeParse(leer(datos, CLAVES_SALUD)) : null;
  if (salud && !salud.success) {
    const issue = salud.error.issues[0];
    return { error: issue?.message ?? "Revisa la ficha de salud.", campo: String(issue?.path[0] ?? "") };
  }

  const despues = {
    nombre: d.nombre,
    fechaNacimiento: d.fechaNacimiento,
    sexo: d.sexo,
    telefono: d.telefono,
    email: d.email,
    direccion: d.direccion,
    colonia: d.colonia,
    objetivoMusical: d.objetivoMusical,
    experienciaPrevia: d.experienciaPrevia,
    observaciones: d.observaciones,
    origen: d.origen,
  };
  const antesAlumno = {
    nombre: actual.nombre,
    fechaNacimiento: actual.fechaNacimiento,
    sexo: actual.sexo,
    telefono: actual.telefono,
    email: actual.email,
    direccion: actual.direccion,
    colonia: actual.colonia,
    objetivoMusical: actual.objetivoMusical,
    experienciaPrevia: actual.experienciaPrevia,
    observaciones: actual.observaciones,
    origen: actual.origen,
  };
  const cambiosAlumno = diferencias(antesAlumno, despues);

  const cambiosTutores = tutoresEditados
    .map((t) => ({
      id: t.id,
      cambios: diferencias(t.antes, {
        nombre: t.nombre, parentesco: t.parentesco, telefono: t.telefono, whatsapp: t.whatsapp, email: t.email,
      }),
    }))
    .filter((t) => Object.keys(t.cambios).length > 0);

  db.transaction((tx) => {
    if (Object.keys(cambiosAlumno).length > 0) {
      tx.update(alumnos).set(despues).where(eq(alumnos.id, alumnoId)).run();
    }

    for (const t of tutoresEditados) {
      tx.update(tutores).set({
        nombre: t.nombre, telefono: t.telefono, whatsapp: t.whatsapp, email: t.email,
      }).where(eq(tutores.id, t.id)).run();
      // El parentesco es de esta relación, no del tutor: se guarda en el vínculo de
      // este alumno. Sin filtrar por alumno cambiaría el de todos sus hermanos.
      tx.update(alumnosTutores).set({ parentesco: t.parentesco ?? "Tutor" })
        .where(and(eq(alumnosTutores.alumnoId, alumnoId), eq(alumnosTutores.tutorId, t.id))).run();
    }

    if (nuevo) {
      const creado = tx.insert(tutores).values({
        nombre: nuevoNombre.trim(),
        telefono: nuevo.telefono,
        whatsapp: nuevo.whatsapp ?? nuevo.telefono,
        email: nuevo.email,
      }).returning({ id: tutores.id }).get();
      if (!creado) throw new Error("No se pudo crear el tutor.");
      tx.insert(alumnosTutores).values({
        alumnoId,
        tutorId: creado.id,
        parentesco: nuevo.parentesco ?? "Tutor",
        esResponsablePago: vinculados.length === 0,
      }).run();
    }

    if (salud?.success) {
      const s = salud.data;
      const valores = {
        condicionSalud: cifrarOpcional(s.condicionSalud),
        trastornoAprendizaje: cifrarOpcional(s.trastornoAprendizaje),
        discapacidadSensorial: cifrarOpcional(s.discapacidadSensorial),
        medicamentos: cifrarOpcional(s.medicamentos),
        consideracionEmocional: cifrarOpcional(s.consideracionEmocional),
        observaciones: cifrarOpcional(s.saludObservaciones),
        actualizadoEn: new Date(),
        actualizadoPor: sesion.usuarioId,
      };
      tx.insert(saludAlumno).values({ alumnoId, ...valores })
        .onConflictDoUpdate({ target: saludAlumno.alumnoId, set: valores })
        .run();
    }
  });

  // La bitácora guarda qué cambió, nunca los valores de salud.
  if (Object.keys(cambiosAlumno).length > 0) {
    registrar({ usuarioId: sesion.usuarioId, accion: "alumno.editar", entidad: "alumnos",
      entidadId: alumnoId, cambios: cambiosAlumno });
  }
  for (const t of cambiosTutores) {
    registrar({ usuarioId: sesion.usuarioId, accion: "tutor.editar", entidad: "tutores",
      entidadId: t.id, cambios: t.cambios });
  }
  if (nuevo) {
    registrar({ usuarioId: sesion.usuarioId, accion: "tutor.editar", entidad: "alumnos_tutores",
      entidadId: alumnoId, cambios: { tutor_nuevo_vinculado: nuevoNombre } });
  }
  if (salud?.success) {
    registrar({ usuarioId: sesion.usuarioId, accion: "salud.editar", entidad: "salud_alumno",
      entidadId: alumnoId, cambios: { campos_guardados: CLAVES_SALUD } });
  }

  redirect(`/alumnos/${alumnoId}?aviso=${encodeURIComponent("Datos actualizados.")}`);
}
