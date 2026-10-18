"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis,
} from "recharts";

import type {
  FilaCanal, FilaInstrumento, FilaMes, FilaRentable, GastoCategoria,
} from "@/lib/finanzas/tipos";
import type { CuentaProfitFirst } from "@/lib/finanzas/profit-first";
import type { Paleta, TipoGrafica } from "@/lib/finanzas/diseno";
import { pesosExactos } from "@/lib/formato";

/**
 * Gráficas del dashboard de finanzas.
 *
 * Reglas (guía de visualización): un solo eje por gráfica, marcas delgadas con
 * esquinas de 4 px ancladas a la base, líneas de 2 px, cuadrícula discreta y sin
 * guiones, leyenda cuando hay dos o más series, tooltip siempre, y etiquetas de
 * valor solo donde ayudan (mes elegido y máximo), nunca en cada barra. El texto va
 * en tinta, nunca en el color de la serie.
 */

const TINTA = "#221a0e";
const TINTA_2 = "#4a3b28";
const TINTA_3 = "#6e5c45";
const REJILLA = "#ece5d0";
const NEGATIVO = "#e34948";

export const compacto = (centavos: number) => {
  const p = centavos / 100;
  const abs = Math.abs(p);
  const signo = p < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${signo}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${signo}$${abs.toFixed(0)}`;
};
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);

const ejeX = { tick: { fill: TINTA_3, fontSize: 11 }, tickLine: false, axisLine: { stroke: REJILLA } } as const;
const ejeY = { tick: { fill: TINTA_3, fontSize: 11 }, tickLine: false, axisLine: false, width: 56 } as const;

// ── Tooltip ───────────────────────────────────────────────────────────────────

type Renglon = { color?: string; nombre: string; valor: string; fuerte?: boolean };

function Caja({ titulo, renglones, pie }: { titulo: string; renglones: Renglon[]; pie?: string }) {
  return (
    <div className="min-w-44 rounded-lg border border-vs-linea bg-white px-3 py-2 text-xs shadow-lg" style={{ color: TINTA }}>
      <p className="mb-1 font-semibold">{titulo}</p>
      {renglones.map((r) => (
        <p key={r.nombre} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5" style={{ color: TINTA_2 }}>
            {r.color && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.nombre}
          </span>
          <span className={`tabular-nums ${r.fuerte ? "font-semibold" : ""}`}>{r.valor}</span>
        </p>
      ))}
      {pie && <p className="mt-1 border-t border-vs-linea pt-1" style={{ color: TINTA_3 }}>{pie}</p>}
    </div>
  );
}

type PropsTooltip<T> = { active?: boolean; payload?: readonly { payload?: T }[] };
function primero<T>(p: PropsTooltip<T>): T | null {
  return (p.active && p.payload && p.payload.length > 0 ? p.payload[0]!.payload : null) ?? null;
}

function Leyenda({ items }: { items: { color: string; nombre: string; linea?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: TINTA_2 }}>
      {items.map((i) => (
        <li key={i.nombre} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={i.linea ? "h-0.5 w-4 rounded" : "h-2.5 w-2.5 rounded-sm"} style={{ background: i.color }} />
          {i.nombre}
        </li>
      ))}
    </ul>
  );
}

function Degradado({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.72} />
    </linearGradient>
  );
}

// ── 1. Ingresos vs egresos por mes ────────────────────────────────────────────

export function GraficaMensual({
  serie, tipo, paleta, mesSeleccionado, onMes,
}: {
  serie: FilaMes[];
  tipo: TipoGrafica;
  paleta: Paleta;
  mesSeleccionado: string | null;
  onMes: (mes: string) => void;
}) {
  const [cIng, cCosto, cGastos, cRes] = paleta.series;
  const datos = serie.map((s) => (s.futuro
    ? { ...s, ingresos: null, costoDocente: null, costoProductos: null, gastos: null, egresos: null, resultado: null }
    : s));
  const max = Math.max(...serie.filter((s) => !s.futuro).map((s) => s.ingresos), 0);
  const hayProductos = serie.some((s) => !s.futuro && s.costoProductos > 0);
  const etiquetar = (mes: string, valor: number) => mes === mesSeleccionado || (valor === max && max > 0);

  const tooltip = (p: PropsTooltip<FilaMes>) => {
    const f = primero(p);
    if (!f || f.futuro) return null;
    return (
      <Caja
        titulo={`${f.etiqueta} · clic para ver el mes`}
        renglones={[
          { color: cIng, nombre: "Ingresos", valor: pesosExactos(f.ingresos), fuerte: true },
          { color: cCosto, nombre: "Costo docente", valor: pesosExactos(f.costoDocente) },
          ...(f.costoProductos > 0 ? [{ color: cCosto, nombre: "Costo de productos", valor: pesosExactos(f.costoProductos) }] : []),
          { color: cGastos, nombre: "Gastos", valor: pesosExactos(f.gastos) },
          { color: cRes, nombre: "Resultado", valor: pesosExactos(f.resultado), fuerte: true },
        ]}
        pie={`Margen neto ${pct(f.margenNeto)}`}
      />
    );
  };

  const clic = (e: unknown) => {
    const mes = (e as { activeLabel?: string; activePayload?: { payload: FilaMes }[] })?.activePayload?.[0]?.payload.mes;
    if (mes) onMes(mes);
  };

  const comun = (
    <>
      <CartesianGrid vertical={false} stroke={REJILLA} />
      <XAxis dataKey="etiqueta" {...ejeX} />
      <YAxis {...ejeY} tickFormatter={compacto} />
      <Tooltip content={tooltip} cursor={{ fill: "rgba(34,26,14,0.04)" }} />
    </>
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <Leyenda items={[
        { color: cIng, nombre: "Ingresos" },
        { color: cCosto, nombre: tipo === "barras" ? "Costo docente" : "Egresos" },
        ...(tipo === "barras" && hayProductos ? [{ color: cCosto, nombre: "Costo de productos (tono claro)" }] : []),
        ...(tipo === "barras" ? [{ color: cGastos, nombre: "Gastos" }] : []),
        { color: cRes, nombre: "Resultado neto", linea: true },
      ]} />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {tipo === "lineas" ? (
            <LineChart data={datos} onClick={clic} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              {comun}
              <Line dataKey="ingresos" stroke={cIng} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line dataKey="egresos" stroke={cCosto} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line dataKey="resultado" stroke={cRes} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          ) : tipo === "area" ? (
            <AreaChart data={datos} onClick={clic} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              {comun}
              <Area dataKey="ingresos" stroke={cIng} strokeWidth={2} fill={cIng} fillOpacity={0.14} />
              <Area dataKey="egresos" stroke={cCosto} strokeWidth={2} fill={cCosto} fillOpacity={0.14} />
              <Line dataKey="resultado" stroke={cRes} strokeWidth={2} dot={false} />
            </AreaChart>
          ) : (
            <ComposedChart data={datos} onClick={clic} barGap={2} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <Degradado id="g-ing" color={cIng} />
                <Degradado id="g-costo" color={cCosto} />
                <Degradado id="g-gastos" color={cGastos} />
              </defs>
              {comun}
              <Bar dataKey="ingresos" fill="url(#g-ing)" radius={[4, 4, 0, 0]} maxBarSize={22} className="cursor-pointer">
                <LabelList
                  dataKey="ingresos"
                  content={(props) => {
                    const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                    const fila = datos[index];
                    if (!fila || value === null || !etiquetar(fila.mes, value)) return null;
                    return (
                      <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill={TINTA_2}>
                        {compacto(value)}
                      </text>
                    );
                  }}
                />
                {datos.map((d) => (
                  <Cell key={d.mes} fillOpacity={mesSeleccionado && d.mes !== mesSeleccionado ? 0.45 : 1} />
                ))}
              </Bar>
              <Bar dataKey="costoDocente" stackId="egresos" fill="url(#g-costo)" maxBarSize={22} className="cursor-pointer">
                {datos.map((d) => (
                  <Cell key={d.mes} fillOpacity={mesSeleccionado && d.mes !== mesSeleccionado ? 0.45 : 1} />
                ))}
              </Bar>
              {hayProductos && (
                <Bar dataKey="costoProductos" stackId="egresos" fill={cCosto} fillOpacity={0.5} maxBarSize={22} className="cursor-pointer" />
              )}
              <Bar dataKey="gastos" stackId="egresos" fill="url(#g-gastos)" radius={[4, 4, 0, 0]} maxBarSize={22} className="cursor-pointer">
                {datos.map((d) => (
                  <Cell key={d.mes} fillOpacity={mesSeleccionado && d.mes !== mesSeleccionado ? 0.45 : 1} />
                ))}
              </Bar>
              <Line dataKey="resultado" stroke={cRes} strokeWidth={2} dot={{ r: 3, fill: cRes, strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 2. Gastos por categoría (dona o barras) ───────────────────────────────────

/** Más de seis rebanadas no se leen: el resto se agrupa en «Otras». */
function topCategorias(cats: GastoCategoria[], n = 6): GastoCategoria[] {
  if (cats.length <= n + 1) return cats;
  const resto = cats.slice(n);
  const total = resto.reduce((s, c) => s + c.total, 0);
  const todo = cats.reduce((s, c) => s + c.total, 0);
  return [...cats.slice(0, n), {
    id: null, nombre: `Otras (${resto.length})`, color: "#b8ad94", total,
    porcentaje: todo === 0 ? null : total / todo, subcategorias: [],
  }];
}

export function GraficaCategorias({
  categorias, tipo, seleccionada, onCategoria,
}: {
  categorias: GastoCategoria[];
  tipo: TipoGrafica;
  seleccionada: number | null;
  onCategoria: (id: number | null) => void;
}) {
  const datos = topCategorias(categorias);
  if (datos.length === 0) return <SinDatos texto="Sin gastos en el periodo." />;
  const total = categorias.reduce((s, c) => s + c.total, 0);

  const tooltip = (p: PropsTooltip<GastoCategoria>) => {
    const c = primero(p);
    if (!c) return null;
    return <Caja titulo={c.nombre} renglones={[
      { color: c.color, nombre: "Total", valor: pesosExactos(c.total), fuerte: true },
      { nombre: "Del total de gastos", valor: pct(c.porcentaje) },
    ]} pie={c.id !== null ? "Clic para filtrar el dashboard" : undefined} />;
  };
  const atenuar = (id: number | null) => (seleccionada !== null && id !== seleccionada ? 0.35 : 1);

  if (tipo === "barras") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nombre" width={128} tick={{ fill: TINTA_2, fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={tooltip} cursor={{ fill: "rgba(34,26,14,0.04)" }} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={18} className="cursor-pointer"
               onClick={(d) => onCategoria((d as unknown as GastoCategoria).id)}>
            <LabelList dataKey="porcentaje" position="right" formatter={(v: unknown) => pct(v as number)} fill={TINTA_2} fontSize={11} />
            {datos.map((c) => <Cell key={c.nombre} fill={c.color} fillOpacity={atenuar(c.id)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto]">
      <div className="relative h-full min-h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={tooltip} />
            <Pie
              data={datos} dataKey="total" nameKey="nombre" innerRadius="58%" outerRadius="88%"
              paddingAngle={2} stroke="#ffffff" strokeWidth={2} className="cursor-pointer"
              onClick={(d) => onCategoria((d as unknown as { payload: GastoCategoria }).payload?.id ?? null)}
              label={({ percent }: { percent?: number }) => (percent && percent >= 0.08 ? `${Math.round(percent * 100)} %` : "")}
              labelLine={false}
            >
              {datos.map((c) => <Cell key={c.nombre} fill={c.color} fillOpacity={atenuar(c.id)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: TINTA_3 }}>Total</span>
          <span className="font-display text-sm font-semibold tabular-nums">{compacto(total)}</span>
        </div>
      </div>
      <ul className="space-y-1 text-xs">
        {datos.map((c) => (
          <li key={c.nombre}>
            <button
              type="button" onClick={() => onCategoria(c.id)} disabled={c.id === null}
              className="flex w-full items-center justify-between gap-3 rounded px-1 py-0.5 text-left hover:bg-vs-crema disabled:cursor-default"
              style={{ opacity: atenuar(c.id) }}
            >
              <span className="inline-flex items-center gap-1.5" style={{ color: TINTA_2 }}>
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                {c.nombre}
              </span>
              <span className="tabular-nums" style={{ color: TINTA }}>{pct(c.porcentaje)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 3. Treemap de categoría y subcategoría ────────────────────────────────────

export function GraficaTreemap({
  categorias, tipo, onCategoria,
}: {
  categorias: GastoCategoria[];
  tipo: TipoGrafica;
  onCategoria: (id: number | null) => void;
}) {
  if (categorias.length === 0) return <SinDatos texto="Sin gastos en el periodo." />;

  if (tipo === "barras") {
    const filas = categorias.flatMap((c) => c.subcategorias.map((s) => ({
      nombre: `${c.nombre} · ${s.nombre}`, total: s.total, color: c.color, id: c.id,
    }))).sort((a, b) => b.total - a.total).slice(0, 10);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nombre" width={170} tick={{ fill: TINTA_2, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={(p: PropsTooltip<(typeof filas)[number]>) => {
            const f = primero(p);
            return f ? <Caja titulo={f.nombre} renglones={[{ color: f.color, nombre: "Total", valor: pesosExactos(f.total), fuerte: true }]} /> : null;
          }} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList dataKey="total" position="right" formatter={(v: unknown) => compacto(v as number)} fill={TINTA_2} fontSize={10} />
            {filas.map((f) => <Cell key={f.nombre} fill={f.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const datos = categorias.map((c) => ({
    name: c.nombre, id: c.id, color: c.color,
    children: c.subcategorias.map((s) => ({ name: s.nombre, size: s.total, color: c.color, categoria: c.nombre, id: c.id })),
  }));

  type Nodo = { x: number; y: number; width: number; height: number; name: string; color?: string; depth: number; size?: number; categoria?: string };
  const Contenido = (props: unknown) => {
    const n = props as Nodo;
    if (n.depth !== 2) return <g />;
    const cabe = n.width > 56 && n.height > 26;
    return (
      <g>
        <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={4} fill={n.color} stroke="#ffffff" strokeWidth={2} />
        {cabe && (
          <>
            <text x={n.x + 6} y={n.y + 15} fontSize={11} fontWeight={600} fill="#ffffff">{n.name}</text>
            {n.height > 40 && n.size !== undefined && (
              <text x={n.x + 6} y={n.y + 29} fontSize={10} fill="#ffffff" fillOpacity={0.9}>{compacto(n.size)}</text>
            )}
          </>
        )}
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={datos} dataKey="size" isAnimationActive={false} content={Contenido}
        onClick={(n) => onCategoria((n as unknown as { id?: number | null }).id ?? null)}
      >
        <Tooltip content={(p: PropsTooltip<{ name: string; size: number; categoria: string; color: string }>) => {
          const f = primero(p);
          return f && f.categoria
            ? <Caja titulo={`${f.categoria} · ${f.name}`} renglones={[{ color: f.color, nombre: "Total", valor: pesosExactos(f.size), fuerte: true }]} />
            : null;
        }} />
      </Treemap>
    </ResponsiveContainer>
  );
}

// ── 4. Margen por programa ────────────────────────────────────────────────────

export function GraficaRentabilidad({
  filas, tipo, paleta, seleccionado, onSeleccion, etiqueta,
}: {
  filas: FilaRentable[];
  tipo: TipoGrafica;
  paleta: Paleta;
  seleccionado: number | null;
  onSeleccion: (id: number | null) => void;
  etiqueta: string;
}) {
  if (filas.length === 0) return <SinDatos texto={`Sin ${etiqueta} con movimiento en el periodo.`} />;

  if (tipo === "tabla") return <TablaRentabilidad filas={filas} />;

  const tooltip = (p: PropsTooltip<FilaRentable>) => {
    const f = primero(p);
    if (!f) return null;
    return <Caja titulo={`${f.posicion}. ${f.nombre}`} renglones={[
      { nombre: "Ingresos", valor: pesosExactos(f.ingresos) },
      { nombre: "Costo docente", valor: pesosExactos(f.costoDocente) },
      { nombre: "Margen", valor: `${pesosExactos(f.margen)} (${pct(f.margenPct)})`, fuerte: true },
      { nombre: "Horas impartidas", valor: String(f.horas) },
      { nombre: "Ingreso por hora", valor: f.ingresoPorHora === null ? "—" : pesosExactos(f.ingresoPorHora) },
      { nombre: "Alumnos activos", valor: String(f.alumnos) },
    ]} pie="Clic para filtrar el dashboard" />;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={REJILLA} />
        <XAxis type="number" {...ejeX} tickFormatter={compacto} />
        <YAxis type="category" dataKey="nombre" width={140} tick={{ fill: TINTA_2, fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={tooltip} cursor={{ fill: "rgba(34,26,14,0.04)" }} />
        <Bar dataKey="margen" radius={[0, 4, 4, 0]} maxBarSize={18} className="cursor-pointer"
             onClick={(d) => onSeleccion((d as unknown as FilaRentable).id)}>
          <LabelList dataKey="margenPct" position="right" formatter={(v: unknown) => pct(v as number | null)} fill={TINTA_2} fontSize={11} />
          {filas.map((f) => (
            <Cell key={f.id} fill={f.margen < 0 ? NEGATIVO : paleta.series[0]}
                  fillOpacity={seleccionado !== null && f.id !== seleccionado ? 0.35 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TablaRentabilidad({ filas }: { filas: FilaRentable[] }) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[520px] text-xs tabular-nums">
        <thead className="sticky top-0 bg-white">
          <tr className="text-[10px] uppercase tracking-wider" style={{ color: TINTA_3 }}>
            <th className="px-2 py-1.5 text-left">#</th>
            <th className="px-2 py-1.5 text-left">Nombre</th>
            <th className="px-2 py-1.5 text-right">Alumnos</th>
            <th className="px-2 py-1.5 text-right">Ingresos</th>
            <th className="px-2 py-1.5 text-right">Horas</th>
            <th className="px-2 py-1.5 text-right">Costo</th>
            <th className="px-2 py-1.5 text-right">Margen</th>
            <th className="px-2 py-1.5 text-right">%</th>
            <th className="px-2 py-1.5 text-right">$/hora</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-vs-linea">
              <td className="px-2 py-1.5">{f.posicion}</td>
              <td className="px-2 py-1.5 font-medium">{f.nombre}</td>
              <td className="px-2 py-1.5 text-right">{f.alumnos}</td>
              <td className="px-2 py-1.5 text-right">{pesosExactos(f.ingresos)}</td>
              <td className="px-2 py-1.5 text-right">{f.horas}</td>
              <td className="px-2 py-1.5 text-right">{pesosExactos(f.costoDocente)}</td>
              <td className={`px-2 py-1.5 text-right font-semibold ${f.margen < 0 ? "text-red-700" : ""}`}>{pesosExactos(f.margen)}</td>
              <td className="px-2 py-1.5 text-right">{pct(f.margenPct)}</td>
              <td className="px-2 py-1.5 text-right">{f.ingresoPorHora === null ? "—" : pesosExactos(f.ingresoPorHora)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 5. Flujo de caja acumulado ────────────────────────────────────────────────

export function GraficaFlujo({ serie, tipo, paleta }: { serie: FilaMes[]; tipo: TipoGrafica; paleta: Paleta }) {
  const datos = serie.filter((s) => !s.futuro);
  if (datos.length === 0) return <SinDatos texto="Sin movimientos todavía este año." />;
  const color = paleta.series[0];
  const tooltip = (p: PropsTooltip<FilaMes>) => {
    const f = primero(p);
    if (!f) return null;
    return <Caja titulo={f.etiqueta} renglones={[
      { nombre: "Recibido", valor: pesosExactos(f.recibido) },
      { nombre: "Pagado (nómina y gastos)", valor: pesosExactos(f.pagado) },
      { nombre: "Flujo del mes", valor: pesosExactos(f.flujo) },
      { color, nombre: "Acumulado del año", valor: pesosExactos(f.flujoAcumulado), fuerte: true },
    ]} />;
  };
  const comun = (
    <>
      <CartesianGrid vertical={false} stroke={REJILLA} />
      <XAxis dataKey="etiqueta" {...ejeX} />
      <YAxis {...ejeY} tickFormatter={compacto} />
      <Tooltip content={tooltip} />
    </>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {tipo === "barras" ? (
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {comun}
          <Bar dataKey="flujo" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {datos.map((d) => <Cell key={d.mes} fill={d.flujo < 0 ? NEGATIVO : color} />)}
          </Bar>
        </BarChart>
      ) : tipo === "lineas" ? (
        <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {comun}
          <Line dataKey="flujoAcumulado" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} />
        </LineChart>
      ) : (
        <AreaChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="g-flujo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          {comun}
          <Area dataKey="flujoAcumulado" stroke={color} strokeWidth={2} fill="url(#g-flujo)" activeDot={{ r: 4 }} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

// ── 6. Retención mensual ──────────────────────────────────────────────────────

export function GraficaRetencion({
  serie, tipo, paleta, meta,
}: { serie: FilaMes[]; tipo: TipoGrafica; paleta: Paleta; meta: number }) {
  const datos = serie.filter((s) => !s.futuro).map((s) => ({ ...s, retencionPct: s.retencion === null ? null : s.retencion * 100 }));
  if (datos.length === 0) return <SinDatos texto="Sin alumnos todavía este año." />;
  const color = paleta.series[3];
  const tooltip = (p: PropsTooltip<FilaMes>) => {
    const f = primero(p);
    if (!f) return null;
    return <Caja titulo={f.etiqueta} renglones={[
      { color, nombre: "Retención", valor: pct(f.retencion), fuerte: true },
      { nombre: "Activos al cierre", valor: String(f.activos) },
      { nombre: "Altas / bajas", valor: `${f.altas} / ${f.bajas}` },
    ]} pie={`Meta ${pct(meta)}`} />;
  };
  const comun = (
    <>
      <CartesianGrid vertical={false} stroke={REJILLA} />
      <XAxis dataKey="etiqueta" {...ejeX} />
      <YAxis {...ejeY} domain={[(min: number) => Math.max(0, Math.floor(min / 10) * 10 - 10), 100]} tickFormatter={(v: number) => `${v} %`} />
      <Tooltip content={tooltip} />
    </>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {tipo === "barras" ? (
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {comun}
          <Bar dataKey="retencionPct" fill={color} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      ) : (
        <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {comun}
          <Line dataKey="retencionPct" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

// ── 7. CAC por canal ──────────────────────────────────────────────────────────

export function GraficaCanales({ canales, tipo, paleta }: { canales: FilaCanal[]; tipo: TipoGrafica; paleta: Paleta }) {
  if (canales.length === 0) return <SinDatos texto="Sin alumnos nuevos ni publicidad en el periodo." />;
  if (tipo === "tabla") {
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-xs tabular-nums">
          <thead><tr className="text-[10px] uppercase tracking-wider" style={{ color: TINTA_3 }}>
            <th className="px-2 py-1.5 text-left">Canal</th><th className="px-2 py-1.5 text-right">Nuevos</th>
            <th className="px-2 py-1.5 text-right">Publicidad</th><th className="px-2 py-1.5 text-right">CAC</th>
          </tr></thead>
          <tbody>{canales.map((c) => (
            <tr key={c.canal} className="border-t border-vs-linea">
              <td className="px-2 py-1.5 font-medium">{c.etiqueta}</td>
              <td className="px-2 py-1.5 text-right">{c.nuevos}</td>
              <td className="px-2 py-1.5 text-right">{pesosExactos(c.gasto)}</td>
              <td className="px-2 py-1.5 text-right font-semibold">{c.cac === null ? "—" : pesosExactos(c.cac)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  const datos = canales.map((c) => ({ ...c, valor: c.cac ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={datos} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={REJILLA} />
        <XAxis dataKey="etiqueta" {...ejeX} interval={0} tick={{ fill: TINTA_3, fontSize: 10 }} />
        <YAxis {...ejeY} tickFormatter={compacto} />
        <Tooltip content={(p: PropsTooltip<FilaCanal>) => {
          const c = primero(p);
          return c ? <Caja titulo={c.etiqueta} renglones={[
            { nombre: "Alumnos nuevos", valor: String(c.nuevos) },
            { nombre: "Publicidad", valor: pesosExactos(c.gasto) },
            { color: paleta.series[0], nombre: "CAC", valor: c.cac === null ? "Sin alumnos nuevos" : pesosExactos(c.cac), fuerte: true },
          ]} /> : null;
        }} cursor={{ fill: "rgba(34,26,14,0.04)" }} />
        <Bar dataKey="valor" fill={paleta.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28}>
          <LabelList dataKey="nuevos" position="top" formatter={(v: unknown) => `${v} nuevo${v === 1 ? "" : "s"}`} fill={TINTA_3} fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 8. Instrumentos: tendencia de 6 meses (múltiplos pequeños) ────────────────

export function GraficaInstrumentos({
  filas, tipo, paleta, seleccionado, onSeleccion,
}: {
  filas: FilaInstrumento[];
  tipo: TipoGrafica;
  paleta: Paleta;
  seleccionado: number | null;
  onSeleccion: (id: number | null) => void;
}) {
  if (filas.length === 0) return <SinDatos texto="Sin instrumentos con movimiento." />;
  if (tipo === "tabla") return <TablaRentabilidad filas={filas} />;
  if (tipo === "barras") {
    return <GraficaRentabilidad filas={filas} tipo="barras" paleta={paleta} seleccionado={seleccionado} onSeleccion={onSeleccion} etiqueta="instrumentos" />;
  }
  return (
    <div className="grid h-full auto-rows-fr grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
      {filas.map((f) => {
        const color = f.margen < 0 ? NEGATIVO : paleta.series[0];
        return (
          <button
            key={f.id} type="button" onClick={() => onSeleccion(f.id)}
            className={`flex min-h-24 flex-col rounded-lg border p-2 text-left transition hover:border-vs-naranja ${
              seleccionado === f.id ? "border-vs-naranja-700" : "border-vs-linea"}`}
          >
            <span className="truncate text-xs font-semibold">{f.nombre}</span>
            <span className="text-[11px] tabular-nums" style={{ color: TINTA_3 }}>
              {f.alumnos} alumnos · margen {pct(f.margenPct)}
            </span>
            <div className="mt-1 min-h-10 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={f.tendencia} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <Tooltip content={(p: PropsTooltip<FilaInstrumento["tendencia"][number]>) => {
                    const t = primero(p);
                    return t ? <Caja titulo={`${f.nombre} · ${t.etiqueta}`} renglones={[
                      { nombre: "Ingresos", valor: pesosExactos(t.ingresos) },
                      { color, nombre: "Margen", valor: pesosExactos(t.margen), fuerte: true },
                    ]} /> : null;
                  }} />
                  <Line dataKey="margen" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── 9. Profit First ───────────────────────────────────────────────────────────

export function GraficaProfitFirst({ cuentas, tipo, paleta }: { cuentas: CuentaProfitFirst[]; tipo: TipoGrafica; paleta: Paleta }) {
  const [cObjetivo, , , cReal] = paleta.series;
  if (tipo === "tabla") {
    return (
      <table className="w-full text-xs tabular-nums">
        <thead><tr className="text-[10px] uppercase tracking-wider" style={{ color: TINTA_3 }}>
          <th className="px-2 py-1.5 text-left">Cuenta</th><th className="px-2 py-1.5 text-right">%</th>
          <th className="px-2 py-1.5 text-right">Objetivo</th><th className="px-2 py-1.5 text-right">Real</th>
          <th className="px-2 py-1.5 text-right">Diferencia</th>
        </tr></thead>
        <tbody>{cuentas.map((c) => (
          <tr key={c.clave} className="border-t border-vs-linea">
            <td className="px-2 py-1.5 font-medium">{c.nombre}</td>
            <td className="px-2 py-1.5 text-right">{pct(c.porcentaje)}</td>
            <td className="px-2 py-1.5 text-right">{pesosExactos(c.objetivo)}</td>
            <td className="px-2 py-1.5 text-right font-semibold">{pesosExactos(c.real)}</td>
            <td className="px-2 py-1.5 text-right">{pesosExactos(c.real - c.objetivo)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2">
      <Leyenda items={[{ color: cObjetivo, nombre: "Objetivo" }, { color: cReal, nombre: "Real" }]} />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cuentas} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis dataKey="nombre" {...ejeX} interval={0} />
            <YAxis {...ejeY} tickFormatter={compacto} />
            <Tooltip content={(p: PropsTooltip<CuentaProfitFirst>) => {
              const c = primero(p);
              return c ? <Caja titulo={`${c.nombre} (${pct(c.porcentaje)})`} renglones={[
                { color: cObjetivo, nombre: "Objetivo", valor: pesosExactos(c.objetivo) },
                { color: cReal, nombre: "Real", valor: pesosExactos(c.real), fuerte: true },
              ]} /> : null;
            }} cursor={{ fill: "rgba(34,26,14,0.04)" }} />
            <Bar dataKey="objetivo" fill={cObjetivo} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="real" fill={cReal} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SinDatos({ texto }: { texto: string }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center rounded-lg border border-dashed border-vs-linea text-center text-xs" style={{ color: TINTA_3 }}>
      {texto}
    </div>
  );
}

