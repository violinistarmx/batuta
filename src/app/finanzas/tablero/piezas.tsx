import type { Dashboard, Kpi } from "@/lib/finanzas/tipos";
import type { Semaforo } from "@/lib/finanzas/indicadores";
import { pesosExactos } from "@/lib/formato";

/**
 * Piezas sin gráfica del dashboard. El semáforo nunca va solo en color: lleva
 * ícono y palabra (paleta de estado reservada, distinta de las series).
 */

const ESTADO: Record<Semaforo, { color: string; fondo: string; icono: string; texto: string }> = {
  verde: { color: "#0a7d0a", fondo: "#e8f6e8", icono: "✓", texto: "En meta" },
  ambar: { color: "#8a5a00", fondo: "#fff4d6", icono: "!", texto: "Cerca del límite" },
  rojo: { color: "#b42f2f", fondo: "#fbe9e9", icono: "✕", texto: "Fuera de meta" },
  sin_dato: { color: "#6e5c45", fondo: "#f3efe3", icono: "–", texto: "Sin dato" },
};

export function valorKpi(k: Pick<Kpi, "valor" | "formato">): string {
  if (k.valor === null) return "—";
  if (k.formato === "moneda") return pesosExactos(k.valor);
  if (k.formato === "porcentaje") return `${(k.valor * 100).toFixed(1)} %`;
  return new Intl.NumberFormat("es-MX").format(k.valor);
}

function Variacion({ k, comparacion }: { k: Kpi; comparacion: string }) {
  if (k.variacion === null) return <span style={{ color: "#6e5c45" }}>Sin comparación {comparacion}</span>;
  const sube = k.variacion > 0;
  const plano = Math.abs(k.variacion) < 0.0005;
  const bueno = plano ? null : sube === k.subirEsBueno;
  const color = bueno === null ? "#6e5c45" : bueno ? "#0a7d0a" : "#b42f2f";
  const texto = k.formato === "porcentaje"
    ? `${sube ? "+" : ""}${(k.variacion * 100).toFixed(1)} pts`
    : `${sube ? "+" : ""}${(k.variacion * 100).toFixed(1)} %`;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" style={{ color }}>
      <span aria-hidden="true">{plano ? "■" : sube ? "▲" : "▼"}</span>
      {texto}
      <span style={{ color: "#6e5c45" }}>{comparacion}</span>
    </span>
  );
}

export function TarjetaKpi({ k, comparacion }: { k: Kpi; comparacion: string }) {
  const e = ESTADO[k.semaforo];
  return (
    <article
      className="flex min-w-0 flex-col justify-between rounded-xl border border-vs-linea bg-white p-3.5 shadow-[0_1px_2px_rgba(34,26,14,0.05),0_4px_14px_-6px_rgba(34,26,14,0.10)]"
      data-kpi={k.clave}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-vs-tinta-3">{k.titulo}</h3>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: e.color, background: e.fondo }}
          title={k.meta ?? undefined}
        >
          <span aria-hidden="true">{e.icono}</span>{e.texto}
        </span>
      </div>
      <p className="mt-1.5 truncate font-display text-[1.65rem] font-semibold leading-tight tabular-nums text-vs-tinta">
        {valorKpi(k)}
        {k.clave === "equilibrio" && k.valor !== null && <span className="ml-1 text-sm font-normal text-vs-tinta-3">alumnos</span>}
      </p>
      <div className="mt-1 space-y-0.5 text-[11px] leading-snug">
        <p><Variacion k={k} comparacion={comparacion} /></p>
        {k.detalle && <p className="truncate text-vs-tinta-2" title={k.detalle}>{k.detalle}</p>}
        {k.meta && <p className="text-vs-tinta-3">{k.meta}</p>}
      </div>
    </article>
  );
}

export function RejillaKpis({ d }: { d: Dashboard }) {
  return (
    <div className="grid h-full auto-rows-fr grid-cols-1 gap-3 overflow-auto min-[420px]:grid-cols-2 lg:grid-cols-5">
      {d.kpis.map((k) => <TarjetaKpi key={k.clave} k={k} comparacion={d.comparacion.etiqueta} />)}
    </div>
  );
}

export function Equilibrio({ d, color }: { d: Dashboard; color: string }) {
  const e = d.equilibrio;
  if (e.alumnosMinimos === null) {
    return (
      <p className="text-sm text-vs-tinta-2">
        Con el ingreso y el costo variable actuales por alumno no hay punto de equilibrio:
        cada alumno cuesta lo mismo o más de lo que aporta.
      </p>
    );
  }
  const avance = Math.min(1, e.avance ?? 0);
  const falta = e.alumnosMinimos - e.alumnosActuales;
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <p className="text-sm text-vs-tinta-2">
        <span className="font-display text-3xl font-semibold tabular-nums text-vs-tinta">{e.alumnosActuales}</span>
        <span className="mx-1">alumnos de</span>
        <span className="font-display text-xl font-semibold tabular-nums text-vs-tinta">{e.alumnosMinimos}</span>
        <span className="ml-1">necesarios</span>
      </p>
      <div
        role="progressbar" aria-valuemin={0} aria-valuemax={e.alumnosMinimos} aria-valuenow={e.alumnosActuales}
        aria-label="Alumnos actuales contra punto de equilibrio"
        className="h-3 overflow-hidden rounded-full bg-vs-crema ring-1 ring-vs-linea"
      >
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${avance * 100}%`, background: color }} />
      </div>
      <p className="text-xs text-vs-tinta-2">
        {falta > 0
          ? `Faltan ${falta} alumno${falta === 1 ? "" : "s"} para cubrir los gastos fijos.`
          : `${-falta} alumno${falta === -1 ? "" : "s"} por encima del equilibrio.`}
        {" "}Gastos fijos de {pesosExactos(e.gastosFijosMensuales)} al mes; cada alumno deja{" "}
        {pesosExactos(Math.round(e.contribucionPorAlumno))} después de su costo variable.
      </p>
    </div>
  );
}

export function Observaciones({ d }: { d: Dashboard }) {
  if (d.observaciones.length === 0) return <p className="text-sm text-vs-tinta-3">Sin observaciones.</p>;
  return (
    <ul className="h-full space-y-2 overflow-auto pr-1 text-sm text-vs-tinta-2">
      {d.observaciones.map((o) => (
        <li key={o} className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vs-naranja" />
          <span>{o}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ventas de productos: lo cobrado, su costo y el margen, en total y por producto. */
export function PanelProductos({ d }: { d: Dashboard }) {
  const r = d.productos;
  if (r.filas.length === 0) {
    return (
      <p className="text-sm text-vs-tinta-3">
        Sin ventas de productos cobradas en este periodo o con estos filtros. Un filtro de programa,
        instrumento o maestro deja fuera los productos porque no se pueden atribuir.
      </p>
    );
  }
  const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)} %`);
  const tarjetas: [string, string, string?][] = [
    ["Cobrado por productos", pesosExactos(r.ingresos)],
    ["Costo de lo vendido", pesosExactos(r.costo)],
    ["Margen", pesosExactos(r.margen), pct(r.margenPct)],
    ["Piezas vendidas", String(r.unidades)],
  ];
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tarjetas.map(([titulo, valor, extra]) => (
          <div key={titulo} className="rounded-lg border border-vs-linea bg-white px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-vs-tinta-3">{titulo}</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">
              {valor}{extra && <span className="ml-1.5 text-xs font-normal text-vs-tinta-3">{extra}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {r.sinCosto > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {pesosExactos(r.sinCosto)} cobrados de ventas sin costo registrado: no entran al margen.
          Da de alta el producto en Finanzas → Productos para que cuenten.
        </p>
      )}
      <table className="w-full text-xs">
        <thead className="text-left text-[10px] uppercase tracking-wider text-vs-tinta-3">
          <tr>
            <th className="py-1 font-semibold">Producto</th>
            <th className="py-1 text-right font-semibold">Piezas</th>
            <th className="py-1 text-right font-semibold">Cobrado</th>
            <th className="py-1 text-right font-semibold">Costo</th>
            <th className="py-1 text-right font-semibold">Margen</th>
            <th className="py-1 text-right font-semibold">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-vs-linea">
          {r.filas.map((f) => (
            <tr key={f.id ?? f.nombre}>
              <td className="py-1.5 pr-2">
                {f.nombre}
                {f.id === null && <span className="ml-1.5 text-[10px] text-vs-tinta-3">(concepto libre)</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums">{f.unidades}</td>
              <td className="py-1.5 text-right tabular-nums">{pesosExactos(f.ingresos)}</td>
              <td className="py-1.5 text-right tabular-nums">{f.sinCosto >= f.ingresos && f.ingresos > 0 ? "—" : pesosExactos(f.costo)}</td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: f.margen < 0 ? "#b42f2f" : undefined }}>
                {f.sinCosto >= f.ingresos && f.ingresos > 0 ? "—" : pesosExactos(f.margen)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-vs-tinta-3">{pct(f.margenPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
