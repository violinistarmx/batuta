"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { mesAnterior } from "@/lib/finanzas/fechas";
import type { escribirSeleccion, Seleccion } from "@/lib/finanzas/parametros";
import type { Dashboard, Filtros } from "@/lib/finanzas/tipos";

type Cambios = Parameters<typeof escribirSeleccion>[1];

const control = "rounded-lg border-0 bg-white/95 px-2.5 py-1.5 text-sm text-vs-tinta shadow-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

function siguienteMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m!, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Banner del dashboard con el periodo, la comparación y los filtros en una sola
 * fila sobre las gráficas. Cada cambio reescribe la URL y el servidor recalcula.
 */
export function BarraFiltros({
  d, seleccion, cargando, navegar, enlacePdf, enlaceCsv, acciones,
}: {
  d: Dashboard;
  seleccion: Seleccion;
  cargando: boolean;
  navegar: (c: Cambios) => void;
  enlacePdf: string;
  enlaceCsv: string;
  acciones: ReactNode;
}) {
  const p = seleccion.periodo;
  const anioHoy = new Date().getFullYear();
  const anios = Array.from({ length: 5 }, (_, i) => anioHoy - i);
  const filtro = (clave: keyof Filtros, valor: string) =>
    navegar({ filtros: { [clave]: valor === "" ? null : Number(valor) } });
  const quitar = (dimension: string) => {
    const clave: Record<string, keyof Filtros> = {
      Programa: "programaId", Instrumento: "instrumentoId", Sede: "sedeId", Maestro: "docenteId", Categoría: "categoriaId",
    };
    if (dimension === "Línea") { navegar({ filtros: { linea: "todo" } }); return; }
    const k = clave[dimension];
    if (k) navegar({ filtros: { [k]: null } });
  };

  const selector = (clave: keyof Filtros, etiqueta: string, lista: { id: number; nombre: string }[]) => (
    <label className="flex min-w-[120px] flex-1 flex-col text-[10px] font-semibold uppercase tracking-wider text-white/75">
      {etiqueta}
      <select
        value={seleccion.filtros[clave] ?? ""}
        onChange={(e) => filtro(clave, e.target.value)}
        className={`${control} mt-1 max-w-full truncate`}
      >
        <option value="">Todos</option>
        {lista.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
      </select>
    </label>
  );

  return (
    <header className="overflow-hidden rounded-2xl text-white shadow-[0_12px_32px_-16px_rgba(67,56,202,0.55)]">
      <div className="relative bg-[linear-gradient(120deg,#3730a3_0%,#5b3fd6_42%,#7c3aed_68%,#0891b2_100%)] px-4 pb-4 pt-4 sm:px-6">
        {/* Brillo de acento dorado, discreto. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow">
              <Image src="/logo-violinistar.png" alt="VioliniStar" width={40} height={40} className="h-9 w-9 object-contain" priority />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Finanzas · VioliniStar</h1>
              <p className="text-sm text-white/85">
                {d.periodo.etiqueta} <span className="text-white/60">{d.comparacion.etiqueta}</span>
                {cargando && <span className="ml-2 inline-flex items-center gap-1 text-amber-200" role="status">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> Actualizando…
                </span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={enlacePdf}
               className="rounded-lg bg-amber-300 px-3 py-1.5 text-sm font-semibold text-vs-tinta no-underline shadow-sm transition hover:bg-amber-200">
              ↓ Descargar reporte PDF
            </a>
            <a href={enlaceCsv}
               className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium text-white no-underline hover:bg-white/10">
              ↓ CSV flujo
            </a>
            {acciones}
          </div>
        </div>

        {/* Periodo y filtros: una sola fila sobre las gráficas. */}
        <div className="relative mt-4 flex flex-wrap items-end gap-2.5">
          <div className="flex shrink-0 flex-col text-[10px] font-semibold uppercase tracking-wider text-white/75">
            Vista
            <div className="mt-1 inline-flex rounded-lg bg-white/15 p-0.5" role="group" aria-label="Vista mensual o anual">
              <button type="button" aria-pressed={p.modo === "mes"}
                      onClick={() => navegar({ periodo: { modo: "mes", mes: p.modo === "mes" ? p.mes : `${p.anio}-${String(new Date().getMonth() + 1).padStart(2, "0")}` } })}
                      className={`rounded-md px-3 py-1 text-sm ${p.modo === "mes" ? "bg-white font-semibold text-indigo-900" : "text-white"}`}>
                Mensual
              </button>
              <button type="button" aria-pressed={p.modo === "anio"}
                      onClick={() => navegar({ periodo: { modo: "anio", anio: p.modo === "anio" ? p.anio : Number(p.mes.slice(0, 4)) } })}
                      className={`rounded-md px-3 py-1 text-sm ${p.modo === "anio" ? "bg-white font-semibold text-indigo-900" : "text-white"}`}>
                Año completo
              </button>
            </div>
          </div>

          <div className="flex min-w-[190px] flex-col text-[10px] font-semibold uppercase tracking-wider text-white/75">
            {p.modo === "mes" ? "Mes" : "Año"}
            {p.modo === "mes" ? (
              <div className="mt-1 flex items-center gap-1">
                <button type="button" aria-label="Mes anterior" onClick={() => navegar({ periodo: { modo: "mes", mes: mesAnterior(p.mes) } })}
                        className="rounded-md bg-white/15 px-2 py-1.5 text-sm hover:bg-white/25">‹</button>
                <input type="month" value={p.mes} aria-label="Mes"
                       onChange={(e) => e.target.value && navegar({ periodo: { modo: "mes", mes: e.target.value } })}
                       className={`${control} min-w-0`} />
                <button type="button" aria-label="Mes siguiente" onClick={() => navegar({ periodo: { modo: "mes", mes: siguienteMes(p.mes) } })}
                        className="rounded-md bg-white/15 px-2 py-1.5 text-sm hover:bg-white/25">›</button>
              </div>
            ) : (
              <select value={p.anio} onChange={(e) => navegar({ periodo: { modo: "anio", anio: Number(e.target.value) } })}
                      className={`${control} mt-1`} aria-label="Año">
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>

          <label className="flex min-w-[150px] flex-1 flex-col text-[10px] font-semibold uppercase tracking-wider text-white/75">
            Comparar
            <select
              value={seleccion.comparacion} disabled={p.modo === "anio"}
              onChange={(e) => navegar({ comparacion: e.target.value as Seleccion["comparacion"] })}
              className={`${control} mt-1 disabled:opacity-70`}
            >
              {p.modo === "anio"
                ? <option value={seleccion.comparacion}>Año anterior</option>
                : <>
                    <option value="anterior">Mes anterior</option>
                    <option value="anio_pasado">Mismo mes del año pasado</option>
                  </>}
            </select>
          </label>

          <label className="flex min-w-[120px] flex-1 flex-col text-[10px] font-semibold uppercase tracking-wider text-white/75">
            Línea
            <select
              value={seleccion.filtros.linea}
              onChange={(e) => navegar({ filtros: { linea: e.target.value as Filtros["linea"] } })}
              className={`${control} mt-1 max-w-full truncate`}
            >
              <option value="todo">Clases y productos</option>
              <option value="clases">Solo clases</option>
              <option value="productos">Solo productos</option>
            </select>
          </label>
          {selector("programaId", "Programa", d.catalogos.programas)}
          {selector("instrumentoId", "Instrumento", d.catalogos.instrumentos)}
          {selector("sedeId", "Sede", d.catalogos.sedes)}
          {selector("docenteId", "Maestro", d.catalogos.docentes)}
        </div>

        {d.filtrosActivos.length > 0 && (
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-white/75">Filtrando:</span>
            {d.filtrosActivos.map((f) => (
              <button key={f.dimension} type="button" onClick={() => quitar(f.dimension)}
                      className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 font-medium text-indigo-900 hover:bg-white">
                {f.dimension}: {f.valor} <span aria-hidden="true">×</span>
                <span className="sr-only">Quitar filtro</span>
              </button>
            ))}
            <button type="button" className="text-white/85 underline hover:text-white"
                    onClick={() => navegar({ filtros: { linea: "todo", programaId: null, instrumentoId: null, sedeId: null, docenteId: null, categoriaId: null } })}>
              Quitar todos
            </button>
          </div>
        )}
      </div>

    </header>
  );
}
