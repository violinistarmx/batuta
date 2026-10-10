"use client";

import { useActionState } from "react";
import type { EstadoCargoCrear } from "../acciones";

const CONCEPTOS = [
  { valor: "inscripcion", etiqueta: "Inscripción" },
  { valor: "clase_suelta", etiqueta: "Clase suelta" },
  { valor: "material", etiqueta: "Material" },
  { valor: "recital", etiqueta: "Recital" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

type Props = {
  accion: (prev: EstadoCargoCrear, datos: FormData) => Promise<EstadoCargoCrear>;
  alumnoId: number;
  hoy: string;
};

export function FormularioCargoNuevo({ accion, alumnoId, hoy }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});

  return (
    <form action={enviar} className="mt-6 space-y-5 rounded-xl border border-vs-linea bg-white p-6">
      <input type="hidden" name="alumnoId" value={alumnoId} />

      {estado.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {estado.error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Concepto */}
        <div>
          <label htmlFor="concepto" className="block text-sm font-medium text-vs-tinta">
            Concepto <span aria-hidden="true">*</span>
          </label>
          <select
            id="concepto"
            name="concepto"
            required
            defaultValue=""
            className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700"
          >
            <option value="" disabled>Elige…</option>
            {CONCEPTOS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
        </div>

        {/* Fecha de vencimiento */}
        <div>
          <label htmlFor="venceEl" className="block text-sm font-medium text-vs-tinta">
            Vence el <span aria-hidden="true">*</span>
          </label>
          <input
            id="venceEl"
            name="venceEl"
            type="date"
            required
            defaultValue={hoy}
            className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700"
          />
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium text-vs-tinta">
          Descripción <span aria-hidden="true">*</span>
        </label>
        <input
          id="descripcion"
          name="descripcion"
          type="text"
          required
          maxLength={300}
          placeholder="Ej. Inscripción octubre 2026, Material de dibujo…"
          className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-vs-naranja-700"
        />
      </div>

      {/* Periodo (opcional) */}
      <div>
        <label htmlFor="periodo" className="block text-sm font-medium text-vs-tinta">
          Periodo <span className="text-vs-tinta-3">(opcional)</span>
        </label>
        <input
          id="periodo"
          name="periodo"
          type="text"
          maxLength={100}
          placeholder="Ej. oct 2026, 18 sep – 17 oct 2026"
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
            max="1000000"
            step="0.01"
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
          {pendiente ? "Guardando…" : "Crear cargo"}
        </button>
        <a href={`/alumnos/${alumnoId}`} className="text-sm text-vs-tinta-3 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
