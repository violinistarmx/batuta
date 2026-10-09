"use client";

import { useActionState, useState } from "react";

import type { EstadoAccion } from "./acciones";

// ─── Formulario: nueva materia / instrumento ─────────────────────────────────

export function FormularioNuevoInstrumento({
  accion,
}: {
  accion: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
}) {
  const [estado, dispatch, pending] = useActionState(accion, { ok: false, mensaje: "" });

  const campo =
    "mt-1 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <label htmlFor="nombre-nuevo" className="block text-sm font-medium">
          Nombre de la materia o instrumento
        </label>
        <input
          id="nombre-nuevo"
          name="nombre"
          type="text"
          required
          maxLength={60}
          placeholder="Ej: Iniciación musical, Dibujo, Saxofón…"
          className={campo}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="granFormato"
          value="on"
          className="h-4 w-4 rounded border-vs-linea accent-vs-naranja-700"
        />
        <span className="text-sm">
          Gran formato{" "}
          <span className="text-vs-tinta-3">
            — instrumento que no puede salir de la academia (cláusula 9ª)
          </span>
        </span>
      </label>

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
        {pending ? "Agregando…" : "Agregar"}
      </button>
    </form>
  );
}

// ─── Fila editable de instrumento ────────────────────────────────────────────

export function FilaInstrumento({
  instrumento,
  accionRenombrar,
  accionToggle,
}: {
  instrumento: {
    id: number;
    nombre: string;
    granFormato: boolean;
    activo: boolean;
  };
  accionRenombrar: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
  accionToggle: (prev: EstadoAccion, data: FormData) => Promise<EstadoAccion>;
}) {
  const [editando, setEditando] = useState(false);
  const [estadoRenombrar, dispatchRenombrar, pendingRenombrar] = useActionState(
    async (prev: EstadoAccion, data: FormData) => {
      const res = await accionRenombrar(prev, data);
      if (res.ok) setEditando(false);
      return res;
    },
    { ok: false, mensaje: "" },
  );
  const [, dispatchToggle, pendingToggle] = useActionState(accionToggle, { ok: false, mensaje: "" });

  const campo =
    "rounded-lg border border-vs-linea bg-white px-2.5 py-1.5 text-sm " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm
                    ${instrumento.activo ? "border-vs-linea bg-white" : "border-vs-linea bg-vs-crema opacity-60"}`}>

      {editando ? (
        <form action={dispatchRenombrar} className="flex flex-1 flex-wrap items-center gap-3">
          <input type="hidden" name="instrumentoId" value={instrumento.id} />
          <input
            name="nombre"
            type="text"
            required
            maxLength={60}
            defaultValue={instrumento.nombre}
            autoFocus
            className={`${campo} flex-1 min-w-[160px]`}
          />
          <label className="flex items-center gap-1.5 text-xs text-vs-tinta-2">
            <input
              type="checkbox"
              name="granFormato"
              value="on"
              defaultChecked={instrumento.granFormato}
              className="h-3.5 w-3.5 rounded accent-vs-naranja-700"
            />
            Gran formato
          </label>
          {estadoRenombrar.mensaje && !estadoRenombrar.ok && (
            <span className="w-full text-xs text-red-700">{estadoRenombrar.mensaje}</span>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pendingRenombrar}
              className="rounded-lg bg-vs-naranja px-3 py-1.5 text-xs font-semibold text-vs-tinta
                         transition hover:bg-vs-naranja-claro disabled:opacity-50"
            >
              {pendingRenombrar ? "…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-vs-linea px-3 py-1.5 text-xs text-vs-tinta-2
                         transition hover:bg-vs-crema"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className="flex-1 font-medium">
            {instrumento.nombre}
            {instrumento.granFormato && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-vs-naranja-700">
                gran formato
              </span>
            )}
            {!instrumento.activo && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-vs-tinta-3">
                inactivo
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-xs text-vs-tinta-3 hover:text-vs-naranja-700 hover:underline"
          >
            Renombrar
          </button>

          <form action={dispatchToggle}>
            <input type="hidden" name="instrumentoId" value={instrumento.id} />
            <input type="hidden" name="activo" value={instrumento.activo ? "false" : "true"} />
            <button
              type="submit"
              disabled={pendingToggle}
              className="text-xs text-vs-tinta-3 hover:text-vs-naranja-700 hover:underline
                         disabled:opacity-50"
            >
              {instrumento.activo ? "Desactivar" : "Activar"}
            </button>
          </form>
        </>
      )}
    </li>
  );
}
