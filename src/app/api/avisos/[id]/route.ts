import { notFound } from "next/navigation";

import { exigirSesionUsable } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { leer } from "@/lib/almacen";
import { adjuntoDeParticipante } from "@/lib/datos/avisos";
import { nombreDeDescarga } from "@/lib/dominio/archivos";

/**
 * Adjuntos de los avisos internos. Solo los ve quien es remitente o destinatario
 * del envío. Quien no participa recibe 404, no 403: confirmar que el archivo existe
 * ya es filtrar información.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await exigirSesionUsable();
  const { id } = await params;

  const adjuntoId = Number(id);
  if (!Number.isInteger(adjuntoId)) notFound();

  const adjunto = adjuntoDeParticipante(adjuntoId, sesion.usuarioId);
  if (!adjunto) notFound();

  let contenido: Buffer;
  try {
    contenido = await leer(adjunto.ruta);
  } catch {
    return new Response("El archivo no está disponible en el almacén.", { status: 410 });
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "documento.descargar",
    entidad: "avisos_adjuntos",
    entidadId: adjunto.id,
    cambios: { grupo: adjunto.grupo },
  });

  const extension = adjunto.tipoMime === "application/pdf" ? "pdf"
    : adjunto.tipoMime === "image/png" ? "png" : "jpg";

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": adjunto.tipoMime,
      "Content-Length": String(adjunto.bytes),
      // `inline` para verlo en el navegador; el nombre viene del cliente y va saneado.
      "Content-Disposition": `inline; filename="${nombreDeDescarga(adjunto.nombreOriginal, extension)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
