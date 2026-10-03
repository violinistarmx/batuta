"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { guardarAjuste, type EstadoAjustes } from "./acciones";
import {
  OPCIONES, advertencias, esDinero, type Parametro,
} from "@/lib/dominio/ajustes";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="rounded-lg border border-vs-linea px-3 py-2 text-sm font-medium
                       transition hover:border-vs-naranja-700 disabled:opacity-60">
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

/** El valor como se captura: el dinero en pesos, lo demás tal cual. */
function paraCapturar(p: Parametro): string {
  return esDinero(p.clave) ? String(Number(p.valor) / 100) : p.valor;
}

export function Ajuste({ p, actualizado }: { p: Parametro; actualizado: string }) {
  const [estado, accion] = useActionState<EstadoAjustes, FormData>(guardarAjuste, {});
  const [valor, setValor] = useState(paraCapturar(p));

  const guardado = esDinero(p.clave)
    ? String(Math.round(Number(valor) * 100))
    : valor.trim();
  const avisos = advertencias(p.clave, p.valor, guardado);
  const opciones = OPCIONES[p.clave];

  return (
    <div data-ajuste={p.clave} className="border-t border-vs-linea px-4 py-4 first:border-t-0">
      <form action={accion} className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <input type="hidden" name="clave" value={p.clave} />

        <div className="min-w-[16rem] flex-1">
          <label htmlFor={`v-${p.clave}`} className="font-medium">{p.descripcion}</label>
          <p className="mt-0.5 text-xs text-vs-tinta-3">
            <span className="font-mono">{p.clave}</span>
            {p.fuente && <> · {p.fuente}</>}
            {" · "}
            <span data-actualizado={p.clave}>Actualizado el {actualizado}</span>
          </p>
        </div>

        <div className="flex items-start gap-2">
          {opciones ? (
            <select id={`v-${p.clave}`} name="valor" className={campo}
                    value={valor} onChange={(e) => setValor(e.target.value)}>
              {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
          ) : p.tipo === "booleano" ? (
            <select id={`v-${p.clave}`} name="valor" className={campo}
                    value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input
              id={`v-${p.clave}`} name="valor" className={`${campo} w-48`}
              type={p.tipo === "texto" ? "text" : "number"}
              step={p.tipo === "decimal" ? "0.01" : esDinero(p.clave) ? "0.01" : "1"}
              min={p.tipo === "texto" ? undefined : "0"}
              value={valor} onChange={(e) => setValor(e.target.value)}
            />
          )}
          {esDinero(p.clave) && <span className="py-2 text-sm text-vs-tinta-3">pesos</span>}
          <Guardar />
        </div>
      </form>

      {avisos.map((a) => (
        <p key={a} data-aviso={p.clave}
           className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {a}
        </p>
      ))}

      {estado.clave === p.clave && estado.error && (
        <p data-error={p.clave} role="alert"
           className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {estado.error}
        </p>
      )}
      {estado.clave === p.clave && estado.ok && (
        <p data-ok={p.clave} role="status"
           className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
          {estado.ok}
        </p>
      )}
    </div>
  );
}
