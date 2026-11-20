"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { moverAPlan, type EstadoMoverPlan } from "./acciones";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-vs-naranja px-3.5 py-1.5 text-sm font-semibold text-vs-tinta transition
                 hover:bg-vs-naranja-claro focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-vs-naranja-700 disabled:opacity-60"
    >
      {pending ? "Moviendo…" : "Sumar al plan elegido"}
    </button>
  );
}

type Plan = {
  inscripcionId: number; titular: string; titularCodigo: string; programa: string;
  restantes: number; tutorEnComun: boolean;
};

/**
 * Para el alumno que se inscribió «abriendo un plan nuevo» y debía ir en el plan de la familia:
 * lo pasa al plan elegido y le quita el cargo que se le había generado.
 */
export function MoverAPlan({
  inscripcionId, alumno, planes,
}: { inscripcionId: number; alumno: string; planes: Plan[] }) {
  const [estado, accion] = useActionState<EstadoMoverPlan, FormData>(moverAPlan, {});
  const [elegido, setElegido] = useState(String(planes[0]?.inscripcionId ?? ""));
  const plan = planes.find((p) => String(p.inscripcionId) === elegido);
  return (
    <form action={accion} className="mt-4 rounded-lg border border-vs-linea bg-white p-3">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <p className="text-sm font-medium">¿{alumno} debía ir en el plan de otra familia?</p>
      <p className="mt-0.5 text-xs text-vs-tinta-3">
        Pásalo al plan que ya existe: queda cubierto por ese titular, su período abre en $0 y el cargo que se
        le generó a este plan se cancela. Conserva sus clases. Si el cargo ya tiene un pago, anúlalo primero.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <select
          name="destinoId" required aria-label="Plan al que se suma" value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm"
        >
          {planes.map((p) => (
            <option key={p.inscripcionId} value={p.inscripcionId}>
              Plan de {p.titular} ({p.titularCodigo}) · {p.programa} · {p.restantes} lugar{p.restantes === 1 ? "" : "es"} libre{p.restantes === 1 ? "" : "s"}
              {p.tutorEnComun ? "" : " · sin tutor en común"}
            </option>
          ))}
        </select>
        {plan && !plan.tutorEnComun && (
          <label className="flex items-start gap-2 rounded-lg border border-vs-naranja bg-vs-crema px-3 py-2 text-sm">
            <input type="checkbox" name="familiaConfirmada" value="1" required className="mt-1" />
            <span>
              Confirmo que {alumno} y {plan.titular} son familia
              <span className="block text-xs text-vs-tinta-3">No comparten tutor registrado. La confirmación queda en la bitácora.</span>
            </span>
          </label>
        )}
        <div><Boton /></div>
      </div>
      {estado.error && <p role="alert" className="mt-2 text-xs text-red-800">{estado.error}</p>}
    </form>
  );
}
