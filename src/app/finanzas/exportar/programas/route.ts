import { NextRequest, NextResponse } from "next/server";

import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { resultadoPorPrograma } from "@/lib/datos/finanzas";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

function esc(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function centavos(n: number): string {
  return (n / 100).toFixed(2);
}

/**
 * Resultado por programa en CSV: una fila por programa y una de total. Las columnas
 * de costo y egreso de nómina solo aparecen para quien puede ver la nómina.
 */
export async function GET(req: NextRequest) {
  const sesion = await exigirPermiso("finanzas.leer");
  const puedeNomina = tienePermiso(sesion, "nomina.leer");

  const hoy = hoyEnMexico();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const sp = req.nextUrl.searchParams;
  const desde = sp.get("desde") ?? inicioMes;
  const hasta = sp.get("hasta") ?? hoy;

  const filas = resultadoPorPrograma(desde, hasta);

  const encabezado = ["Programa", "Ingreso cobrado", "De renovaciones", "De otros cargos"];
  if (puedeNomina) {
    encabezado.push("Costo docente devengado", "Egreso nómina pagada", "Nómina por pagar", "Margen");
  }
  const rows: string[] = [encabezado.join(",")];

  const total = { ingreso: 0, renov: 0, otros: 0, costo: 0, egreso: 0, porPagar: 0, margen: 0 };
  for (const f of filas) {
    total.ingreso += f.ingresoCentavos;
    total.renov += f.renovacionesCentavos;
    total.otros += f.otrosCargosCentavos;
    total.costo += f.costoDevengadoCentavos;
    total.egreso += f.egresoPagadoCentavos;
    total.porPagar += f.porPagarCentavos;
    total.margen += f.margenCentavos;

    const celdas = [esc(f.programa), centavos(f.ingresoCentavos), centavos(f.renovacionesCentavos),
      centavos(f.otrosCargosCentavos)];
    if (puedeNomina) {
      celdas.push(centavos(f.costoDevengadoCentavos), centavos(f.egresoPagadoCentavos),
        centavos(f.porPagarCentavos), centavos(f.margenCentavos));
    }
    rows.push(celdas.join(","));
  }

  const cierre = ["Total", centavos(total.ingreso), centavos(total.renov), centavos(total.otros)];
  if (puedeNomina) {
    cierre.push(centavos(total.costo), centavos(total.egreso), centavos(total.porPagar), centavos(total.margen));
  }
  rows.push(cierre.join(","));

  const nombre = `resultado-programas-${desde}-a-${hasta}.csv`;
  return new NextResponse(rows.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
