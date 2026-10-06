"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  marcarAsistencia, posponer, type EstadoAsistencia, type EstadoPosponer,
} from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Enviar({ texto, pendiente }: { texto: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                 transition hover:bg-vs-naranja-claro focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700
                 disabled:opacity-60"
    >
      {pending ? pendiente : texto}
    </button>
  );
}

function opcionesAsistencia(minutos: number) {
  const creditos = Math.max(1, Math.ceil(minutos / 60));
  const notaConsumo = creditos === 1
    ? "Consume una clase del período."
    : `Consume ${creditos} clases del período (clase de ${minutos} min).`;
  const notaFalta = creditos === 1
    ? "Consume la clase (cláusula 4ª)."
    : `Consume ${creditos} clases del período (cláusula 4ª).`;
  return [
    { valor: "asistio" as const, texto: "Asistió", nota: notaConsumo },
    { valor: "falta" as const, texto: "Falta sin aviso", nota: notaFalta },
    { valor: "falta_justificada" as const, texto: "Falta justificada", nota: "No consume. Requiere autorización del director." },
    { valor: "cancelada" as const, texto: "Canceló la academia", nota: "No consume ni genera pago docente." },
  ];
}

export function Asistencia({ claseId, estadoActual, minutos = 60 }: { claseId: number; estadoActual: string; minutos?: number }) {
  const [estado, accion] = useActionState<EstadoAsistencia, FormData>(marcarAsistencia, {});
  const yaRegistrada = estadoActual !== "programada";
  const opciones = opcionesAsistencia(minutos);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="claseId" value={claseId} />

      {estado.error && (
        <p id="error-asistencia" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p id="ok-asistencia" role="status"
           className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {estado.ok}
        </p>
      )}

      {yaRegistrada && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Esta clase ya está registrada. Cambiarla queda como corrección en el libro mayor
          y en la bitácora.
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-vs-tinta-2">¿Qué pasó?</legend>
        {opciones.map((o) => (
          <label
            key={o.valor}
            htmlFor={`estado-${o.valor}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-vs-linea p-3
                       transition hover:border-vs-naranja-700"
          >
            <input
              id={`estado-${o.valor}`}
              type="radio"
              name="estado"
              value={o.valor}
              required
              defaultChecked={estadoActual === o.valor}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium">{o.texto}</span>
              <span className="mt-0.5 block text-xs text-vs-tinta-3">{o.nota}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="observaciones" className="text-xs font-medium text-vs-tinta-2">
          Observaciones
        </label>
        <textarea id="observaciones" name="observaciones" rows={2} className={campo} />
      </div>

      <div>
        <Enviar texto={yaRegistrada ? "Corregir registro" : "Registrar"} pendiente="Guardando…" />
      </div>
    </form>
  );
}

export function Posponer({
  claseId, hoy, ahora, cierreDePeriodo, posposicionesUsadas, puedeAutorizar,
}: {
  claseId: number; hoy: string; ahora: string; cierreDePeriodo: string;
  posposicionesUsadas: number; puedeAutorizar: boolean;
}) {
  const [estado, accion] = useActionState<EstadoPosponer, FormData>(posponer, {});
  const [autorizar, setAutorizar] = useState(false);
  const agotadas = posposicionesUsadas >= 2;

  if (agotadas) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Este período ya usó sus <strong>2 posposiciones</strong> (cláusula 4ª). Las clases
        que excedan el tope se consideran consumidas, sin derecho a reprogramación.
      </p>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="claseId" value={claseId} />

      {estado.error && (
        <div id="error-posponer" role="alert"
             className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{estado.error}</p>
          {estado.conflictos?.map((c) => <p key={c} className="mt-1 text-xs">{c}</p>)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="avisoFecha" className="text-xs font-medium text-vs-tinta-2">
            ¿Cuándo avisó el tutor?
          </label>
          <div className="flex gap-2">
            <input id="avisoFecha" name="avisoFecha" type="date" defaultValue={hoy} required className={`${campo} flex-1`} />
            <input id="avisoHora" name="avisoHora" type="time" defaultValue={ahora} required className={campo} />
          </div>
          <span className="text-xs text-vs-tinta-3">
            La hora del aviso, no la de captura: es lo que decide si se cumplieron las 24 h.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="canal" className="text-xs font-medium text-vs-tinta-2">Canal</label>
          <select id="canal" name="canal" defaultValue="whatsapp" className={campo}>
            <option value="whatsapp">WhatsApp institucional</option>
            <option value="telefono">Teléfono</option>
            <option value="presencial">En persona</option>
            <option value="correo">Correo</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nuevaFecha" className="text-xs font-medium text-vs-tinta-2">
            Nueva fecha y hora
          </label>
          <div className="flex gap-2">
            <input id="nuevaFecha" name="nuevaFecha" type="date" max={cierreDePeriodo} required className={`${campo} flex-1`} />
            <input id="nuevaHora" name="nuevaHora" type="time" required className={campo} />
          </div>
          <span className="text-xs text-vs-tinta-3">
            Dentro del período, que cierra el {cierreDePeriodo}.
          </span>
        </div>
      </div>

      {puedeAutorizar && (
        <div className="rounded-lg border border-vs-linea p-3">
          <label htmlFor="autorizar" className="flex gap-3 text-sm">
            <input
              id="autorizar" name="autorizar" type="checkbox" className="mt-0.5"
              checked={autorizar} onChange={(e) => setAutorizar(e.target.checked)}
            />
            <span>
              <strong>Autorizar aunque el aviso llegue con menos de 24 h.</strong>
              <span className="mt-0.5 block text-xs text-vs-tinta-3">
                Solo el director. Queda registrado con tu nombre y el motivo.
              </span>
            </span>
          </label>
          {autorizar && (
            <input
              id="motivoExcepcion" name="motivoExcepcion" required
              placeholder="Motivo de la excepción"
              className={`${campo} mt-3 w-full`}
            />
          )}
        </div>
      )}

      <div>
        <Enviar texto="Posponer y agendar recuperación" pendiente="Posponiendo…" />
      </div>
      <p className="text-xs text-vs-tinta-3">
        Quedan {2 - posposicionesUsadas} de 2 posposiciones en este período.
      </p>
    </form>
  );
}
