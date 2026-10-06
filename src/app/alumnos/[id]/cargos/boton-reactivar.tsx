"use client";

import { useActionState } from "react";

import { reactivarCargoAccion, type EstadoCargoReactivar } from "./acciones";

export function BotonReactivar({ cargoId, alumnoId }: { cargoId: number; alumnoId: number }) {
  const [estado, accion] = useActionState<EstadoCargoReactivar, FormData>(reactivarCargoAccion, {});

  return (
    <form action={accion}>
      <input type="hidden" name="cargoId" value={cargoId} />
      <input type="hidden" name="alumnoId" value={alumnoId} />
      {estado.error && (
        <p className="mb-1 text-xs text-red-700">{estado.error}</p>
      )}
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md border border-green-200
                   bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800
                   transition hover:border-green-400 hover:bg-green-100"
      >
        ↩ Reactivar
      </button>
    </form>
  );
}
