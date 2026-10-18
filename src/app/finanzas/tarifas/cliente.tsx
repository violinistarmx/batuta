"use client";

import { useActionState } from "react";

import { cambiarTarifaAccion, type EstadoTarifa } from "./acciones";

export function CambiarTarifa({ docenteId, actual, hoy }: { docenteId: number; actual: number | null; hoy: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoTarifa, FormData>(cambiarTarifaAccion, {});
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="docenteId" value={docenteId} />
      <label className="text-xs text-vs-tinta-3">
        Nueva tarifa por hora
        <span className="relative mt-1 block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-vs-tinta-3">$</span>
          <input
            name="tarifa" type="number" inputMode="decimal" min="0.01" step="0.01"
            defaultValue={actual === null ? "" : (actual / 100).toFixed(2)}
            placeholder="Vacío = la del programa"
            className="w-44 rounded-lg border border-vs-linea bg-white py-1.5 pl-6 pr-2 text-sm tabular-nums"
          />
        </span>
      </label>
      <label className="text-xs text-vs-tinta-3">
        A partir del
        <input name="desde" type="date" required defaultValue={hoy}
               className="mt-1 block rounded-lg border border-vs-linea bg-white px-2 py-1.5 text-sm" />
      </label>
      <button
        type="submit" disabled={pendiente}
        className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm font-medium transition
                   hover:border-vs-naranja-700 hover:text-vs-naranja-700 disabled:opacity-60"
      >
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      {estado.error && <p role="alert" className="basis-full text-xs text-red-700">{estado.error}</p>}
      {estado.ok && <p role="status" className="basis-full text-xs text-green-800">{estado.ok}</p>}
    </form>
  );
}
