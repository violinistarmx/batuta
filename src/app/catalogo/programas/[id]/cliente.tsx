"use client";

import { useActionState } from "react";

import type { EstadoAccion } from "./acciones";

// ─── Formulario: nombre y descripción ───────────────────────────────────────

export function FormularioNombre({
  programaId,
  nombreActual,
  descripcionActual,
  accion,
}: {
  programaId: number;
  nombreActual: string;
  descripcionActual: string;
  accion: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
}) {
  const [estado, dispatch, pending] = useActionState(accion, { ok: false, mensaje: "" });

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="programaId" value={programaId} />

      <div>
        <label htmlFor="nombre" className="block text-sm font-medium">
          Nombre del programa
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          maxLength={80}
          defaultValue={nombreActual}
          className="mt-1 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-vs-naranja-700"
        />
      </div>

      <div>
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Descripción breve
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          required
          maxLength={200}
          rows={2}
          defaultValue={descripcionActual}
          className="mt-1 w-full resize-none rounded-lg border border-vs-linea bg-white px-3 py-2
                     text-sm focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-vs-naranja-700"
        />
      </div>

      {estado.mensaje && (
        <p className={`text-sm ${estado.ok ? "text-green-700" : "text-red-700"}`}>
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                   transition hover:bg-vs-naranja-claro disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar nombre"}
      </button>
    </form>
  );
}

// ─── Formulario: precio ──────────────────────────────────────────────────────

export function FormularioPrecio({
  programaId,
  precioActualPesos,
  hoy,
  accion,
}: {
  programaId: number;
  precioActualPesos: string;
  hoy: string;
  accion: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
}) {
  const [estado, dispatch, pending] = useActionState(accion, { ok: false, mensaje: "" });

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="programaId" value={programaId} />

      <div>
        <label htmlFor="precioPesos" className="block text-sm font-medium">
          Nuevo precio mensual (pesos)
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vs-tinta-3">
            $
          </span>
          <input
            id="precioPesos"
            name="precioPesos"
            type="number"
            required
            min="1"
            step="0.50"
            placeholder={precioActualPesos}
            className="w-full rounded-lg border border-vs-linea bg-white py-2 pl-7 pr-3 text-sm
                       tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1
                       focus-visible:outline-vs-naranja-700"
          />
        </div>
        <p className="mt-1 text-xs text-vs-tinta-3">Precio actual: ${precioActualPesos} / mes</p>
      </div>

      <div>
        <label htmlFor="vigenteDesde" className="block text-sm font-medium">
          Entra en vigor el
        </label>
        <input
          id="vigenteDesde"
          name="vigenteDesde"
          type="date"
          required
          defaultValue={hoy}
          min={hoy}
          className="mt-1 rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-vs-naranja-700"
        />
        <p className="mt-1 text-xs text-vs-tinta-3">
          Los contratos activos conservan el precio que tenían al suscribirse.
        </p>
      </div>

      {estado.mensaje && (
        <p className={`text-sm ${estado.ok ? "text-green-700" : "text-red-700"}`}>
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                   transition hover:bg-vs-naranja-claro disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Registrar nuevo precio"}
      </button>
    </form>
  );
}
