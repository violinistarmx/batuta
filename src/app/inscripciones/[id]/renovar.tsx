"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { renovar, type EstadoRenovacion } from "@/app/alumnos/[id]/inscribir/acciones";

function Boton({ saldo }: { saldo: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm font-medium
                 transition hover:border-vs-naranja-700 hover:text-vs-naranja-700
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-vs-naranja-700 disabled:opacity-60"
    >
      {pending
        ? "Renovando…"
        : saldo > 0
          ? `Cerrar período y renovar (expiran ${saldo})`
          : "Cerrar período y renovar"}
    </button>
  );
}

export function BotonRenovar({ inscripcionId, saldo }: { inscripcionId: number; saldo: number }) {
  const [estado, accion] = useActionState<EstadoRenovacion, FormData>(renovar, {});

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <Boton saldo={saldo} />
      {estado.error && (
        <p id="error-renovar" role="alert" className="text-xs text-red-800">
          {estado.error}
        </p>
      )}
    </form>
  );
}
