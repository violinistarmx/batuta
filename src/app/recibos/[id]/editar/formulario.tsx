"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { editarPago, type EstadoEditar } from "@/app/finanzas/acciones";

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
      {pending ? "Guardando…" : "Guardar cambios y ver recibo"}
    </button>
  );
}

type Inicial = {
  monto: string;
  descuento: string;
  metodo: string;
  recibidoEl: string;
  referencia: string;
  descripcion: string;
  nota: string;
};

export function FormularioEditarPago({
  reciboId, pagoId, alumnoId, alumno, folio, inicial, puedeDescontar,
}: {
  reciboId: number;
  pagoId: number;
  alumnoId: number;
  alumno: string;
  folio: string;
  inicial: Inicial;
  puedeDescontar?: boolean;
}) {
  const [estado, accion] = useActionState<EstadoEditar, FormData>(editarPago, {});

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="reciboId" value={reciboId} />
      <input type="hidden" name="pagoId" value={pagoId} />

      <div className="rounded-lg border border-vs-linea bg-vs-crema px-4 py-3 text-sm text-vs-tinta-2">
        <span className="font-medium text-vs-tinta">{alumno}</span> · Folio {folio}
      </div>

      {estado.error && (
        <p role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="monto" className="text-xs font-medium text-vs-tinta-2">Monto en pesos</label>
          <input
            id="monto" name="monto" type="number" step="0.01" min="0.01" required
            className={campo} defaultValue={inicial.monto}
          />
        </div>

        {puedeDescontar && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="descuento" className="text-xs font-medium text-vs-tinta-2">
              Descuento (condonar)
            </label>
            <input
              id="descuento" name="descuento" type="number" step="0.01" min="0"
              placeholder="0.00"
              className={campo} defaultValue={inicial.descuento}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="metodo" className="text-xs font-medium text-vs-tinta-2">Forma de pago</label>
          <select id="metodo" name="metodo" defaultValue={inicial.metodo} className={campo}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="deposito">Depósito</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="recibidoEl" className="text-xs font-medium text-vs-tinta-2">Fecha</label>
          <input
            id="recibidoEl" name="recibidoEl" type="date"
            defaultValue={inicial.recibidoEl} required className={campo}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="referencia" className="text-xs font-medium text-vs-tinta-2">Referencia</label>
          <input
            id="referencia" name="referencia"
            placeholder="Folio o últimos dígitos"
            defaultValue={inicial.referencia}
            className={campo}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-xs font-medium text-vs-tinta-2">
          Descripción <span className="font-normal text-vs-tinta-3">(aparece en el recibo)</span>
        </label>
        <textarea
          id="descripcion" name="descripcion" rows={3}
          placeholder={"Ej: mensualidad octubre con beca del 10%\nClases programadas: sábado 4, 11, 18 y 25 de octubre"}
          defaultValue={inicial.descripcion}
          className={campo}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className="text-xs font-medium text-vs-tinta-2">
          Observaciones internas
        </label>
        <textarea
          id="nota" name="nota" rows={3}
          defaultValue={inicial.nota}
          className={campo}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Boton />
        <a
          href={`/recibos/${reciboId}`}
          className="text-sm text-vs-tinta-3 hover:underline"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
