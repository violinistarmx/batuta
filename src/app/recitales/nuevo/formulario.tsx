"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { crear, type EstadoRecitalUI } from "../acciones";

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
      {pending ? "Creando…" : "Crear recital"}
    </button>
  );
}

export function FormularioRecital({ hoy }: { hoy: string }) {
  const [estado, accion] = useActionState<EstadoRecitalUI, FormData>(crear, {});

  return (
    <form action={accion} className="flex flex-col gap-5">
      {estado.error && (
        <p id="error-recital" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Cuándo y dónde</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="nombre" label="Nombre del recital" ancho="sm:col-span-2">
            <input id="nombre" name="nombre" required className={campo}
                   placeholder="Recital de fin de curso" />
          </Campo>
          <Campo id="fecha" label="Fecha">
            <input id="fecha" name="fecha" type="date" defaultValue={hoy} required className={campo} />
          </Campo>
          <Campo id="hora" label="Hora">
            <input id="hora" name="hora" type="time" defaultValue="17:00" required className={campo} />
          </Campo>
          <Campo id="sede" label="Sede" ancho="sm:col-span-2">
            <input id="sede" name="sede" required className={campo}
                   placeholder="Teatro de la Ciudad, salón de la academia…" />
          </Campo>
          <Campo id="direccionSede" label="Dirección" ancho="sm:col-span-2">
            <input id="direccionSede" name="direccionSede" className={campo} />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Aforo y boletos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="capacidad" label="Aforo de la sede"
                 nota="Déjalo vacío si no hay tope. Vacío no es cero: el sistema no limitará la venta.">
            <input id="capacidad" name="capacidad" type="number" min="1" className={campo} />
          </Campo>
          <Campo id="precioBoleto" label="Precio del boleto en pesos"
                 nota="Cero es entrada libre. Una cortesía siempre vale $0, pero ocupa silla.">
            <input id="precioBoleto" name="precioBoleto" type="number" step="0.01" min="0"
                   className={campo} />
          </Campo>
          <Campo id="notas" label="Notas" ancho="sm:col-span-2">
            <input id="notas" name="notas" className={campo} />
          </Campo>
        </div>
      </section>

      <div><Guardar /></div>
    </form>
  );
}
