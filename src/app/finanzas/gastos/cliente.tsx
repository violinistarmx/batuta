"use client";

import type React from "react";
import { useActionState } from "react";
import type { EstadoGasto } from "./acciones";

const CATEGORIAS = [
  { valor: "renta", etiqueta: "Renta" },
  { valor: "servicios", etiqueta: "Servicios" },
  { valor: "instrumentos", etiqueta: "Instrumentos" },
  { valor: "material", etiqueta: "Material" },
  { valor: "mantenimiento", etiqueta: "Mantenimiento" },
  { valor: "publicidad", etiqueta: "Publicidad" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

type Props = {
  accion: (prev: EstadoGasto, datos: FormData) => Promise<EstadoGasto>;
  inicial?: {
    id: number;
    categoria: string;
    concepto: string;
    montoCentavos: number;
    fecha: string;
  };
  etiquetaBoton?: string;
};

/** Formulario reutilizable para registrar y editar gastos. */
export function FormularioGasto({ accion, inicial, etiquetaBoton = "Guardar gasto" }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});

  return (
    <form action={enviar} className="mt-6 space-y-5 rounded-xl border border-vs-linea bg-white p-6">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      {estado.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {estado.error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Categoría */}
        <div>
          <label htmlFor="categoria" className="block text-sm font-medium text-vs-tinta">
            Categoría <span aria-hidden="true">*</span>
          </label>
          <select
            id="categoria"
            name="categoria"
            required
            defaultValue={inicial?.categoria ?? ""}
            className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700"
          >
            <option value="" disabled>Elige…</option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
        </div>

        {/* Fecha */}
        <div>
          <label htmlFor="fecha" className="block text-sm font-medium text-vs-tinta">
            Fecha <span aria-hidden="true">*</span>
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            required
            defaultValue={inicial?.fecha ?? new Date().toISOString().slice(0, 10)}
            className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700"
          />
        </div>
      </div>

      {/* Concepto */}
      <div>
        <label htmlFor="concepto" className="block text-sm font-medium text-vs-tinta">
          Concepto <span aria-hidden="true">*</span>
        </label>
        <input
          id="concepto"
          name="concepto"
          type="text"
          required
          maxLength={200}
          defaultValue={inicial?.concepto ?? ""}
          placeholder="Ej. Renta octubre, Cuerdas de violín…"
          className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700"
        />
      </div>

      {/* Monto */}
      <div>
        <label htmlFor="monto" className="block text-sm font-medium text-vs-tinta">
          Monto (pesos) <span aria-hidden="true">*</span>
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vs-tinta-3">$</span>
          <input
            id="monto"
            name="monto"
            type="number"
            required
            min="0.01"
            max="10000000"
            step="0.01"
            defaultValue={inicial ? (inicial.montoCentavos / 100).toFixed(2) : ""}
            placeholder="0.00"
            className="w-full rounded-lg border border-vs-linea bg-white py-2 pl-7 pr-3 text-sm focus:outline-2 focus:outline-vs-naranja-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-vs-naranja px-5 py-2 text-sm font-semibold text-vs-tinta transition
                     hover:bg-vs-naranja-700 hover:text-white
                     disabled:opacity-60
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
        >
          {pendiente ? "Guardando…" : etiquetaBoton}
        </button>
        <a href="/finanzas/gastos" className="text-sm text-vs-tinta-3 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}

/** Botón de eliminación con confirmación inline. */
export function BtnEliminar({
  accion,
  gastoId,
}: {
  accion: (prev: EstadoGasto, datos: FormData) => Promise<EstadoGasto>;
  gastoId: number;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={gastoId} />
      {estado.error && (
        <p className="mb-2 text-xs text-red-600">{estado.error}</p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (!confirm("¿Eliminar este gasto? La acción no se puede deshacer.")) e.preventDefault();
        }}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700
                   transition hover:bg-red-50 disabled:opacity-60"
      >
        {pendiente ? "Eliminando…" : "Eliminar"}
      </button>
    </form>
  );
}
