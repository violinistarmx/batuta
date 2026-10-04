import { notFound } from "next/navigation";

import { leer } from "@/lib/almacen";
import { alcanceDe, exigirPermiso, exigirSesionUsable } from "@/lib/auth/permisos";
import { fotoDeAlumno, fotoDeDocente } from "@/lib/datos/fotos";

/**
 * Fotografías de perfil de alumnos y maestros.
 *
 * Igual que la descarga del expediente: nada vive en `public/`, así que no existe
 * una URL que entregue la foto de un menor sin pasar por aquí, y el alcance se
 * resuelve en la capa de datos —no en esta ruta— para que no dependa de que
 * alguien se acuerde de filtrar.
 *
 * Dos permisos distintos a propósito:
 *   - alumno:  `alumnos.leer`, el mismo que abre su ficha. Si alcanzas al alumno,
 *              alcanzas su foto; si no, ni siquiera sabes que existe.
 *   - docente: basta sesión usable. Pedir `usuarios.gestionar` dejaría a un
 *              maestro sin poder ver su propia foto, y el alcance por fila ya lo
 *              limita a la suya.
 *
 * No se registra en bitácora. La descarga de un contrato sí es un hecho que
 * conviene auditar; pintar un avatar ocurre en cada carga de pantalla y llenaría
 * la bitácora de ruido hasta tapar lo que importa.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  const { tipo, id } = await params;

  const personaId = Number(id);
  if (!Number.isInteger(personaId) || personaId <= 0) notFound();

  let foto: { ruta: string; mime: string } | undefined;

  if (tipo === "alumno") {
    const sesion = await exigirPermiso("alumnos.leer");
    foto = fotoDeAlumno(personaId, alcanceDe(sesion));
  } else if (tipo === "docente") {
    const sesion = await exigirSesionUsable();
    foto = fotoDeDocente(personaId, alcanceDe(sesion));
  } else {
    notFound();
  }

  // Fuera de alcance responde 404, no 403: confirmar que la persona existe pero
  // está prohibida ya filtra información.
  if (!foto) notFound();

  let contenido: Buffer;
  try {
    contenido = await leer(foto.ruta);
  } catch {
    return new Response("La fotografía no está disponible en el almacén.", { status: 410 });
  }

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": foto.mime,
      "Content-Length": String(contenido.byteLength),
      "X-Content-Type-Options": "nosniff",
      // Misma postura que el expediente: la imagen de un menor no se queda en
      // cachés intermedias.
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
