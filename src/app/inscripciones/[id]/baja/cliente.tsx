"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { confirmarBaja, type EstadoBaja } from "./acciones";
import { planDeBaja, type Situacion } from "@/lib/dominio/bajas";
import { pesos } from "@/lib/formato";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Confirmar({ fecha }: { fecha: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-800
                       transition hover:bg-red-50 disabled:opacity-60">
      {pending ? "Dando la baja…" : `Dar de baja con efecto al ${fecha}`}
    </button>
  );
}

/**
 * El plan se recalcula en el navegador con las mismas reglas que aplica el
 * servidor —`planDeBaja` es puro y no toca la base— para que mover la fecha del
 * aviso enseñe al instante qué cambia. Lo que se ejecuta lo vuelve a derivar el
 * servidor desde la base: aquí no se decide nada, solo se explica.
 */
export function FormularioBaja(
  { inscripcionId, situacion, hoy }:
  { inscripcionId: number; situacion: Omit<Situacion, "fechaAviso">; hoy: string },
) {
  const [estado, accion] = useActionState<EstadoBaja, FormData>(confirmarBaja, {});
  const [fechaAviso, setFechaAviso] = useState(hoy);
  const [motivo, setMotivo] = useState("");

  const plan = planDeBaja({ ...situacion, fechaAviso });

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />

      {estado.error && (
        <p id="error-baja" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">El aviso</h2>
        <p className="mt-1 text-sm text-vs-tinta-2">
          La cláusula 12ª pide {situacion.horasAviso} horas de anticipación. Cuenta el día en
          que avisó el tutor, no el día en que se capturó: lo que el tutor puede demostrar es
          su mensaje con fecha.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fechaAviso" className="text-xs font-medium text-vs-tinta-2">
              Cuándo avisó
            </label>
            <input id="fechaAviso" name="fechaAviso" type="date" required max={hoy}
                   className={campo} value={fechaAviso}
                   onChange={(e) => setFechaAviso(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="motivo" className="text-xs font-medium text-vs-tinta-2">
              Por qué se va
            </label>
            <textarea id="motivo" name="motivo" required rows={2} maxLength={500}
                      className={campo} value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="«Se cambian de ciudad», «El horario ya no le funciona»…" />
            <span className="text-xs text-vs-tinta-3">
              Queda en el expediente y en la bitácora. En tres meses nadie se acuerda, y es lo
              único que permite saber si la academia está perdiendo alumnos por la misma razón.
            </span>
          </div>
        </div>
      </section>

      <section id="plan-de-baja" className="rounded-xl border-2 border-vs-naranja bg-vs-amarillo-suave p-5">
        <h2 className="font-display text-lg font-semibold">Esto es lo que va a pasar</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {plan.resumen.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {plan.ajuste && (
          <dl id="ajuste-del-cargo"
              className="mt-4 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-3">
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Cargo actual</dt>
              <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                {pesos(plan.ajuste.antesCentavos)}
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Queda en</dt>
              <dd id="cargo-ajustado" className="mt-1 font-display text-lg font-semibold tabular-nums">
                {pesos(plan.ajuste.despuesCentavos)}
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Se le deja de cobrar</dt>
              <dd id="condonado" className="mt-1 font-display text-lg font-semibold tabular-nums">
                {pesos(plan.ajuste.condonadoCentavos)}
              </dd>
            </div>
          </dl>
        )}

        <p className="mt-4 text-xs">
          La baja no borra nada. El expediente, las clases ya tomadas, los pagos y los recibos
          siguen completos: lo que cambia es que deja de generarse cobro y de ocuparse cubículo.
        </p>
      </section>

      <div><Confirmar fecha={plan.fechaEfectiva} /></div>
    </form>
  );
}
