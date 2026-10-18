"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { pesosExactos } from "@/lib/formato";
import {
  activarProductoAccion, crearProductoAccion, editarProductoAccion, revelarCostosAccion,
  type EstadoProducto,
} from "./acciones";

type Producto = {
  id: number; codigo: string | null; nombre: string; categoria: string;
  descripcion: string | null; precioCentavos: number; activo: boolean;
};
type Costo = { id: number; costoCentavos: number; margenCentavos: number; margenPct: number | null };

const CATEGORIAS: Record<string, string> = {
  metodo: "Método", instrumento: "Instrumento", accesorio: "Accesorio", papeleria: "Papelería", otro: "Otro",
};
/** Cuánto tiempo se queda el costo a la vista antes de ocultarse solo. */
const SEGUNDOS_VISIBLE = 20;

const campo = "w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

export function Catalogo({ productos }: { productos: Producto[] }) {
  const [costos, setCostos] = useState<Map<number, Costo> | null>(null);
  const [restante, setRestante] = useState(0);
  const [pendiente, empezar] = useTransition();
  const [editando, setEditando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ocultar = () => { setCostos(null); setRestante(0); };

  // Cuenta regresiva: el costo se oculta solo, también al cambiar de pestaña o ventana.
  useEffect(() => {
    if (costos === null) return;
    const t = setInterval(() => setRestante((r) => { if (r <= 1) { setCostos(null); return 0; } return r - 1; }), 1000);
    const alSalir = () => { if (document.hidden) ocultar(); };
    document.addEventListener("visibilitychange", alSalir);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", alSalir); };
  }, [costos]);

  const mostrar = () => empezar(async () => {
    setError(null);
    const r = await revelarCostosAccion();
    if (r.error || !r.costos) { setError(r.error ?? "No se pudieron cargar los costos."); return; }
    setCostos(new Map(r.costos.map((c) => [c.id, c])));
    setRestante(SEGUNDOS_VISIBLE);
  });

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormularioNuevo />
        {/* Discreto a propósito: texto pequeño y apagado, sin colores de alerta. */}
        <button
          type="button" onClick={costos ? ocultar : mostrar} disabled={pendiente}
          className="rounded-md px-2 py-1 text-xs text-vs-tinta-3 underline-offset-2 hover:text-vs-tinta-2 hover:underline disabled:opacity-60"
          aria-pressed={costos !== null}
        >
          {pendiente ? "…" : costos ? `Ocultar costos (${restante} s)` : "Mostrar costos"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-vs-linea bg-white">
        <table className="w-full text-sm">
          <thead className="bg-vs-crema text-left text-[11px] uppercase tracking-wider text-vs-tinta-3">
            <tr>
              <th className="px-3 py-2 font-semibold">Producto</th>
              <th className="px-3 py-2 font-semibold">Categoría</th>
              <th className="px-3 py-2 text-right font-semibold">Precio</th>
              {costos && <th className="px-3 py-2 text-right font-semibold">Costo</th>}
              {costos && <th className="px-3 py-2 text-right font-semibold">Margen</th>}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-vs-linea">
            {productos.length === 0 && (
              <tr><td colSpan={costos ? 6 : 4} className="px-3 py-6 text-center text-vs-tinta-3">
                Aún no hay productos. Agrega el primero.
              </td></tr>
            )}
            {productos.map((p) => {
              const c = costos?.get(p.id);
              return (
                <tr key={p.id} className={p.activo ? "" : "text-vs-tinta-3"}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{p.nombre}</span>
                    {p.codigo && <span className="ml-2 text-xs text-vs-tinta-3">{p.codigo}</span>}
                    {!p.activo && <span className="ml-2 rounded-full bg-vs-crema px-2 py-0.5 text-[10px]">Inactivo</span>}
                    {p.descripcion && <p className="text-xs text-vs-tinta-3">{p.descripcion}</p>}
                    {editando === p.id && <FormularioEditar p={p} alTerminar={() => setEditando(null)} />}
                  </td>
                  <td className="px-3 py-2">{CATEGORIAS[p.categoria] ?? p.categoria}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesosExactos(p.precioCentavos)}</td>
                  {costos && <td className="px-3 py-2 text-right tabular-nums">{c ? pesosExactos(c.costoCentavos) : "—"}</td>}
                  {costos && (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c ? <>{pesosExactos(c.margenCentavos)}{c.margenPct !== null && <span className="text-vs-tinta-3"> · {(c.margenPct * 100).toFixed(1)} %</span>}</> : "—"}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    <button type="button" className="text-vs-tinta-2 hover:underline"
                            onClick={() => setEditando(editando === p.id ? null : p.id)}>
                      {editando === p.id ? "Cerrar" : "Editar"}
                    </button>
                    {" · "}
                    <button type="button" className="text-vs-tinta-2 hover:underline"
                            onClick={() => { void activarProductoAccion(p.id, !p.activo); }}>
                      {p.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Campo de costo: enmascarado, con un botón para ver lo que se escribe. */
function CampoCosto({ requerido }: { requerido: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block text-xs text-vs-tinta-3">
      Costo para la academia {requerido ? "" : <span className="font-normal">(vacío = sin cambios)</span>}
      <span className="relative mt-1 block">
        <input
          name="costo" type={visible ? "text" : "password"} inputMode="decimal" autoComplete="off"
          required={requerido} placeholder={requerido ? "0.00" : "Oculto"}
          className={`${campo} pr-16`}
        />
        <button type="button" onClick={() => setVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] text-vs-tinta-3 hover:text-vs-tinta-2">
          {visible ? "Ocultar" : "Ver"}
        </button>
      </span>
    </label>
  );
}

function CamposProducto({ p, costoRequerido }: { p?: Producto; costoRequerido: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs text-vs-tinta-3 sm:col-span-2">
        Nombre
        <input name="nombre" required maxLength={120} defaultValue={p?.nombre} className={`${campo} mt-1`}
               placeholder="Ej. Método Suzuki Violín vol. 1" />
      </label>
      <label className="block text-xs text-vs-tinta-3">
        Categoría
        <select name="categoria" defaultValue={p?.categoria ?? "otro"} className={`${campo} mt-1`}>
          {Object.entries(CATEGORIAS).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
        </select>
      </label>
      <label className="block text-xs text-vs-tinta-3">
        Código <span className="font-normal">(opcional)</span>
        <input name="codigo" maxLength={40} defaultValue={p?.codigo ?? ""} className={`${campo} mt-1`} />
      </label>
      <label className="block text-xs text-vs-tinta-3">
        Precio de venta
        <input name="precio" type="number" inputMode="decimal" step="0.01" min="0.01" required
               defaultValue={p ? (p.precioCentavos / 100).toFixed(2) : ""} className={`${campo} mt-1`} />
      </label>
      <CampoCosto requerido={costoRequerido} />
      <label className="block text-xs text-vs-tinta-3 sm:col-span-2">
        Detalles <span className="font-normal">(opcional)</span>
        <textarea name="descripcion" rows={2} maxLength={1000} defaultValue={p?.descripcion ?? ""} className={`${campo} mt-1`} />
      </label>
    </div>
  );
}

function FormularioNuevo() {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, pendiente] = useActionState<EstadoProducto, FormData>(crearProductoAccion, {});
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => { if (estado.ok) { formulario.current?.reset(); setAbierto(false); } }, [estado]);

  return (
    <div>
      <button type="button" onClick={() => setAbierto((a) => !a)}
              className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm font-medium transition hover:border-vs-naranja-700 hover:text-vs-naranja-700">
        {abierto ? "Cancelar" : "Nuevo producto"}
      </button>
      {estado.ok && !abierto && <span role="status" className="ml-3 text-xs text-green-800">{estado.ok}</span>}
      <form ref={formulario} action={enviar} hidden={!abierto}
            className="mt-3 w-full max-w-xl space-y-3 rounded-xl border border-vs-linea bg-white p-4">
        <CamposProducto costoRequerido />
        {estado.error && <p role="alert" className="text-xs text-red-700">{estado.error}</p>}
        <button type="submit" disabled={pendiente}
                className="rounded-lg bg-vs-naranja px-4 py-1.5 text-sm font-semibold text-vs-tinta transition hover:bg-vs-naranja-700 hover:text-white disabled:opacity-60">
          {pendiente ? "Guardando…" : "Agregar al catálogo"}
        </button>
      </form>
    </div>
  );
}

function FormularioEditar({ p, alTerminar }: { p: Producto; alTerminar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<EstadoProducto, FormData>(editarProductoAccion, {});
  useEffect(() => { if (estado.ok) alTerminar(); }, [estado, alTerminar]);
  return (
    <form action={enviar} className="mt-3 space-y-3 rounded-lg border border-vs-linea bg-vs-crema/50 p-3">
      <input type="hidden" name="id" value={p.id} />
      <CamposProducto p={p} costoRequerido={false} />
      {estado.error && <p role="alert" className="text-xs text-red-700">{estado.error}</p>}
      <button type="submit" disabled={pendiente}
              className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm font-medium transition hover:border-vs-naranja-700 hover:text-vs-naranja-700 disabled:opacity-60">
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
