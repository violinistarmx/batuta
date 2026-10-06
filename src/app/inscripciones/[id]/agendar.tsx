"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { agendar, type EstadoAgendar } from "@/app/clases/acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Boton() {
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
      {pending ? "Agendando…" : "Agendar clase"}
    </button>
  );
}

/** Parsea "HH:MM" y devuelve [horas, minutos] como enteros seguros. */
function parseHora(hhmm: string): [number, number] {
  const sep = hhmm.indexOf(":");
  return [parseInt(hhmm.slice(0, sep), 10) || 0, parseInt(hhmm.slice(sep + 1), 10) || 0];
}

/** Calcula la hora de fin sumando minutos a una cadena "HH:MM". */
function horaFin(horaInicio: string, minutos: number): string {
  const [h, m] = parseHora(horaInicio);
  const totalMin = h * 60 + m + minutos;
  const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Convierte "HH:MM" a formato civil "4:00 pm". */
function civil(hhmm: string): string {
  const [h, m] = parseHora(hhmm);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function Agendar({
  inscripcionId, cicloId, aulas, hoy, minutos, saldo,
}: {
  inscripcionId: number; cicloId: number;
  aulas: { id: number; nombre: string }[];
  hoy: string; minutos: number; saldo: number;
}) {
  const [estado, accion] = useActionState<EstadoAgendar, FormData>(agendar, {});
  const [modalidad, setModalidad] = useState<"presencial" | "en_linea">("presencial");
  const [hora, setHora] = useState("16:00");
  const [dur, setDur] = useState(minutos);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <input type="hidden" name="cicloId" value={cicloId} />

      {estado.error && (
        <div id="error-agendar" role="alert"
             className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{estado.error}</p>
          {estado.conflictos?.map((c) => <p key={c} className="mt-1 text-xs">{c}</p>)}
        </div>
      )}

      {saldo <= 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          El período no tiene clases disponibles. Puedes agendar de todas formas, pero el
          saldo quedará en negativo al registrar la asistencia.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fecha" className="text-xs font-medium text-vs-tinta-2">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} required className={campo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="hora" className="text-xs font-medium text-vs-tinta-2">Hora inicio</label>
          <input
            id="hora" name="hora" type="time"
            value={hora} required className={campo}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="duracion" className="text-xs font-medium text-vs-tinta-2">Duración (min)</label>
          <input
            id="duracion" name="duracion" type="number"
            min={15} max={240} step={5}
            value={dur} required className={campo}
            onChange={(e) => setDur(Number(e.target.value))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="modalidad" className="text-xs font-medium text-vs-tinta-2">Modalidad</label>
          <select
            id="modalidad" name="modalidad" className={campo} value={modalidad}
            onChange={(e) => setModalidad(e.target.value as "presencial" | "en_linea")}
          >
            <option value="presencial">Presencial</option>
            <option value="en_linea">En línea</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="aulaId" className="text-xs font-medium text-vs-tinta-2">Cubículo</label>
          <select
            id="aulaId" name="aulaId" className={campo}
            disabled={modalidad === "en_linea"}
            defaultValue={aulas[0]?.id ?? ""}
          >
            {aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          {modalidad === "en_linea" && (
            <span className="text-xs text-vs-tinta-3">No ocupa cubículo.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Boton />
        <p className="text-xs text-vs-tinta-3">
          {civil(hora)} – {civil(horaFin(hora, dur))}
          {" "}({dur} min). Se avisa si choca con otra clase.
        </p>
      </div>
    </form>
  );
}
