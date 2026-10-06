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

// ─── Formulario: estructura (clave, clases/ciclo, min/clase) ────────────────

export function FormularioEstructura({
  programaId,
  claveActual,
  clasesPorCicloActual,
  minutosPorClaseActual,
  accion,
}: {
  programaId: number;
  claveActual: string;
  clasesPorCicloActual: number;
  minutosPorClaseActual: number;
  accion: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
}) {
  const [estado, dispatch, pending] = useActionState(accion, { ok: false, mensaje: "" });

  const campo =
    "mt-1 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="programaId" value={programaId} />

      <div>
        <label htmlFor="clave" className="block text-sm font-medium">
          Clave interna <span className="font-normal text-vs-tinta-3">(única, sin espacios)</span>
        </label>
        <input
          id="clave"
          name="clave"
          type="text"
          required
          maxLength={30}
          defaultValue={claveActual}
          className={`${campo} font-mono`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="clasesPorCiclo" className="block text-sm font-medium">
            Clases por ciclo
          </label>
          <input
            id="clasesPorCiclo"
            name="clasesPorCiclo"
            type="number"
            required
            min="1"
            max="31"
            defaultValue={clasesPorCicloActual}
            className={campo}
          />
        </div>
        <div>
          <label htmlFor="minutosPorClase" className="block text-sm font-medium">
            Minutos por clase
          </label>
          <input
            id="minutosPorClase"
            name="minutosPorClase"
            type="number"
            required
            min="15"
            max="180"
            step="5"
            defaultValue={minutosPorClaseActual}
            className={campo}
          />
        </div>
      </div>

      <p className="text-xs text-vs-tinta-3">
        Cambiar estas cifras afecta los cálculos de horas y costo docente en el catálogo.
        No modifica contratos ya emitidos.
      </p>

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
        {pending ? "Guardando…" : "Guardar estructura"}
      </button>
    </form>
  );
}

// ─── Formulario: precio ──────────────────────────────────────────────────────

export function FormularioPrecio({
  programaId,
  precioActualPesos,
  hoy,
  etiqueta = "Precio mensual",
  accion,
}: {
  programaId: number;
  precioActualPesos: string;
  hoy: string;
  etiqueta?: string;
  accion: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
}) {
  const [estado, dispatch, pending] = useActionState(accion, { ok: false, mensaje: "" });

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="programaId" value={programaId} />

      <div>
        <label htmlFor="precioPesos" className="block text-sm font-medium">
          Nuevo {etiqueta.toLowerCase()} (pesos)
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
        <p className="mt-1 text-xs text-vs-tinta-3">
          Actual: ${precioActualPesos} / {etiqueta.toLowerCase().includes("clase") ? "clase" : "mes"}
        </p>
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
