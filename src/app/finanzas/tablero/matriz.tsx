"use client";

import { useMemo, useState } from "react";

import type { Matriz } from "@/lib/finanzas/tipos";
import { nombreCortoDeMes, nombreDeMes } from "@/lib/finanzas/fechas";
import { pesosExactos } from "@/lib/formato";

type Orden = { columna: "nombre" | "total" | number; descendente: boolean };

/**
 * Matriz mensual de egresos, estilo hoja de cálculo. Aquí es de solo lectura: las
 * celdas se editan en /finanzas/gastos. Clic en un mes filtra el dashboard a ese
 * mes; clic en una categoría filtra los gastos a esa categoría.
 */
export function MatrizEgresos({
  matriz, anio, onMes, onCategoria,
}: {
  matriz: Matriz;
  anio: number;
  onMes: (mes: string) => void;
  onCategoria: (id: number) => void;
}) {
  const [orden, setOrden] = useState<Orden>({ columna: "total", descendente: true });

  const filas = useMemo(() => {
    const valor = (f: Matriz["filas"][number]) =>
      orden.columna === "nombre" ? f.nombre : orden.columna === "total" ? f.total : f.valores[orden.columna] ?? 0;
    return [...matriz.filas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const c = typeof va === "string" ? va.localeCompare(String(vb), "es") : va - (vb as number);
      return orden.descendente ? -c : c;
    });
  }, [matriz.filas, orden]);

  const ordenarPor = (columna: Orden["columna"]) =>
    setOrden((o) => ({ columna, descendente: o.columna === columna ? !o.descendente : columna !== "nombre" }));
  const flecha = (columna: Orden["columna"]) => (orden.columna === columna ? (orden.descendente ? " ↓" : " ↑") : "");
  const aria = (columna: Orden["columna"]) =>
    orden.columna === columna ? (orden.descendente ? "descending" : "ascending") : "none";

  const exportar = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const p = (c: number) => (c / 100).toFixed(2);
    const lineas = [
      ["Concepto", ...matriz.meses.map(nombreDeMes), "Total"].join(","),
      ...filas.map((f) => [esc(f.nombre), ...f.valores.map(p), p(f.total)].join(",")),
      ["Total", ...matriz.totalesMes.map(p), p(matriz.total)].join(","),
    ];
    // BOM para que Excel abra los acentos bien.
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matriz-egresos-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const porCategoria = [...matriz.filas].sort((a, b) => b.total - a.total);
  const encabezado = "px-2 py-2 text-right font-semibold";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-vs-tinta-3">
          Toca un encabezado para ordenar. Las cifras se capturan en{" "}
          <a href={`/finanzas/gastos?anio=${anio}`} className="underline">Gastos</a>.
        </p>
        <button
          type="button" onClick={exportar}
          className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-xs font-medium transition hover:border-vs-naranja-700 hover:text-vs-naranja-700"
        >
          ↓ Exportar tabla a CSV
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_15rem]">
        <div className="min-h-0 overflow-auto rounded-lg border border-vs-linea">
          <table className="w-full min-w-[900px] border-collapse text-xs tabular-nums">
            <thead className="sticky top-0 z-10 bg-vs-crema text-[10px] uppercase tracking-wider text-vs-tinta-3">
              <tr>
                <th aria-sort={aria("nombre")} className="sticky left-0 bg-vs-crema px-2 py-2 text-left font-semibold">
                  <button type="button" onClick={() => ordenarPor("nombre")}>Concepto{flecha("nombre")}</button>
                </th>
                {matriz.meses.map((m, i) => (
                  <th key={m} aria-sort={aria(i)} className={encabezado}>
                    <button type="button" onClick={() => ordenarPor(i)} onDoubleClick={() => onMes(m)} title="Clic: ordenar · doble clic: ver ese mes">
                      {nombreCortoDeMes(m)}{flecha(i)}
                    </button>
                  </th>
                ))}
                <th aria-sort={aria("total")} className={encabezado}>
                  <button type="button" onClick={() => ordenarPor("total")}>Total{flecha("total")}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-vs-linea hover:bg-vs-crema/60">
                  <th scope="row" className="sticky left-0 bg-white px-2 py-1.5 text-left font-medium">
                    <button
                      type="button"
                      disabled={f.calculada}
                      onClick={() => !f.calculada && onCategoria(Number(f.id.replace("cat-", "")))}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] disabled:cursor-default"
                      style={{ background: `${f.color}1f`, color: "#221a0e" }}
                    >
                      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                      {f.nombre}
                    </button>
                  </th>
                  {f.valores.map((v, i) => (
                    <td key={matriz.meses[i]} className={`px-2 py-1.5 text-right ${v === 0 ? "text-vs-tinta-3/50" : ""}`}>
                      {v === 0 ? "—" : pesosExactos(v)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold">{pesosExactos(f.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-vs-crema font-semibold">
              <tr className="border-t-2 border-vs-linea">
                <th scope="row" className="sticky left-0 bg-vs-crema px-2 py-2 text-left">Total egresos</th>
                {matriz.totalesMes.map((v, i) => <td key={matriz.meses[i]} className="px-2 py-2 text-right">{pesosExactos(v)}</td>)}
                <td className="px-2 py-2 text-right">{pesosExactos(matriz.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <aside className="grid min-h-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:overflow-auto">
          <section className="rounded-lg border border-vs-linea">
            <h4 className="flex justify-between bg-vs-crema px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-vs-tinta-3">
              <span>Categoría</span><span>Total</span>
            </h4>
            <ul className="divide-y divide-vs-linea text-xs tabular-nums">
              {porCategoria.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: f.color }} />
                    <span className="truncate">{f.nombre}</span>
                  </span>
                  <span className="font-medium">{pesosExactos(f.total)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-vs-linea">
            <h4 className="flex justify-between bg-vs-crema px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-vs-tinta-3">
              <span>Mes</span><span>Total</span>
            </h4>
            <ul className="divide-y divide-vs-linea text-xs tabular-nums">
              {matriz.meses.map((m, i) => (
                <li key={m}>
                  <button type="button" onClick={() => onMes(m)}
                          className="flex w-full justify-between px-2.5 py-1 hover:bg-vs-crema">
                    <span>{nombreDeMes(m)}</span>
                    <span className="font-medium">{pesosExactos(matriz.totalesMes[i] ?? 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
