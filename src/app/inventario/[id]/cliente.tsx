"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  entregarInstrumento, recibirInstrumento, type EstadoInventario,
} from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

const CONDICIONES: [string, string][] = [
  ["nuevo", "Nuevo"], ["bueno", "Bueno"], ["regular", "Regular"], ["dañado", "Dañado"],
];

function Boton({ texto, pendiente }: { texto: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                       transition hover:bg-vs-naranja-claro disabled:opacity-60">
      {pending ? pendiente : texto}
    </button>
  );
}

function Aviso({ estado, sufijo }: { estado: EstadoInventario; sufijo: string }) {
  if (estado.error) {
    return (
      <p id={`error-${sufijo}`} role="alert"
         className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p id={`ok-${sufijo}`} role="status"
         className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
        {estado.ok}
      </p>
    );
  }
  return null;
}

export type Candidata = {
  inscripcionId: number; alumno: string; codigo: string;
  programa: string; terminaEl: string;
};

export function Prestar({ ejemplarId, candidatas, condicion, hoy }: {
  ejemplarId: number; candidatas: Candidata[]; condicion: string; hoy: string;
}) {
  const [estado, accion] = useActionState<EstadoInventario, FormData>(entregarInstrumento, {});
  const [firmada, setFirmada] = useState(false);
  const [elegida, setElegida] = useState("");

  const candidata = candidatas.find((c) => String(c.inscripcionId) === elegida);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="ejemplarId" value={ejemplarId} />
      <Aviso estado={estado} sufijo="prestamo" />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="inscripcionId" className={etiqueta}>A quién se le presta</label>
          <select id="inscripcionId" name="inscripcionId" required className={campo}
                  value={elegida} onChange={(e) => setElegida(e.target.value)}>
            <option value="" disabled>Elige…</option>
            {candidatas.map((c) => (
              <option key={c.inscripcionId} value={c.inscripcionId}>
                {c.alumno} · {c.codigo} · {c.programa}
              </option>
            ))}
          </select>
          <span className="text-xs text-vs-tinta-3">
            Solo aparecen alumnos de Allegro Virtuoso con período abierto que estudian este
            instrumento y no tienen ya uno prestado.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="entregadoEl" className={etiqueta}>Fecha de entrega</label>
          <input id="entregadoEl" name="entregadoEl" type="date" defaultValue={hoy}
                 required className={campo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="condicionSalida" className={etiqueta}>Condición al salir</label>
          <select id="condicionSalida" name="condicionSalida" defaultValue={condicion}
                  className={campo}>
            {CONDICIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="notas" className={etiqueta}>Notas</label>
          <input id="notas" name="notas" className={campo}
                 placeholder="«Sale con estuche y dos juegos de cuerdas»" />
        </div>
      </div>

      {candidata && (
        <p className="rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-xs text-vs-tinta-2">
          El préstamo se ancla al período de {candidata.alumno}, que termina el{" "}
          <strong>{candidata.terminaEl}</strong>. A partir de esa fecha el instrumento
          aparece como pendiente de devolver.
        </p>
      )}

      <label htmlFor="responsivaFirmada" className="flex items-start gap-3 text-sm">
        <input id="responsivaFirmada" name="responsivaFirmada" type="checkbox" className="mt-1"
               checked={firmada} onChange={(e) => setFirmada(e.target.checked)} />
        <span>
          <strong>El tutor firmó la responsiva</strong> · obligatorio
          <span className="mt-0.5 block text-xs text-vs-tinta-3">
            Al guardar se genera el documento para imprimir. Sin firma no sale el instrumento.
          </span>
        </span>
      </label>

      <div><Boton texto="Registrar entrega" pendiente="Registrando…" /></div>
    </form>
  );
}

export function Devolver({ prestamoId, hoy }: { prestamoId: number; hoy: string }) {
  const [estado, accion] = useActionState<EstadoInventario, FormData>(recibirInstrumento, {});
  const [incidencia, setIncidencia] = useState("ninguna");

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="prestamoId" value={prestamoId} />
      <Aviso estado={estado} sufijo="devolucion" />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="devueltoEl" className={etiqueta}>Fecha de devolución</label>
          <input id="devueltoEl" name="devueltoEl" type="date" defaultValue={hoy}
                 required className={campo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="condicionRegreso" className={etiqueta}>Cómo regresó</label>
          <select id="condicionRegreso" name="condicionRegreso" defaultValue="bueno" className={campo}>
            {CONDICIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="incidencia" className={etiqueta}>¿Hubo incidencia?</label>
          <select id="incidencia" name="incidencia" className={campo}
                  value={incidencia} onChange={(e) => setIncidencia(e.target.value)}>
            <option value="ninguna">No, todo bien</option>
            <option value="dano">Regresó dañado</option>
            <option value="perdida">No lo devolvió</option>
          </select>
        </div>
      </div>

      {incidencia !== "ninguna" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="incidenciaNota" className={etiqueta}>Qué pasó · obligatorio</label>
            <input id="incidenciaNota" name="incidenciaNota" required className={campo}
                   placeholder="«Se rompió la clavija del mi; el estuche viene completo»" />
          </div>
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>No se genera ningún cargo.</strong> Queda la evidencia y el ejemplar cambia
            de estado; si hay que cobrar algo, lo registras tú como cargo en su expediente.
            {incidencia === "perdida" && " El ejemplar se da de baja del inventario."}
            {incidencia === "dano" && " El ejemplar pasa a «en reparación» y no se podrá prestar."}
          </p>
        </>
      )}

      <div><Boton texto="Registrar devolución" pendiente="Registrando…" /></div>
    </form>
  );
}
