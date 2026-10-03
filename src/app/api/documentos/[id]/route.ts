import { notFound } from "next/navigation";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { leer } from "@/lib/almacen";
import { documentoPorId } from "@/lib/datos/expediente";
import { nombreDeDescarga } from "@/lib/dominio/archivos";

/**
 * Descarga de documentos del expediente.
 *
 * Este es el ÚNICO camino hacia un archivo. Nada vive en `public/`, así que no
 * existe una URL que sirva un PDF sin pasar por aquí — y aquí se verifica sesión,
 * permiso y alcance antes de tocar el disco.
 *
 * Un documento fuera de alcance responde 404, no 403: confirmar que existe pero
 * está prohibido ya filtra información.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await exigirPermiso("documentos.leer");
  const { id } = await params;

  const documentoId = Number(id);
  if (!Number.isInteger(documentoId)) notFound();

  const doc = documentoPorId(documentoId, alcanceDe(sesion));
  if (!doc) notFound();

  let contenido: Buffer;
  try {
    contenido = await leer(doc.ruta);
  } catch {
    // La fila existe pero el archivo no: casi siempre un respaldo restaurado a
    // medias. Se avisa en vez de devolver un archivo vacío.
    return new Response("El archivo no está disponible en el almacén.", { status: 410 });
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "documento.descargar",
    entidad: "documentos",
    entidadId: doc.id,
    cambios: { categoria: doc.categoria, alumnoId: doc.alumnoId },
  });

  const extension = doc.tipoMime === "application/pdf" ? "pdf"
    : doc.tipoMime === "image/png" ? "png" : "jpg";

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": doc.tipoMime,
      "Content-Length": String(doc.bytes),
      // `inline` para poder verlo en el navegador; el nombre va saneado porque
      // viene del cliente y una comilla permitiría inyectar cabeceras.
      "Content-Disposition":
        `inline; filename="${nombreDeDescarga(doc.nombreOriginal, extension)}"`,
      // Impide que el navegador adivine otro tipo y ejecute el contenido.
      "X-Content-Type-Options": "nosniff",
      // Un expediente no se guarda en cachés intermedias.
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
