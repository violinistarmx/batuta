"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { cobrar, type EstadoPago } from "@/app/finanzas/acciones";

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
      {pending ? "Registrando…" : "Registrar pago y emitir recibo"}
    </button>
  );
}

export function Cobrar({
  alumnoId, hoy, adeudoTotal, adeudoTexto, puedeDescontar,
}: {
  alumnoId: number; hoy: string; adeudoTotal: number; adeudoTexto: string;
  puedeDescontar?: boolean;
}) {
  const [estado, accion] = useActionState<EstadoPago, FormData>(cobrar, {});
  const [monto, setMonto] = useState(adeudoTotal > 0 ? (adeudoTotal / 100).toFixed(2) : "");
  const [descuento, setDescuento] = useState("");

  const montoNum = Number(monto) || 0;
  const descuentoNum = Number(descuento) || 0;
  const totalEfectivo = montoNum + descuentoNum;
  const parcial = adeudoTotal > 0 && totalEfectivo > 0 && totalEfectivo * 100 < adeudoTotal;
  const sobra = totalEfectivo * 100 > adeudoTotal;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="alumnoId" value={alumnoId} />

      {estado.error && (
        <p id="error-cobro" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="monto" className="text-xs font-medium text-vs-tinta-2">Monto en pesos</label>
          <input
            id="monto" name="monto" type="number" step="0.01" min="0.01" required
            className={campo} value={monto} onChange={(e) => setMonto(e.target.value)}
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
              className={campo} value={descuento} onChange={(e) => setDescuento(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="metodo" className="text-xs font-medium text-vs-tinta-2">Forma de pago</label>
          <select id="metodo" name="metodo" defaultValue="efectivo" className={campo}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="deposito">Depósito</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="recibidoEl" className="text-xs font-medium text-vs-tinta-2">Fecha</label>
          <input id="recibidoEl" name="recibidoEl" type="date" defaultValue={hoy} required className={campo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="referencia" className="text-xs font-medium text-vs-tinta-2">Referencia</label>
          <input id="referencia" name="referencia" placeholder="Folio o últimos dígitos" className={campo} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-xs font-medium text-vs-tinta-2">
          Descripción <span className="font-normal text-vs-tinta-3">(aparece en el recibo)</span>
        </label>
        <input
          id="descripcion" name="descripcion"
          placeholder="Ej: mensualidad octubre con beca del 10%"
          className={campo}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className="text-xs font-medium text-vs-tinta-2">
          Observaciones internas
        </label>
        <textarea id="nota" name="nota" rows={3} className={campo} />
      </div>

      {parcial && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Es un <strong>pago a cuenta</strong>: quedará un saldo pendiente de{" "}
          {((adeudoTotal - totalEfectivo * 100) / 100).toLocaleString("es-MX", {
            style: "currency", currency: "MXN", minimumFractionDigits: 0,
          })}. El recibo lo indicará.
        </p>
      )}
      {descuentoNum > 0 && !parcial && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Se condonarán{" "}
          {(descuentoNum).toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 })}{" "}
          del adeudo. El recibo solo refleja lo cobrado en efectivo/transferencia.
        </p>
      )}
      {sobra && adeudoTotal >= 0 && (
        <p className="rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-xs text-vs-tinta-2">
          Excede lo adeudado: la diferencia quedará <strong>a favor del alumno</strong> y se
          aplicará a cargos futuros.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Boton />
        <p className="text-xs text-vs-tinta-3">{adeudoTexto}</p>
      </div>
    </form>
  );
}
