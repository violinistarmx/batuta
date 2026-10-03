"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { darDeAltaEjemplar, type EstadoInventario } from "../acciones";

type Instrumento = { id: number; nombre: string; granFormato: boolean };

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

function Campo({ id, label, children, ancho = "", nota }: {
  id: string; label: string; children: React.ReactNode; ancho?: string; nota?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${ancho}`}>
      <label htmlFor={id} className={etiqueta}>{label}</label>
      {children}
      {nota && <span className="text-xs text-vs-tinta-3">{nota}</span>}
    </div>
  );
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                       transition hover:bg-vs-naranja-claro disabled:opacity-60">
      {pending ? "Guardando…" : "Dar de alta"}
    </button>
  );
}

export function FormularioEjemplar({ instrumentos, hoy }: {
  instrumentos: Instrumento[]; hoy: string;
}) {
  const [estado, accion] = useActionState<EstadoInventario, FormData>(darDeAltaEjemplar, {});
  const [instrumentoId, setInstrumentoId] = useState("");

  const elegido = instrumentos.find((i) => String(i.id) === instrumentoId);

  return (
    <form action={accion} className="flex flex-col gap-5">
      {estado.error && (
        <p id="error-ejemplar" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Qué es</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="instrumentoId" label="Instrumento" ancho="sm:col-span-2">
            <select id="instrumentoId" name="instrumentoId" required className={campo}
                    value={instrumentoId} onChange={(e) => setInstrumentoId(e.target.value)}>
              <option value="" disabled>Elige…</option>
              {instrumentos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}{i.granFormato ? " (gran formato)" : ""}
                </option>
              ))}
            </select>
          </Campo>

          {elegido?.granFormato && (
            <p id="aviso-gran-formato"
               className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">
              Los de gran formato <strong>no salen de las instalaciones</strong> (cláusula 9ª).
              Se registran para el inventario, pero el sistema no los va a prestar.
            </p>
          )}

          <Campo id="marca" label="Marca">
            <input id="marca" name="marca" className={campo} placeholder="Cremona, Yamaha…" />
          </Campo>
          <Campo id="modelo" label="Modelo">
            <input id="modelo" name="modelo" className={campo} />
          </Campo>
          <Campo id="medida" label="Medida"
                 nota="4/4, 3/4, 1/2… Un violín de 1/2 no le sirve a un adolescente.">
            <input id="medida" name="medida" className={campo} placeholder="4/4" />
          </Campo>
          <Campo id="numeroSerie" label="Número de serie">
            <input id="numeroSerie" name="numeroSerie" className={campo} />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Cómo está y dónde</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="condicion" label="Condición">
            <select id="condicion" name="condicion" defaultValue="bueno" className={campo}>
              <option value="nuevo">Nuevo</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="dañado">Dañado</option>
            </select>
          </Campo>
          <Campo id="ubicacion" label="Dónde vive">
            <input id="ubicacion" name="ubicacion" className={campo}
                   placeholder="Cubículo 1, bodega…" />
          </Campo>
          <Campo id="valor" label="Valor de reposición en pesos"
                 nota="Informativo: para el seguro y para saber cuánto se arriesga al prestar. No genera cargos.">
            <input id="valor" name="valor" type="number" step="0.01" min="0" className={campo} />
          </Campo>
          <Campo id="adquiridoEl" label="Fecha de compra">
            <input id="adquiridoEl" name="adquiridoEl" type="date" max={hoy} className={campo} />
          </Campo>
          <Campo id="notas" label="Notas" ancho="sm:col-span-2">
            <input id="notas" name="notas" className={campo}
                   placeholder="«Viene con estuche y arco de repuesto»" />
          </Campo>
        </div>
      </section>

      <div><Guardar /></div>
    </form>
  );
}
