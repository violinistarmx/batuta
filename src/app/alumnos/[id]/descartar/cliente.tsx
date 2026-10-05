"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { confirmarDescarte, type EstadoDescarte } from "./acciones";

function Confirmar({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || !habilitado}
            className="rounded-lg border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold
                       text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed
                       disabled:opacity-50">
      {pending ? "Descartando…" : "Descartar permanentemente"}
    </button>
  );
}

export function FormularioDescarte({ alumnoId, nombre }: { alumnoId: number; nombre: string }) {
  const [estado, accion] = useActionState<EstadoDescarte, FormData>(confirmarDescarte, {});
  const [confirmacion, setConfirmacion] = useState("");

  const coincide = confirmacion.trim().toUpperCase() === nombre.trim().toUpperCase();

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="alumnoId" value={alumnoId} />

      {estado.error && (
        <p id="error-descarte" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmacion" className="text-xs font-medium text-vs-tinta-2">
          Escribe el nombre del alumno para confirmar: <strong>{nombre}</strong>
        </label>
        <input id="confirmacion" name="confirmacion" required autoComplete="off"
               className="rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm
                          focus-visible:outline-2 focus-visible:outline-offset-1
                          focus-visible:outline-red-700"
               value={confirmacion}
               onChange={(e) => setConfirmacion(e.target.value)} />
      </div>

      <div><Confirmar habilitado={coincide} /></div>
    </form>
  );
}
