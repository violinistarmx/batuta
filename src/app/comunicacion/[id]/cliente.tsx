"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { guardarEdicion, mover, type EstadoMensajeUI } from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

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
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${clase}`}>
      {pending ? pendiente : texto}
    </button>
  );
}

function Aviso({ estado, sufijo }: { estado: EstadoMensajeUI; sufijo: string }) {
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

export function Editar({ id, cuerpo, telefono }: {
  id: number; cuerpo: string; telefono: string | null;
}) {
  const [estado, accion] = useActionState<EstadoMensajeUI, FormData>(guardarEdicion, {});
  const [texto, setTexto] = useState(cuerpo);
  const huecos = [...texto.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g)]
    .map((m) => m[1]);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Aviso estado={estado} sufijo="edicion" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cuerpo" className="text-xs font-medium text-vs-tinta-2">
          Texto del mensaje
        </label>
        <textarea id="cuerpo" name="cuerpo" rows={10} className={`${campo} font-mono`}
                  value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="telefono" className="text-xs font-medium text-vs-tinta-2">
          Teléfono del destinatario
        </label>
        <input id="telefono" name="telefono" defaultValue={telefono ?? ""} className={campo} />
      </div>

      {huecos.length > 0 && (
        <p id="aviso-huecos"
           className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Quedan datos sin llenar: {huecos.map((h) => `{{${h}}}`).join(", ")}. No se puede
          guardar así: a un tutor no le puede llegar un mensaje con huecos.
        </p>
      )}

      <div><Boton texto="Guardar borrador" pendiente="Guardando…" tono="secundario" /></div>
    </form>
  );
}

export function Decidir({ id, estado }: { id: number; estado: string }) {
  const [res, accion] = useActionState<EstadoMensajeUI, FormData>(mover, {});
  const [rechazando, setRechazando] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Aviso estado={res} sufijo="decision" />

      {(estado === "borrador") && (
        <div className="flex flex-wrap items-start gap-3">
          <form action={accion}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="hacia" value="aprobado" />
            <Boton texto="Aprobar" pendiente="Aprobando…" />
          </form>

          {!rechazando ? (
            <button type="button" onClick={() => setRechazando(true)}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm
                               font-semibold text-red-800 transition hover:border-red-500">
              Devolver con observaciones
            </button>
          ) : (
            <form action={accion} className="flex flex-1 flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="hacia" value="rechazado" />
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="motivoRechazo" className="text-xs font-medium text-vs-tinta-2">
                  Qué hay que corregir
                </label>
                <input id="motivoRechazo" name="motivoRechazo" required
                       className={`${campo} w-full`}
                       placeholder="«El monto no coincide con el recibo»" />
              </div>
              <Boton texto="Devolver" pendiente="Devolviendo…" tono="peligro" />
            </form>
          )}
        </div>
      )}

      {estado === "aprobado" && (
        <form action={accion} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="hacia" value="enviado" />
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="notaEnvio" className="text-xs font-medium text-vs-tinta-2">
              Nota del envío
            </label>
            <input id="notaEnvio" name="notaEnvio" className={`${campo} w-full`}
                   placeholder="«Mandado por WhatsApp, visto a las 6»" />
          </div>
          <Boton texto="Marcar como enviado" pendiente="Registrando…" />
        </form>
      )}

      {estado === "rechazado" && (
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="hacia" value="borrador" />
          <Boton texto="Volver a la cola de aprobación" pendiente="Guardando…" tono="secundario" />
        </form>
      )}

      {(estado === "borrador" || estado === "aprobado" || estado === "rechazado") && (
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="hacia" value="cancelado" />
          <button type="submit"
                  className="text-xs text-vs-tinta-3 underline-offset-2 hover:underline">
            Cancelar este mensaje
          </button>
        </form>
      )}
    </div>
  );
}
