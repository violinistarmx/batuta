"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { registrarProspecto, type EstadoNuevo } from "../acciones";

type Opcion = { id: number; nombre: string };

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

const ORIGENES: [string, string][] = [
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"],
  ["recomendacion", "Recomendación"], ["paso_por_la_calle", "Pasó por la calle"],
  ["whatsapp", "WhatsApp"], ["google", "Google"], ["evento", "Evento"], ["otro", "Otro"],
];

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
    <button
      type="submit" disabled={pending}
      className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                 transition hover:bg-vs-naranja-claro disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Registrar prospecto"}
    </button>
  );
}

export function FormularioProspecto({
  programas, instrumentos, hoy, enSieteDias,
}: {
  programas: Opcion[]; instrumentos: Opcion[]; hoy: string; enSieteDias: string;
}) {
  const [estado, accion] = useActionState<EstadoNuevo, FormData>(registrarProspecto, {});
  const [origen, setOrigen] = useState("instagram");
  const pideDetalle = origen === "recomendacion" || origen === "evento" || origen === "otro";

  return (
    <form action={accion} className="flex flex-col gap-5">
      {estado.error && (
        <p id="error-prospecto" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Quién tomaría la clase</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="nombre" label="Nombre" ancho="sm:col-span-2">
            <input id="nombre" name="nombre" required className={campo} />
          </Campo>
          <Campo id="edadAproximada" label="Edad aproximada"
                 nota="Sirve para saber si hará falta tutor al inscribirlo.">
            <input id="edadAproximada" name="edadAproximada" type="number" min="1" max="119"
                   className={campo} />
          </Campo>
          <Campo id="programaInteresId" label="Programa que le interesa">
            <select id="programaInteresId" name="programaInteresId" className={campo} defaultValue="">
              <option value="">Todavía no sabe</option>
              {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo id="instrumentoInteresId" label="Instrumento">
            <select id="instrumentoInteresId" name="instrumentoInteresId" className={campo} defaultValue="">
              <option value="">Todavía no sabe</option>
              {instrumentos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Quién pregunta</h2>
        <p className="mt-1 text-sm text-vs-tinta-2">
          Si el adulto pregunta por sí mismo, deja estos campos en blanco. Cuando es otra
          persona, se convierte en el tutor al inscribir.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="contactoNombre" label="Nombre de quien escribe">
            <input id="contactoNombre" name="contactoNombre" className={campo} />
          </Campo>
          <Campo id="contactoParentesco" label="Parentesco">
            <input id="contactoParentesco" name="contactoParentesco"
                   placeholder="Madre, padre, abuela…" className={campo} />
          </Campo>
          <Campo id="telefono" label="Teléfono">
            <input id="telefono" name="telefono" type="tel" className={campo} />
          </Campo>
          <Campo id="whatsapp" label="WhatsApp">
            <input id="whatsapp" name="whatsapp" type="tel" placeholder="Si es distinto" className={campo} />
          </Campo>
          <Campo id="email" label="Correo electrónico" ancho="sm:col-span-2">
            <input id="email" name="email" type="email" className={campo} />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">De dónde llegó</h2>
        <p className="mt-1 text-sm text-vs-tinta-2">
          Es el dato que decide en qué gastar el siguiente peso de publicidad, y se pierde
          para siempre si no se captura hoy.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="origen" label="Origen">
            <select id="origen" name="origen" className={campo} value={origen}
                    onChange={(ev) => setOrigen(ev.target.value)}>
              {ORIGENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
          {pideDetalle && (
            <Campo id="origenDetalle" label={origen === "recomendacion" ? "¿Quién lo recomendó?" : "Detalle"}>
              <input id="origenDetalle" name="origenDetalle" className={campo} />
            </Campo>
          )}
          <Campo id="proximoSeguimientoEl" label="¿Cuándo le escribimos?"
                 nota="Un prospecto sin fecha de contacto se enfría solo.">
            <input id="proximoSeguimientoEl" name="proximoSeguimientoEl" type="date"
                   defaultValue={hoy} min={hoy} max={enSieteDias} className={campo} />
          </Campo>
          <Campo id="notas" label="Qué pidió" ancho="sm:col-span-2">
            <input id="notas" name="notas"
                   placeholder="«Quiere clases para su hija de 7, sábados por la mañana»"
                   className={campo} />
          </Campo>
        </div>
      </section>

      <div><Guardar /></div>
    </form>
  );
}
