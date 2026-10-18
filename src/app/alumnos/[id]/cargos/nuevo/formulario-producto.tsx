"use client";

import { useActionState, useState } from "react";

import { pesosExactos } from "@/lib/formato";
import type { EstadoCargoProducto } from "../acciones";

const campo = "mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700";

type Producto = { id: number; nombre: string; codigo: string | null; precioCentavos: number };
type Sede = { id: number; nombre: string };

type Props = {
  accion: (prev: EstadoCargoProducto, datos: FormData) => Promise<EstadoCargoProducto>;
  alumnoId: number;
  hoy: string;
  /** Solo nombre y precio: este formulario lo ve la familia frente al mostrador. */
  productos: Producto[];
  sedes: Sede[];
};

export function FormularioCargoProducto({ accion, alumnoId, hoy, productos, sedes }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const [productoId, setProductoId] = useState("");
  const [monto, setMonto] = useState("");

  const elegido = productos.find((p) => String(p.id) === productoId);

  const alElegir = (id: string) => {
    setProductoId(id);
    const p = productos.find((x) => String(x.id) === id);
    setMonto(p ? (p.precioCentavos / 100).toFixed(2) : "");
  };

  return (
    <form action={enviar} className="mt-6 space-y-5 rounded-xl border border-vs-linea bg-white p-6">
      <input type="hidden" name="alumnoId" value={alumnoId} />

      {estado.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{estado.error}</p>
      )}

      <div>
        <label htmlFor="productoId" className="block text-sm font-medium text-vs-tinta">Producto</label>
        <select id="productoId" name="productoId" value={productoId} onChange={(e) => alElegir(e.target.value)}
                className={campo}>
          <option value="">Otro (concepto libre)…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}{p.codigo ? ` · ${p.codigo}` : ""} — {pesosExactos(p.precioCentavos)}
            </option>
          ))}
        </select>
        {productos.length === 0 && (
          <p className="mt-1 text-xs text-vs-tinta-3">Aún no hay productos en el catálogo: escribe el concepto a mano.</p>
        )}
      </div>

      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium text-vs-tinta">
          Concepto {elegido ? <span className="text-vs-tinta-3">(opcional: por omisión, el nombre del producto)</span> : <span aria-hidden="true">*</span>}
        </label>
        <input id="descripcion" name="descripcion" type="text" maxLength={300} required={!elegido}
               placeholder={elegido ? elegido.nombre : "Ej. Libreta pautada 20 pentagramas"} className={campo} />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="monto" className="block text-sm font-medium text-vs-tinta">
            Monto (pesos) <span aria-hidden="true">*</span>
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vs-tinta-3">$</span>
            <input id="monto" name="monto" type="number" required min="0.01" max="1000000" step="0.01"
                   value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00"
                   className="w-full rounded-lg border border-vs-linea bg-white py-2 pl-7 pr-3 text-sm focus:outline-2 focus:outline-vs-naranja-700" />
          </div>
        </div>

        <div>
          <label htmlFor="sedeId" className="block text-sm font-medium text-vs-tinta">
            Sede <span aria-hidden="true">*</span>
          </label>
          <select id="sedeId" name="sedeId" required defaultValue={sedes.length === 1 ? sedes[0]!.id : ""} className={campo}>
            <option value="" disabled>Elige…</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="venceEl" className="block text-sm font-medium text-vs-tinta">
            Vence el <span aria-hidden="true">*</span>
          </label>
          <input id="venceEl" name="venceEl" type="date" required defaultValue={hoy} className={campo} />
        </div>
      </div>

      <p className="text-xs text-vs-tinta-3">
        Al crear el cargo se genera su vale de entrega con código QR. El producto se entrega cuando
        el cargo esté pagado.
      </p>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={pendiente}
                className="rounded-lg bg-vs-naranja px-5 py-2 text-sm font-semibold text-vs-tinta transition
                           hover:bg-vs-naranja-700 hover:text-white disabled:opacity-60
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700">
          {pendiente ? "Guardando…" : "Crear cargo y vale"}
        </button>
        <a href={`/alumnos/${alumnoId}`} className="text-sm text-vs-tinta-3 hover:underline">Cancelar</a>
      </div>
    </form>
  );
}
