"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  PALETAS, WIDGETS, agregarWidget, ocultos, paletaDe, quitarWidget, tipoDe,
  type Diseno, type IdWidget, type Posicion, type TipoGrafica,
} from "@/lib/finanzas/diseno";
import { escribirSeleccion, type Seleccion } from "@/lib/finanzas/parametros";
import type { Dashboard, Filtros } from "@/lib/finanzas/tipos";
import { guardarDisenoAccion, restablecerDisenoAccion } from "./acciones";
import { BarraFiltros } from "./filtros";
import {
  GraficaCanales, GraficaCategorias, GraficaFlujo, GraficaInstrumentos, GraficaMensual, GraficaProfitFirst,
  GraficaRentabilidad, GraficaRetencion, GraficaTreemap, SinDatos,
} from "./graficas";
import { MatrizEgresos } from "./matriz";
import { Equilibrio, Observaciones, RejillaKpis } from "./piezas";

const Rejilla = WidthProvider(Responsive);

const NOMBRE_TIPO: Record<TipoGrafica, string> = {
  barras: "Barras", lineas: "Líneas", area: "Área", dona: "Dona", tabla: "Tabla", treemap: "Mapa de árbol",
};

export function Tablero({
  d, seleccion, disenoInicial, retencionMeta, enlacePdf, enlaceCsv,
}: {
  d: Dashboard;
  seleccion: Seleccion;
  disenoInicial: Diseno;
  retencionMeta: number;
  enlacePdf: string;
  enlaceCsv: string;
}) {
  const router = useRouter();
  const [cargando, iniciar] = useTransition();
  const [diseno, setDiseno] = useState<Diseno>(disenoInicial);
  const [respaldo, setRespaldo] = useState<Diseno>(disenoInicial);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const paleta = paletaDe(diseno);

  // ── Navegación: todo el estado vive en la URL (se comparte y se imprime igual). ──
  const navegar = (cambios: Parameters<typeof escribirSeleccion>[1]) =>
    iniciar(() => router.push(`/finanzas?${escribirSeleccion(seleccion, cambios)}`, { scroll: false }));
  const alternarFiltro = (clave: keyof Filtros, id: number | null) =>
    navegar({ filtros: { [clave]: id === null || seleccion.filtros[clave] === id ? null : id } });
  const verMes = (mes: string) => navegar({ periodo: { modo: "mes", mes } });
  const mesSeleccionado = seleccion.periodo.modo === "mes" ? seleccion.periodo.mes : null;

  // ── Diseño ──
  const posiciones = diseno.posiciones;
  const layoutLg: Layout[] = posiciones.map((p) => {
    const def = WIDGETS.find((w) => w.id === p.i)!;
    return { ...p, minW: def.minW, minH: def.minH };
  });
  const layoutSm: Layout[] = useMemo(() => {
    let y = 0;
    return [...posiciones].sort((a, b) => a.y - b.y || a.x - b.x).map((p) => {
      const fila = { i: p.i, x: 0, y, w: 1, h: p.h, static: true };
      y += p.h;
      return fila;
    });
  }, [posiciones]);

  const alCambiar = (actual: Layout[], todos: Partial<Record<string, Layout[]>>) => {
    if (!editando) return;
    const lg = todos.lg ?? actual;
    setDiseno((dd) => ({
      ...dd,
      posiciones: lg
        .filter((l) => WIDGETS.some((w) => w.id === l.i))
        .map((l): Posicion => ({ i: l.i as IdWidget, x: l.x, y: l.y, w: l.w, h: l.h })),
    }));
  };

  const guardar = async () => {
    setGuardando(true);
    const r = await guardarDisenoAccion(diseno);
    setGuardando(false);
    if (r.ok && r.diseno) {
      setDiseno(r.diseno);
      setRespaldo(r.diseno);
      setEditando(false);
      setAviso("Diseño guardado.");
    } else {
      setAviso(r.error ?? "No se pudo guardar el diseño.");
    }
  };
  const cancelar = () => { setDiseno(respaldo); setEditando(false); };
  const restablecer = async () => {
    await restablecerDisenoAccion();
    router.refresh();
    setEditando(false);
  };

  // ── Contenido de cada widget ──
  const contenido = (id: IdWidget): ReactNode => {
    const tipo = tipoDe(diseno, id) ?? "barras";
    switch (id) {
      case "kpis": return <RejillaKpis d={d} />;
      case "equilibrio": return <Equilibrio d={d} color={paleta.series[0]} />;
      case "observaciones": return <Observaciones d={d} />;
      case "mensual":
        return <GraficaMensual serie={d.serie} tipo={tipo} paleta={paleta} mesSeleccionado={mesSeleccionado} onMes={verMes} />;
      case "categorias":
        return <GraficaCategorias categorias={d.categorias} tipo={tipo} seleccionada={seleccion.filtros.categoriaId}
                                  onCategoria={(id) => alternarFiltro("categoriaId", id)} />;
      case "treemap":
        return <GraficaTreemap categorias={d.categorias} tipo={tipo} onCategoria={(id) => alternarFiltro("categoriaId", id)} />;
      case "programas":
        return <GraficaRentabilidad filas={d.programas} tipo={tipo} paleta={paleta} etiqueta="programas"
                                    seleccionado={seleccion.filtros.programaId}
                                    onSeleccion={(id) => alternarFiltro("programaId", id)} />;
      case "flujo": return <GraficaFlujo serie={d.serie} tipo={tipo} paleta={paleta} />;
      case "retencion": return <GraficaRetencion serie={d.serie} tipo={tipo} paleta={paleta} meta={retencionMeta} />;
      case "cac": return <GraficaCanales canales={d.canales} tipo={tipo} paleta={paleta} />;
      case "instrumentos":
        return <GraficaInstrumentos filas={d.instrumentos} tipo={tipo} paleta={paleta}
                                    seleccionado={seleccion.filtros.instrumentoId}
                                    onSeleccion={(id) => alternarFiltro("instrumentoId", id)} />;
      case "matriz":
        return <MatrizEgresos matriz={d.matriz} anio={d.periodo.anio} onMes={verMes}
                              onCategoria={(id) => alternarFiltro("categoriaId", id)} />;
      case "profit_first":
        return d.profitFirst
          ? <GraficaProfitFirst cuentas={d.profitFirst} tipo={tipo} paleta={paleta} />
          : <SinDatos texto="Profit First está apagado. Actívalo en Ajustes → Metas de finanzas." />;
    }
  };

  const titulo = (id: IdWidget) => {
    const base = WIDGETS.find((w) => w.id === id)!.titulo;
    if (id === "mensual" || id === "flujo" || id === "retencion" || id === "matriz") return `${base} · ${d.periodo.anio}`;
    return base;
  };

  return (
    <div className="space-y-4">
      <BarraFiltros
        d={d} seleccion={seleccion} cargando={cargando} navegar={navegar}
        enlacePdf={enlacePdf} enlaceCsv={enlaceCsv}
        acciones={
          editando ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-white/85">
                Paleta{" "}
                <select
                  value={diseno.paleta}
                  onChange={(e) => setDiseno((dd) => ({ ...dd, paleta: e.target.value }))}
                  className="ml-1 rounded-md border-0 bg-white/95 px-2 py-1 text-xs text-vs-tinta"
                >
                  {PALETAS.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              {ocultos(diseno).length > 0 && (
                <select
                  value=""
                  onChange={(e) => e.target.value && setDiseno((dd) => agregarWidget(dd, e.target.value as IdWidget))}
                  className="rounded-md border-0 bg-white/95 px-2 py-1 text-xs text-vs-tinta"
                  aria-label="Agregar gráfica"
                >
                  <option value="">+ Agregar gráfica…</option>
                  {ocultos(diseno).map((w) => <option key={w.id} value={w.id}>{w.titulo}</option>)}
                </select>
              )}
              <button type="button" onClick={guardar} disabled={guardando}
                      className="rounded-md bg-amber-300 px-3 py-1 text-xs font-semibold text-vs-tinta hover:bg-amber-200 disabled:opacity-60">
                {guardando ? "Guardando…" : "Guardar diseño"}
              </button>
              <button type="button" onClick={cancelar} className="rounded-md px-2 py-1 text-xs text-white/90 hover:bg-white/10">Cancelar</button>
              <button type="button" onClick={restablecer} className="rounded-md px-2 py-1 text-xs text-white/75 underline hover:text-white">Restablecer</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setRespaldo(diseno); setEditando(true); setAviso(null); }}
                    className="rounded-md border border-white/40 px-3 py-1 text-xs font-medium text-white hover:bg-white/10">
              ⚙ Personalizar
            </button>
          )
        }
      />

      {aviso && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{aviso}</p>}
      {editando && (
        <p className="rounded-lg border border-dashed border-vs-naranja bg-amber-50/60 px-3 py-2 text-xs text-vs-tinta-2">
          Arrastra cada tarjeta por su barra superior y cámbiala de tamaño desde la esquina. En cada tarjeta
          puedes cambiar el tipo de gráfica o quitarla. En celular el acomodo es en una columna.
        </p>
      )}
      {d.sinDatos && (
        <p className="rounded-xl border border-dashed border-vs-linea bg-white p-5 text-center text-sm text-vs-tinta-3">
          Sin movimientos en {d.periodo.etiqueta.toLowerCase()} con estos filtros. Cambia el periodo o quita filtros.
        </p>
      )}

      <div aria-busy={cargando} className={`transition-opacity duration-200 ${cargando ? "pointer-events-none opacity-60" : ""}`}>
        <Rejilla
          layouts={{ lg: layoutLg, md: layoutLg, sm: layoutSm }}
          breakpoints={{ lg: 1100, md: 760, sm: 0 }}
          cols={{ lg: 12, md: 12, sm: 1 }}
          rowHeight={30}
          margin={[14, 14]}
          containerPadding={[0, 0]}
          isDraggable={editando}
          isResizable={editando}
          draggableHandle=".asa-tarjeta"
          compactType="vertical"
          onLayoutChange={alCambiar}
          useCSSTransforms
        >
          {posiciones.map((p, i) => {
            const def = WIDGETS.find((w) => w.id === p.i)!;
            const tipo = tipoDe(diseno, p.i);
            return (
              // react-grid-layout posiciona este div con `transform`: la animación de
              // entrada (que también usa transform) va en la tarjeta de adentro.
              <div key={p.i}>
              <section
                style={{ ["--i" as string]: Math.min(i, 8) }}
                className={`entrar flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(34,26,14,0.05),0_8px_24px_-12px_rgba(34,26,14,0.18)] ${
                  editando ? "border-vs-naranja/70 ring-2 ring-vs-naranja/20" : "border-vs-linea"}`}
                aria-label={titulo(p.i)}
              >
                <header className={`flex items-center justify-between gap-2 px-4 pt-3 ${editando ? "asa-tarjeta cursor-move" : ""}`}>
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-semibold text-vs-tinta">
                    {editando && <span aria-hidden="true" className="text-vs-tinta-3">⋮⋮</span>}
                    <span className="truncate">{titulo(p.i)}</span>
                  </h2>
                  {editando && (
                    <div className="flex shrink-0 items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                      {def.tipos.length > 1 && tipo && (
                        <select
                          value={tipo} aria-label={`Tipo de gráfica de ${def.titulo}`}
                          onChange={(e) => setDiseno((dd) => ({ ...dd, tipos: { ...dd.tipos, [p.i]: e.target.value as TipoGrafica } }))}
                          className="rounded border border-vs-linea bg-white px-1.5 py-0.5 text-[11px]"
                        >
                          {def.tipos.map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
                        </select>
                      )}
                      <button
                        type="button" onClick={() => setDiseno((dd) => quitarWidget(dd, p.i))}
                        className="rounded px-1.5 text-sm text-vs-tinta-3 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Quitar ${def.titulo}`} title="Quitar del dashboard"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </header>
                <div className="min-h-0 flex-1 px-4 pb-4 pt-2">{contenido(p.i)}</div>
              </section>
              </div>
            );
          })}
        </Rejilla>
      </div>
    </div>
  );
}
