"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { calcularNomina, pagarDocente, type EstadoNomina } from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Boton({ texto, pendiente, secundario }: {
  texto: string; pendiente: string; secundario?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={secundario
        ? "rounded-lg border border-vs-linea bg-white px-3.5 py-1.5 text-sm font-medium transition hover:border-vs-naranja-700 hover:text-vs-naranja-700 disabled:opacity-60"
        : "rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta transition hover:bg-vs-naranja-claro disabled:opacity-60"}
    >
      {pending ? pendiente : texto}
    </button>
  );
}

function Aviso({ estado }: { estado: EstadoNomina }) {
  if (estado.error) {
    return (
      <p id="error-nomina" role="alert"
         className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p id="ok-nomina" role="status"
         className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
        {estado.ok}
      </p>
    );
  }
  return null;
}

export function Calcular({ desde, hasta }: { desde: string; hasta: string }) {
  const [estado, accion] = useActionState<EstadoNomina, FormData>(calcularNomina, {});

  return (
    <form action={accion} className="flex flex-col gap-3">
      <Aviso estado={estado} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="desde" className="text-xs font-medium text-vs-tinta-2">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={desde} required className={campo} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hasta" className="text-xs font-medium text-vs-tinta-2">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} required className={campo} />
        </div>
        <Boton texto="Calcular clases del periodo" pendiente="Calculando…" secundario />
      </div>
      <p className="text-xs text-vs-tinta-3">
        Correrlo dos veces no paga dos veces: una clase ya considerada se omite. La garantía
        es un índice único sobre la clase, no el código.
      </p>
    </form>
  );
}

export function PagarDocente({
  docenteId, docente, desde, hasta, total,
}: {
  docenteId: number; docente: string; desde: string; hasta: string; total: string;
}) {
  const [estado, accion] = useActionState<EstadoNomina, FormData>(pagarDocente, {});

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="docenteId" value={docenteId} />
      <input type="hidden" name="desdeEl" value={desde} />
      <input type="hidden" name="hastaEl" value={hasta} />
      <Aviso estado={estado} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`metodo-${docenteId}`} className="text-xs font-medium text-vs-tinta-2">
            Cómo se le paga
          </label>
          <select id={`metodo-${docenteId}`} name="metodo" defaultValue="transferencia" className={campo}>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="deposito">Depósito</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`nota-${docenteId}`} className="text-xs font-medium text-vs-tinta-2">
            Nota
          </label>
          <input id={`nota-${docenteId}`} name="nota" className={`${campo} w-full`} />
        </div>
        <Boton texto={`Pagar ${total} a ${docente.split(" ")[0]}`} pendiente="Registrando…" />
      </div>
    </form>
  );
}
