"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { alcanceDe, exigirPermiso, exigirSesionUsable, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";
import {
  docenteExiste, esImagen, guardarFotoAlumno, guardarFotoDocente,
  quitarFotoAlumno, quitarFotoDocente,
} from "@/lib/datos/fotos";
import { validarArchivo } from "@/lib/dominio/archivos";

/**
 * Alta y baja de fotografías de perfil.
 *
 * Viven juntas y fuera de una carpeta de ruta porque la pantalla del alumno y la
 * del maestro usan el mismo componente: separarlas obligaría a duplicar la
 * validación del archivo, que es justo lo que no conviene tener en dos sitios.
 */

const Alumno = z.object({ alumnoId: z.coerce.number().int().positive() });
const Docente = z.object({ docenteId: z.coerce.number().int().positive() });

export type EstadoFoto = { error?: string; ok?: string };

/** Valida que lo recibido sea una imagen aceptable y la devuelve en memoria. */
async function leerImagen(
  datos: FormData,
): Promise<{ ok: true; contenido: Buffer; tipo: "image/jpeg" | "image/png" } | { ok: false; error: string }> {
  const archivo = datos.get("foto");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Elige una imagen." };
  }

  const validacion = validarArchivo(archivo.type, archivo.size);
  if (!validacion.ok) return { ok: false, error: validacion.razon };

  // El almacén acepta PDF; una foto de perfil, no.
  if (!esImagen(validacion.tipo)) {
    return { ok: false, error: "La fotografía debe ser JPG o PNG." };
  }

  return {
    ok: true,
    contenido: Buffer.from(await archivo.arrayBuffer()),
    tipo: validacion.tipo,
  };
}

// --------------------------------------------------------------- alumnos ---

export async function subirFotoAlumno(
  _previo: EstadoFoto,
  datos: FormData,
): Promise<EstadoFoto> {
  const sesion = await exigirPermiso("alumnos.editar");

  const parsed = Alumno.safeParse({ alumnoId: datos.get("alumnoId") });
  if (!parsed.success) return { error: "Revisa los datos." };
  const { alumnoId } = parsed.data;

  // El alcance decide si ese alumno existe para quien lo pide.
  if (!alumnoPorId(alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  const imagen = await leerImagen(datos);
  if (!imagen.ok) return { error: imagen.error };

  try {
    await guardarFotoAlumno(alumnoId, imagen.contenido, imagen.tipo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la fotografía." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.editar",
    entidad: "alumnos",
    entidadId: alumnoId,
    cambios: { fotografia: "actualizada" },
  });

  revalidatePath(`/alumnos/${alumnoId}`);
  revalidatePath(`/alumnos/${alumnoId}/credencial`);
  return { ok: "Fotografía actualizada." };
}

export async function borrarFotoAlumno(
  _previo: EstadoFoto,
  datos: FormData,
): Promise<EstadoFoto> {
  const sesion = await exigirPermiso("alumnos.editar");

  const parsed = Alumno.safeParse({ alumnoId: datos.get("alumnoId") });
  if (!parsed.success) return { error: "Revisa los datos." };
  const { alumnoId } = parsed.data;

  if (!alumnoPorId(alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  await quitarFotoAlumno(alumnoId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.editar",
    entidad: "alumnos",
    entidadId: alumnoId,
    cambios: { fotografia: "eliminada" },
  });

  revalidatePath(`/alumnos/${alumnoId}`);
  revalidatePath(`/alumnos/${alumnoId}/credencial`);
  return { ok: "Fotografía eliminada." };
}

// -------------------------------------------------------------- docentes ---

/**
 * Dirección administra cualquier ficha; un maestro, solo la suya.
 *
 * Misma regla que para ver la foto: si cambiara solo en un lado, un maestro
 * podría poner la imagen de un compañero sin poder verla después.
 */
async function autorizarDocente(docenteId: number) {
  const sesion = await exigirSesionUsable();

  if (!tienePermiso(sesion, "usuarios.gestionar")) {
    const alcance = alcanceDe(sesion);
    if (alcance.tipo === "todo" || alcance.docenteId !== docenteId) return null;
  }

  if (!docenteExiste(docenteId)) return null;
  return sesion;
}

export async function subirFotoDocente(
  _previo: EstadoFoto,
  datos: FormData,
): Promise<EstadoFoto> {
  const parsed = Docente.safeParse({ docenteId: datos.get("docenteId") });
  if (!parsed.success) return { error: "Revisa los datos." };
  const { docenteId } = parsed.data;

  const sesion = await autorizarDocente(docenteId);
  if (!sesion) return { error: "No se encontró al maestro." };

  const imagen = await leerImagen(datos);
  if (!imagen.ok) return { error: imagen.error };

  try {
    await guardarFotoDocente(docenteId, imagen.contenido, imagen.tipo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la fotografía." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "usuario.editar",
    entidad: "docentes",
    entidadId: docenteId,
    cambios: { fotografia: "actualizada" },
  });

  revalidatePath("/usuarios");
  return { ok: "Fotografía actualizada." };
}

export async function borrarFotoDocente(
  _previo: EstadoFoto,
  datos: FormData,
): Promise<EstadoFoto> {
  const parsed = Docente.safeParse({ docenteId: datos.get("docenteId") });
  if (!parsed.success) return { error: "Revisa los datos." };
  const { docenteId } = parsed.data;

  const sesion = await autorizarDocente(docenteId);
  if (!sesion) return { error: "No se encontró al maestro." };

  await quitarFotoDocente(docenteId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "usuario.editar",
    entidad: "docentes",
    entidadId: docenteId,
    cambios: { fotografia: "eliminada" },
  });

  revalidatePath("/usuarios");
  return { ok: "Fotografía eliminada." };
}
