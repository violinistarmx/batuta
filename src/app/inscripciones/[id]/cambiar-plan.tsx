"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { cambiarPlan, type EstadoCambioPlan } from "./acciones";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-vs-linea bg-white px-3.5 py-1.5 text-sm font-semibold transition
                 hover:border-vs-naranja-700 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-vs-naranja-700 disabled:opacity-60"
    >
      {pending ? "Cambiando…" : "Cambiar el plan"}
    </button>
  );
}

const pesos = (c: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(c / 100);

/** Pasa el plan familiar a otro programa (por ejemplo, de Duet de 2 a Duet de 3). */
export function CambiarPlan({
  inscripcionId, precioActualCentavos, opciones,
}: {
  inscripcionId: number;
  precioActualCentavos: number;
  opciones: { id: number; nombre: string; alumnosIncluidos: number; precioCentavos: number }[];
}) {
  const [estado, accion] = useActionState<EstadoCambioPlan, FormData>(cambiarPlan, {});
  return (
    <form action={accion} className="mt-4 rounded-lg border border-vs-linea bg-white p-3">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <p className="text-sm font-medium">¿La familia suma a otro integrante?</p>
      <p className="mt-0.5 text-xs text-vs-tinta-3">
        Cambia el plan al programa con más lugares. Todos los alumnos del plan pasan al programa nuevo y el
        período vigente (hoy {pesos(precioActualCentavos)}) toma su precio. Si ese período ya tiene un pago
        aplicado, primero hay que anularlo.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          name="programaId" required aria-label="Programa nuevo" defaultValue={String(opciones[0]?.id ?? "")}
          className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm"
        >
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre} · {pesos(o.precioCentavos)}</option>
          ))}
        </select>
        <Boton />
      </div>
      {estado.error && <p role="alert" className="mt-2 text-xs text-red-800">{estado.error}</p>}
      {estado.ok && <p role="status" className="mt-2 text-xs text-green-800">{estado.ok}</p>}
    </form>
  );
}
