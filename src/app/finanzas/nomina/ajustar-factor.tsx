"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ajustarFactorPartidaAccion, type EstadoNomina } from "../acciones";

const campo = "w-24 rounded-lg border border-vs-linea bg-white px-2 py-1 text-right text-sm tabular-nums " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Boton({ texto, pendiente, anular }: { texto: string; pendiente: string; anular?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={anular ? "anular" : undefined}
      value={anular ? "1" : undefined}
      disabled={pending}
      className={anular
        ? "rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
        : "rounded-lg border border-vs-linea bg-white px-2.5 py-1 text-xs font-medium transition hover:border-vs-naranja-700 hover:text-vs-naranja-700 disabled:opacity-60"}
    >
      {pending ? pendiente : texto}
    </button>
  );
}

/**
 * Cambia el importe que se le paga al docente en una clase todavía no pagada. Se
 * captura en pesos; el servidor calcula el porcentaje a partir de ese monto. Solo
 * la ve quien tiene `nomina.leer`, y el servidor vuelve a verificarlo.
 */
export function AjustarFactor({
  partidaId, importeActual, valorCompleto,
}: {
  partidaId: number;
  /** Importe que se paga hoy, en centavos. */
  importeActual: number;
  /** Lo que vale la clase completa, en centavos: el máximo que se puede pagar. */
  valorCompleto: number;
}) {
  const [estado, accion] = useActionState<EstadoNomina, FormData>(ajustarFactorPartidaAccion, {});

  return (
    <form action={accion} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="partidaId" value={partidaId} />
      <label className="sr-only" htmlFor={`importe-${partidaId}`}>Importe a pagar en pesos</label>
      <span className="text-xs text-vs-tinta-3">$</span>
      <input
        id={`importe-${partidaId}`}
        name="importe"
        type="number"
        inputMode="decimal"
        min={0}
        max={valorCompleto / 100}
        step="0.01"
        defaultValue={(importeActual / 100).toFixed(2)}
        title={`Máximo $${(valorCompleto / 100).toFixed(2)}, lo que vale la clase completa`}
        className={campo}
      />
      <Boton texto="Guardar" pendiente="…" />
      <Boton texto="Anular" pendiente="…" anular />
      {estado.error && <span role="alert" className="basis-full text-right text-xs text-red-700">{estado.error}</span>}
      {estado.ok && <span role="status" className="basis-full text-right text-xs text-green-800">{estado.ok}</span>}
    </form>
  );
}
