import { NextRequest, NextResponse } from "next/server";

import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { pagosDelPeriodo } from "@/lib/datos/finanzas";
import { gastosDelPeriodo, ETIQUETA_CATEGORIA } from "@/lib/datos/gastos";
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

export async function GET(req: NextRequest) {
  const sesion = await exigirPermiso("finanzas.leer");
  const puedeGastos = tienePermiso(sesion, "gastos.gestionar");

  const hoy = hoyEnMexico();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const sp = req.nextUrl.searchParams;
  const desde = sp.get("desde") ?? inicioMes;
  const hasta = sp.get("hasta") ?? hoy;

  const rows: string[] = [];

  // ── Encabezado ─────────────────────────────────────────────────────────────
  rows.push("Tipo,Fecha,Concepto,Alumno / Proveedor,Método,Referencia,Ingreso,Egreso,Notas");

  // ── Ingresos (pagos) ────────────────────────────────────────────────────────
  const ingresos = pagosDelPeriodo(desde, hasta);
  for (const p of ingresos) {
    const monto = p.montoCentavos - p.descuentoCentavos;
    rows.push([
      "Ingreso",
      esc(p.recibidoEl),
      esc(p.descripcion ?? "Pago"),
      esc(p.alumno),
      esc(p.metodo),
      esc(p.referencia),
      centavos(monto),
      "",
      p.descuentoCentavos > 0 ? esc(`Descuento: $${centavos(p.descuentoCentavos)}`) : "",
    ].join(","));
  }

  // ── Egresos (gastos) ────────────────────────────────────────────────────────
  if (puedeGastos) {
    const egresos = gastosDelPeriodo(desde, hasta);
    for (const g of egresos) {
      rows.push([
        "Egreso",
        esc(g.fecha),
        esc(g.concepto),
        esc(ETIQUETA_CATEGORIA[g.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? g.categoria),
        "",
        "",
        "",
        centavos(g.montoCentavos),
        "",
      ].join(","));
    }
  }

  const csv = rows.join("\r\n");
  const nombre = `flujo-caja-${desde}-a-${hasta}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
