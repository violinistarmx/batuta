"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { asignarResponsable, type EstadoResponsable } from "./acciones";

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
      {pending ? "Guardando…" : "Asignar responsable"}
    </button>
  );
}

/** Para planes familiares cuyo titular es un menor: pasa el pago al tutor responsable. */
export function AsignarResponsable({
  inscripcionId, tutores,
}: {
  inscripcionId: number;
  tutores: { id: number; nombre: string; parentesco: string; esResponsablePago: boolean }[];
}) {
  const [estado, accion] = useActionState<EstadoResponsable, FormData>(asignarResponsable, {});
  if (tutores.length === 0) {
    return (
      <p className="mt-3 text-xs text-vs-tinta-2">
        El titular es menor de edad y no tiene tutor registrado: agrega al tutor que paga en Editar datos
        del alumno para poder asignarlo como responsable de pago.
      </p>
    );
  }
  return (
    <form action={accion} className="mt-4 rounded-lg border border-vs-linea bg-white p-3">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <p className="text-sm font-medium">El titular de este plan es un menor</p>
      <p className="mt-0.5 text-xs text-vs-tinta-3">
        El titular debe ser el adulto que paga. Elige al tutor: el plan pasa a su cuenta y la mensualidad,
        los recibos y los avisos de adeudo van a su nombre. Lo que ya tiene pagos aplicados no se mueve.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          name="tutorId" required aria-label="Tutor responsable de pago"
          defaultValue={String((tutores.find((t) => t.esResponsablePago) ?? tutores[0])?.id ?? "")}
          className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm"
        >
          {tutores.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.parentesco}</option>)}
        </select>
        <Boton />
      </div>
      {estado.error && <p role="alert" className="mt-2 text-xs text-red-800">{estado.error}</p>}
      {estado.ok && <p role="status" className="mt-2 text-xs text-green-800">{estado.ok}</p>}
    </form>
  );
}
