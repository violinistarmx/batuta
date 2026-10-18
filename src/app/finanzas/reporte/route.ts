import { createElement, type ReactElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { dashboardFinanzas } from "@/lib/datos/finanzas-dashboard";
import { leerSeleccion, nombreReporte } from "@/lib/finanzas/parametros";
import { ReporteFinanzas } from "@/lib/finanzas/reporte/documento";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Reporte PDF de finanzas con el mismo periodo y los mismos filtros que el
 * dashboard (llegan en la URL). Se genera en el servidor con react-pdf: sin
 * navegador headless, así la imagen de Railway no crece.
 */
export async function GET(req: NextRequest) {
  const sesion = await exigirPermiso("finanzas.leer");
  const hoy = hoyEnMexico();
  const seleccion = leerSeleccion(Object.fromEntries(req.nextUrl.searchParams), hoy);
  const d = dashboardFinanzas(seleccion, hoy);

  const generado = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", dateStyle: "long", timeStyle: "short",
  }).format(new Date());

  const documento = createElement(ReporteFinanzas, { d, generado }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(documento);

  registrar({
    usuarioId: sesion.usuarioId, accion: "documento.descargar", entidad: "reporte_finanzas",
    cambios: { periodo: d.periodo.etiqueta, filtros: d.filtrosActivos },
  });

  const nombre = nombreReporte(seleccion.periodo);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
