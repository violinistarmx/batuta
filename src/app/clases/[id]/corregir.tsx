"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { corregirHorario, type EstadoAgendar } from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm font-semibold
                 transition hover:bg-vs-crema focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700
                 disabled:opacity-60"
    >
      {pending ? "Corrigiendo…" : "Guardar corrección"}
    </button>
  );
}

/**
 * Corrección del horario de una clase programada. Solo la ve dirección.
 *
 * Se presenta aparte de «Posponer» y con otro peso visual a propósito: son dos
 * operaciones distintas y confundirlas sale caro. Posponer le gasta al alumno una
 * de sus posposiciones del período; esto no.
 */
export function Corregir({
  claseId, fecha, hora, aulaId, modalidad, aulas,
}: {
  claseId: number;
  fecha: string;
  hora: string;
  aulaId: number | null;
  modalidad: "presencial" | "en_linea";
  aulas: { id: number; nombre: string }[];
}) {
  const [estado, accion] = useActionState<EstadoAgendar, FormData>(corregirHorario, {});
  const [modo, setModo] = useState<"presencial" | "en_linea">(modalidad);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="claseId" value={claseId} />

      {estado.error && (
        <div id="error-corregir" role="alert"
             className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{estado.error}</p>
          {estado.conflictos?.map((c) => <p key={c} className="mt-1 text-xs">{c}</p>)}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="corregir-fecha" className={etiqueta}>Fecha</label>
          <input id="corregir-fecha" name="fecha" type="date" defaultValue={fecha}
                 required className={campo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="corregir-hora" className={etiqueta}>Hora</label>
          <input id="corregir-hora" name="hora" type="time" defaultValue={hora}
                 required className={campo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="corregir-modalidad" className={etiqueta}>Modalidad</label>
          <select
            id="corregir-modalidad" name="modalidad" className={campo} value={modo}
            onChange={(e) => setModo(e.target.value as "presencial" | "en_linea")}
          >
            <option value="presencial">Presencial</option>
            <option value="en_linea">En línea</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="corregir-aula" className={etiqueta}>Cubículo</label>
          <select id="corregir-aula" name="aulaId" className={campo}
                  defaultValue={aulaId ?? ""} disabled={modo === "en_linea"}>
            <option value="">—</option>
            {aulas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Boton />
        <span className="text-xs text-vs-tinta-3">
          La duración no cambia: la fija el programa contratado.
        </span>
      </div>
    </form>
  );
}
