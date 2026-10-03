"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { registrarEntrega, type EstadoEntrega } from "./acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                       transition hover:bg-vs-naranja-claro disabled:opacity-60">
      {pending ? "Registrando…" : "Registrar entrega"}
    </button>
  );
}

export function Entregar({ alumnoId }: { alumnoId: number }) {
  const [estado, accion] = useActionState<EstadoEntrega, FormData>(registrarEntrega, {});

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="alumnoId" value={alumnoId} />

      {estado.error && (
        <p id="error-entrega" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p id="ok-entrega" role="status"
           className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {estado.ok}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="medio" className="text-xs font-medium text-vs-tinta-2">Cómo se entregó</label>
          <select id="medio" name="medio" defaultValue="whatsapp" className={campo}>
            <option value="whatsapp">QR por WhatsApp</option>
            <option value="correo">QR por correo</option>
            <option value="en_persona">QR mostrado en la academia</option>
            <option value="impresa">Credencial impresa</option>
          </select>
        </div>
        <Boton />
      </div>
    </form>
  );
}

/**
 * Barra de acciones de los documentos imprimibles. No se imprime.
 *
 * La usan la credencial, la responsiva de préstamo y el programa de mano, así que
 * el texto de «volver» se pasa: un programa de mano que dice «volver al expediente»
 * delata que el componente se reutilizó sin mirarlo.
 */
export function BarraCredencial({ volverA, volverTexto = "Volver al expediente" }: {
  volverA: string; volverTexto?: string;
}) {
  return (
    <div className="no-imprimir mx-auto flex max-w-[820px] flex-wrap items-center gap-3 px-5 pt-6">
      <a href={volverA} className="text-xs text-vs-tinta-3 no-underline hover:underline">
        ← {volverTexto}
      </a>
      <button type="button" onClick={() => window.print()}
              className="ml-auto rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm
                         font-semibold transition hover:border-vs-naranja-700">
        Imprimir
      </button>
    </div>
  );
}
