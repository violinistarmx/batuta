"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { clasePorId } from "@/lib/datos/clases";
import {
  crearProgreso, crearTarea, guardarDocumento, guardarPlaneacion, marcarTarea,
} from "@/lib/datos/expediente";
import { validarArchivo } from "@/lib/dominio/archivos";

const texto = (max: number) =>
  z.string().trim().max(max).transform((s) => (s === "" ? null : s));

// ------------------------------------------------------------ planeación ---

const Planeacion = z.object({
  claseId: z.coerce.number().int().positive(),
  objetivos: texto(1000),
  temas: texto(1000),
  evaluacion: texto(1000),
});

export type EstadoPlaneacion = { error?: string; ok?: string };

export async function subirPlaneacion(
  _previo: EstadoPlaneacion,
  datos: FormData,
): Promise<EstadoPlaneacion> {
  const sesion = await exigirPermiso("planeaciones.subir");

  const parsed = Planeacion.safeParse({
    claseId: datos.get("claseId"),
    objetivos: datos.get("objetivos") ?? "",
    temas: datos.get("temas") ?? "",
    evaluacion: datos.get("evaluacion") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  // El alcance decide si esta clase existe para quien la pide: un docente no
  // planea clases ajenas.
  const clase = clasePorId(d.claseId, alcanceDe(sesion));
  if (!clase) return { error: "No se encontró la clase." };

  let documentoId: number | null = null;
  const archivo = datos.get("archivo");

  if (archivo instanceof File && archivo.size > 0) {
    const validacion = validarArchivo(archivo.type, archivo.size);
    if (!validacion.ok) return { error: validacion.razon };

    try {
      documentoId = await guardarDocumento(
        Buffer.from(await archivo.arrayBuffer()),
        validacion.tipo,
        {
          alumnoId: clase.alumnoId,
          inscripcionId: clase.inscripcionId,
          claseId: clase.id,
          categoria: "planeacion",
          nombreOriginal: archivo.name,
          subidoPor: sesion.usuarioId,
        },
      );
    } catch (err) {
      console.error("Error guardando documento:", err);
      return { error: "No se pudo guardar el archivo. Inténtalo de nuevo." };
    }
  }

  if (!documentoId && !d.objetivos && !d.temas && !d.evaluacion) {
    return { error: "Escribe algo o adjunta el PDF de la planeación." };
  }

  const planeacionId = guardarPlaneacion({
    claseId: clase.id,
    docenteId: clase.docenteId,
    documentoId,
    objetivos: d.objetivos,
    temas: d.temas,
    evaluacion: d.evaluacion,
  }, sesion.usuarioId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "documento.subir",
    entidad: "planeaciones",
    entidadId: planeacionId,
    cambios: { claseId: clase.id, conArchivo: documentoId !== null },
  });

  revalidatePath(`/clases/${clase.id}`);
  revalidatePath("/");
  return { ok: documentoId ? "Planeación guardada con su PDF." : "Planeación guardada." };
}

// ----------------------------------------------------------------- tarea ---

const Tarea = z.object({
  claseId: z.coerce.number().int().positive(),
  descripcion: z.string().trim().min(3, "Escribe qué debe practicar.").max(500),
  repertorio: texto(300),
  fechaRevision: z.string().trim()
    .transform((s) => (s === "" ? null : s))
    .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "Fecha inválida."),
});

export type EstadoTarea = { error?: string; ok?: string };

export async function asignarTarea(
  _previo: EstadoTarea,
  datos: FormData,
): Promise<EstadoTarea> {
  const sesion = await exigirPermiso("planeaciones.subir");

  const parsed = Tarea.safeParse({
    claseId: datos.get("claseId"),
    descripcion: datos.get("descripcion"),
    repertorio: datos.get("repertorio") ?? "",
    fechaRevision: datos.get("fechaRevision") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  const clase = clasePorId(d.claseId, alcanceDe(sesion));
  if (!clase) return { error: "No se encontró la clase." };

  crearTarea({
    inscripcionId: clase.inscripcionId,
    claseId: clase.id,
    descripcion: d.descripcion,
    repertorio: d.repertorio,
    fechaRevision: d.fechaRevision,
  }, sesion.usuarioId);

  revalidatePath(`/clases/${clase.id}`);
  revalidatePath(`/inscripciones/${clase.inscripcionId}`);
  return { ok: "Tarea asignada." };
}

export async function alternarTarea(_previo: unknown, datos: FormData): Promise<{ error?: string }> {
  const sesion = await exigirPermiso("planeaciones.subir");
  const id = Number(datos.get("tareaId"));
  const claseId = Number(datos.get("claseId"));
  if (!Number.isInteger(id)) return { error: "Tarea inválida." };

  if (!clasePorId(claseId, alcanceDe(sesion))) return { error: "No se encontró la clase." };

  marcarTarea(id, datos.get("completada") === "si");
  revalidatePath(`/clases/${claseId}`);
  return {};
}

// -------------------------------------------------------------- progreso ---

const Progreso = z.object({
  claseId: z.coerce.number().int().positive(),
  valoracion: z.enum(["requiere_apoyo", "en_desarrollo", "consolidado", "destacado"]),
  notas: z.string().trim().min(3, "Escribe cómo va el alumno.").max(1000),
});

export type EstadoProgreso = { error?: string; ok?: string };

export async function registrarAvance(
  _previo: EstadoProgreso,
  datos: FormData,
): Promise<EstadoProgreso> {
  const sesion = await exigirPermiso("planeaciones.subir");

  const parsed = Progreso.safeParse({
    claseId: datos.get("claseId"),
    valoracion: datos.get("valoracion"),
    notas: datos.get("notas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  const clase = clasePorId(d.claseId, alcanceDe(sesion));
  if (!clase) return { error: "No se encontró la clase." };

  crearProgreso({
    inscripcionId: clase.inscripcionId,
    claseId: clase.id,
    cicloId: clase.cicloId,
    // La fecha del avance es la de la clase, no la de captura: así la línea de
    // tiempo del alumno queda en orden aunque se registre días después.
    fecha: clase.iniciaEn.toISOString().slice(0, 10),
    valoracion: d.valoracion,
    notas: d.notas,
  }, sesion.usuarioId);

  revalidatePath(`/clases/${clase.id}`);
  revalidatePath(`/inscripciones/${clase.inscripcionId}`);
  return { ok: "Avance registrado." };
}
