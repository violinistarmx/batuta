import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { alumnos, docentes } from "@/db/schema/index";
import { borrar, guardar } from "@/lib/almacen";
import type { Alcance } from "@/lib/auth/permisos";
import type { TipoPermitido } from "@/lib/dominio/archivos";

import { alumnoPorId } from "./alumnos";

/**
 * Fotografías de perfil de alumnos y docentes.
 *
 * La imagen vive en el almacén, igual que un contrato: fuera de `public/`, con
 * el nombre en disco generado por el sistema. Nada de esto se sirve como ruta
 * estática — la foto de un menor no puede quedar accesible por adivinar una URL.
 *
 * El alcance NO se reimplementa aquí: para alumnos se delega en `alumnoPorId`,
 * que ya decide si quien pregunta alcanza a ese alumno. Si esa regla cambia
 * algún día, la foto la hereda sin que nadie tenga que acordarse de esto.
 */

type Guardada = { ruta: string; mime: string };

/** Solo imágenes. El almacén acepta PDF, pero un PDF no es una foto de perfil. */
export function esImagen(tipo: TipoPermitido): tipo is "image/jpeg" | "image/png" {
  return tipo === "image/jpeg" || tipo === "image/png";
}

async function reemplazar(
  rutaAnterior: string | null,
  contenido: Buffer,
  tipo: "image/jpeg" | "image/png",
): Promise<{ ruta: string; hash: string; bytes: number }> {
  const archivo = await guardar(contenido, tipo);
  // El borrado va DESPUÉS de escribir la nueva: si falla a medio camino, sobra un
  // archivo huérfano en disco, que es mejor que una fila apuntando a la nada.
  if (rutaAnterior) await borrar(rutaAnterior);
  return { ruta: archivo.ruta, hash: archivo.hash, bytes: archivo.bytes };
}

export async function guardarFotoAlumno(
  alumnoId: number,
  contenido: Buffer,
  tipo: "image/jpeg" | "image/png",
): Promise<void> {
  const actual = db
    .select({ ruta: alumnos.fotoRuta })
    .from(alumnos)
    .where(eq(alumnos.id, alumnoId))
    .get();
  if (!actual) throw new Error("No se encontró el alumno.");

  const nueva = await reemplazar(actual.ruta, contenido, tipo);

  db.update(alumnos)
    .set({
      fotoRuta: nueva.ruta,
      fotoMime: tipo,
      fotoBytes: nueva.bytes,
      fotoHash: nueva.hash,
      fotoActualizadaEn: new Date(),
    })
    .where(eq(alumnos.id, alumnoId))
    .run();
}

export async function guardarFotoDocente(
  docenteId: number,
  contenido: Buffer,
  tipo: "image/jpeg" | "image/png",
): Promise<void> {
  const actual = db
    .select({ ruta: docentes.fotoRuta })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .get();
  if (!actual) throw new Error("No se encontró al maestro.");

  const nueva = await reemplazar(actual.ruta, contenido, tipo);

  db.update(docentes)
    .set({
      fotoRuta: nueva.ruta,
      fotoMime: tipo,
      fotoBytes: nueva.bytes,
      fotoHash: nueva.hash,
      fotoActualizadaEn: new Date(),
    })
    .where(eq(docentes.id, docenteId))
    .run();
}

export async function quitarFotoAlumno(alumnoId: number): Promise<void> {
  const actual = db
    .select({ ruta: alumnos.fotoRuta })
    .from(alumnos)
    .where(eq(alumnos.id, alumnoId))
    .get();
  if (!actual?.ruta) return;

  db.update(alumnos)
    .set({ fotoRuta: null, fotoMime: null, fotoBytes: null, fotoHash: null, fotoActualizadaEn: null })
    .where(eq(alumnos.id, alumnoId))
    .run();

  await borrar(actual.ruta);
}

export async function quitarFotoDocente(docenteId: number): Promise<void> {
  const actual = db
    .select({ ruta: docentes.fotoRuta })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .get();
  if (!actual?.ruta) return;

  db.update(docentes)
    .set({ fotoRuta: null, fotoMime: null, fotoBytes: null, fotoHash: null, fotoActualizadaEn: null })
    .where(eq(docentes.id, docenteId))
    .run();

  await borrar(actual.ruta);
}

/** Existencia de la ficha de maestro, para validar antes de escribir. */
export function docenteExiste(docenteId: number): boolean {
  return db
    .select({ id: docentes.id })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .get() !== undefined;
}

/** Ficha de maestro ligada a una cuenta, si la tiene. */
export function docenteDeUsuario(usuarioId: number): number | null {
  return db
    .select({ id: docentes.id })
    .from(docentes)
    .where(eq(docentes.usuarioId, usuarioId))
    .get()?.id ?? null;
}

/** Lo justo para pintar el avatar sin traer la imagen entera. */
export function resumenFotoDocente(docenteId: number): { tieneFoto: boolean; version: number | null } {
  const fila = db
    .select({ ruta: docentes.fotoRuta, actualizada: docentes.fotoActualizadaEn })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .get();

  return {
    tieneFoto: Boolean(fila?.ruta),
    version: fila?.actualizada?.getTime() ?? null,
  };
}

/**
 * Foto de un alumno, con el alcance ya aplicado.
 *
 * Se apoya en `alumnoPorId`: si ese alumno no es alcanzable para quien pregunta,
 * no hay fila y por tanto no hay foto.
 */
export function fotoDeAlumno(alumnoId: number, alcance: Alcance): Guardada | undefined {
  const alumno = alumnoPorId(alumnoId, alcance);
  if (!alumno?.fotoRuta || !alumno.fotoMime) return undefined;
  return { ruta: alumno.fotoRuta, mime: alumno.fotoMime };
}

/**
 * Foto de un maestro.
 *
 * Dirección y asistencia ven cualquiera; un docente, solo la suya. No hay motivo
 * para que un maestro navegue las fichas de sus compañeros.
 */
export function fotoDeDocente(docenteId: number, alcance: Alcance): Guardada | undefined {
  if (alcance.tipo !== "todo" && alcance.docenteId !== docenteId) return undefined;

  const fila = db
    .select({ ruta: docentes.fotoRuta, mime: docentes.fotoMime })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .get();

  if (!fila?.ruta || !fila.mime) return undefined;
  return { ruta: fila.ruta, mime: fila.mime };
}
