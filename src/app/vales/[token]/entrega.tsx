"use client";

import { useActionState, useState } from "react";

import { entregarValeAccion, type EstadoEntrega } from "./acciones";

const boton = "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700";

/**
 * Botón de confirmación. Dos pasos: el primer toque pide confirmar, para que un dedo
 * suelto sobre el teléfono no marque una entrega que no ocurrió.
 */
export function Entrega({ token, conExcepcion }: { token: string; conExcepcion: boolean }) {
  const [estado, enviar, pendiente] = useActionState<EstadoEntrega, FormData>(entregarValeAccion, {});
  const [confirmar, setConfirmar] = useState(false);

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      {conExcepcion && (
        <label className="block text-sm font-medium text-vs-tinta">
          Motivo de la excepción
          <textarea name="motivo" rows={2} required minLength={5} maxLength={300}
                    placeholder="Ej. El papá pagará el viernes; autorizado por dirección"
                    className="mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm" />
          <span className="mt-1 block text-xs font-normal text-vs-tinta-3">Queda en la bitácora con tu nombre.</span>
        </label>
      )}

      {estado.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{estado.error}</p>}
      {estado.ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{estado.ok}</p>}

      {!confirmar ? (
        <button type="button" onClick={() => setConfirmar(true)}
                className={`${boton} bg-vs-naranja text-vs-tinta hover:bg-vs-naranja-700 hover:text-white`}>
          {conExcepcion ? "Entregar con excepción…" : "Marcar como entregado…"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pendiente}
                  className={`${boton} bg-vs-tinta text-white hover:bg-black`}>
            {pendiente ? "Registrando…" : "Sí, confirmar entrega"}
          </button>
          <button type="button" onClick={() => setConfirmar(false)} className="text-sm text-vs-tinta-3 hover:underline">
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
