"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  cancelarVenta, decidir, moverEstado, ordenar, pasarLista, proponerAlumno,
  vender, type EstadoRecitalUI,
} from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

function Boton({ texto, pendiente, tono = "primario" }: {
  texto: string; pendiente: string; tono?: "primario" | "secundario" | "peligro";
}) {
  const { pending } = useFormStatus();
  const clase = tono === "primario"
    ? "bg-vs-naranja text-vs-tinta hover:bg-vs-naranja-claro"
    : tono === "peligro"
      ? "border border-red-300 bg-white text-red-800 hover:border-red-500"
      : "border border-vs-linea bg-white hover:border-vs-naranja-700";
  return (
    <button type="submit" disabled={pending}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-60 ${clase}`}>
      {pending ? pendiente : texto}
    </button>
  );
}

function Aviso({ estado, sufijo }: { estado: EstadoRecitalUI; sufijo: string }) {
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

export function CambiarEstado({ recitalId, estado }: { recitalId: number; estado: string }) {
  const [res, accion] = useActionState<EstadoRecitalUI, FormData>(moverEstado, {});

  const siguientes: [string, string][] =
    estado === "planeado" ? [["abierto", "Abrir a propuestas"]]
    : estado === "abierto" ? [["programa_cerrado", "Cerrar el programa"], ["planeado", "Volver a preparación"]]
    : estado === "programa_cerrado" ? [["realizado", "Marcar como realizado"], ["abierto", "Reabrir propuestas"]]
    : [];

  return (
    <div className="flex flex-col gap-2">
      <Aviso estado={res} sufijo="estado" />
      <div className="flex flex-wrap gap-2">
        {siguientes.map(([v, t]) => (
          <form key={v} action={accion}>
            <input type="hidden" name="recitalId" value={recitalId} />
            <input type="hidden" name="estado" value={v} />
            <Boton texto={t} pendiente="Guardando…" tono="secundario" />
          </form>
        ))}
        {estado !== "cancelado" && estado !== "realizado" && (
          <form action={accion}>
            <input type="hidden" name="recitalId" value={recitalId} />
            <input type="hidden" name="estado" value="cancelado" />
            <Boton texto="Cancelar recital" pendiente="Cancelando…" tono="peligro" />
          </form>
        )}
      </div>
    </div>
  );
}

export type Candidata = {
  inscripcionId: number; alumno: string; codigo: string; instrumento: string; docente: string;
};

export function Proponer({ recitalId, candidatas }: {
  recitalId: number; candidatas: Candidata[];
}) {
  const [res, accion] = useActionState<EstadoRecitalUI, FormData>(proponerAlumno, {});

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="recitalId" value={recitalId} />
      <Aviso estado={res} sufijo="propuesta" />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="inscripcionId" className={etiqueta}>Alumno</label>
          <select id="inscripcionId" name="inscripcionId" required defaultValue="" className={campo}>
            <option value="" disabled>Elige…</option>
            {candidatas.map((c) => (
              <option key={c.inscripcionId} value={c.inscripcionId}>
                {c.alumno} · {c.instrumento}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="pieza" className={etiqueta}>Pieza</label>
          <input id="pieza" name="pieza" required className={campo}
                 placeholder="Minueto n.º 2" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="compositor" className={etiqueta}>Compositor</label>
          <input id="compositor" name="compositor" className={campo} placeholder="J. S. Bach" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="duracionMinutos" className={etiqueta}>Duración (min)</label>
          <input id="duracionMinutos" name="duracionMinutos" type="number" min="1" max="119"
                 className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notas" className={etiqueta}>Notas</label>
          <input id="notas" name="notas" className={campo} />
        </div>
      </div>

      <div><Boton texto="Proponer" pendiente="Proponiendo…" /></div>
    </form>
  );
}

export function Decidir({ participacionId, recitalId }: {
  participacionId: number; recitalId: number;
}) {
  const [res, accion] = useActionState<EstadoRecitalUI, FormData>(decidir, {});
  const [rechazando, setRechazando] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Aviso estado={res} sufijo={`decision-${participacionId}`} />
      <div className="flex flex-wrap items-end gap-2">
        <form action={accion}>
          <input type="hidden" name="participacionId" value={participacionId} />
          <input type="hidden" name="recitalId" value={recitalId} />
          <input type="hidden" name="accion" value="confirmar" />
          <Boton texto="Confirmar" pendiente="Confirmando…" />
        </form>

        {!rechazando ? (
          <button type="button" onClick={() => setRechazando(true)}
                  className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-sm
                             font-semibold text-red-800 transition hover:border-red-500">
            Devolver
          </button>
        ) : (
          <form action={accion} className="flex flex-1 flex-wrap items-end gap-2">
            <input type="hidden" name="participacionId" value={participacionId} />
            <input type="hidden" name="recitalId" value={recitalId} />
            <input type="hidden" name="accion" value="rechazar" />
            <input name="motivoRechazo" required className={`${campo} flex-1`}
                   placeholder="«La pieza todavía no está lista»" />
            <Boton texto="Devolver" pendiente="…" tono="peligro" />
          </form>
        )}
      </div>
    </div>
  );
}

export function Ordenar({ participacionId, recitalId, orden }: {
  participacionId: number; recitalId: number; orden: number | null;
}) {
  const [res, accion] = useActionState<EstadoRecitalUI, FormData>(ordenar, {});
  return (
    <form action={accion} className="flex items-end gap-2">
      <input type="hidden" name="participacionId" value={participacionId} />
      <input type="hidden" name="recitalId" value={recitalId} />
      <input name="orden" type="number" min="1" defaultValue={orden ?? ""}
             aria-label="Lugar en el programa"
             className={`${campo} w-20 tabular-nums`} />
      <Boton texto="Fijar" pendiente="…" tono="secundario" />
      {res.error && <span className="text-xs text-red-800">{res.error}</span>}
    </form>
  );
}

export function Lista({ participacionId, recitalId, asistio }: {
  participacionId: number; recitalId: number; asistio: boolean | null;
}) {
  const [, accion] = useActionState<EstadoRecitalUI, FormData>(pasarLista, {});
  return (
    <div className="flex gap-1.5">
      {(["si", "no"] as const).map((v) => (
        <form key={v} action={accion}>
          <input type="hidden" name="participacionId" value={participacionId} />
          <input type="hidden" name="recitalId" value={recitalId} />
          <input type="hidden" name="asistio" value={v} />
          <button type="submit"
                  className={`rounded border px-2 py-0.5 text-xs font-medium transition ${
                    (v === "si" && asistio === true) || (v === "no" && asistio === false)
                      ? "border-vs-naranja bg-vs-amarillo-suave"
                      : "border-vs-linea bg-white hover:border-vs-naranja-700"
                  }`}>
            {v === "si" ? "Llegó" : "No llegó"}
          </button>
        </form>
      ))}
    </div>
  );
}

export function Taquilla({ recitalId, hoy, precio, libres }: {
  recitalId: number; hoy: string; precio: string; libres: number | null;
}) {
  const [res, accion] = useActionState<EstadoRecitalUI, FormData>(vender, {});
  const [metodo, setMetodo] = useState("efectivo");

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="recitalId" value={recitalId} />
      <Aviso estado={res} sufijo="venta" />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cantidad" className={etiqueta}>Boletos</label>
          <input id="cantidad" name="cantidad" type="number" min="1" defaultValue="1"
                 max={libres ?? undefined} required className={campo} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="compradorNombre" className={etiqueta}>A nombre de</label>
          <input id="compradorNombre" name="compradorNombre" required className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="compradorTelefono" className={etiqueta}>Teléfono</label>
          <input id="compradorTelefono" name="compradorTelefono" className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="metodo" className={etiqueta}>Forma de pago</label>
          <select id="metodo" name="metodo" className={campo}
                  value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="deposito">Depósito</option>
            <option value="cortesia">Cortesía</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vendidoEl" className={etiqueta}>Fecha</label>
          <input id="vendidoEl" name="vendidoEl" type="date" defaultValue={hoy}
                 required className={campo} />
        </div>
      </div>

      <p className="text-xs text-vs-tinta-3">
        {metodo === "cortesia"
          ? "Una cortesía vale $0, pero ocupa silla: cuenta para el aforo igual que un boleto pagado."
          : `A ${precio} cada uno.`}
        {libres !== null && ` Quedan ${libres} lugar(es).`}
      </p>

      <div><Boton texto="Registrar venta" pendiente="Registrando…" /></div>
    </form>
  );
}

export function CancelarBoleto({ boletoId, recitalId }: { boletoId: number; recitalId: number }) {
  const [res, accion] = useActionState<EstadoRecitalUI, FormData>(cancelarVenta, {});
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
              className="text-xs text-vs-tinta-3 underline-offset-2 hover:underline">
        Cancelar
      </button>
    );
  }

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="boletoId" value={boletoId} />
      <input type="hidden" name="recitalId" value={recitalId} />
      <input name="motivo" required className={`${campo} flex-1`} placeholder="Motivo" />
      <Boton texto="Cancelar" pendiente="…" tono="peligro" />
      {res.error && <span className="text-xs text-red-800">{res.error}</span>}
    </form>
  );
}
