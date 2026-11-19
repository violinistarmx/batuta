import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { registrar } from "@/lib/bitacora";
import { armarComprobante, reciboIdDeToken } from "@/lib/datos/comprobante";
import { ComprobantePdf } from "@/lib/comprobante/documento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PDF del comprobante para quien recibe el enlace de WhatsApp. Es público a propósito: la
 * familia no tiene cuenta en Batuta, así que la protección es el token (256 bits aleatorios,
 * imposible de adivinar) y no una sesión. Compartir el enlace equivale a entregar el
 * comprobante; anular el pago borra el recibo y el enlace deja de existir.
 *
 * Un token que no existe responde 404 sin distinguir entre «no existe» y «mal escrito».
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = reciboIdDeToken(token);
  const c = id === null ? null : armarComprobante(id);
  if (!c) return new NextResponse("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

  const documento = createElement(ComprobantePdf, { c }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(documento);

  // Queda constancia de cada apertura del enlace (sin usuario: es público).
  registrar({
    usuarioId: null, accion: "documento.descargar", entidad: "recibos", entidadId: c.r.id,
    cambios: { via: "enlace_whatsapp", folio: c.r.folio },
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Comprobante-${c.r.folio}.pdf"`,
      "Cache-Control": "no-store",
      // El PDF lleva nombre, dirección y teléfono: que ningún buscador lo indexe.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
