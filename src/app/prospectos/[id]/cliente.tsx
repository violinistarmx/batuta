"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  anotarSeguimiento, convertir, moverEtapa,
  type EstadoConversion, type EstadoSeguimiento,
} from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

function Boton({ texto, pendiente, secundario = false }: {
  texto: string; pendiente: string; secundario?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
        secundario
          ? "border border-vs-linea bg-white hover:border-vs-naranja-700"
          : "bg-vs-naranja text-vs-tinta hover:bg-vs-naranja-claro"
      }`}
    >
      {pending ? pendiente : texto}
    </button>
  );
}

function Aviso({ estado, sufijo }: { estado: EstadoSeguimiento; sufijo: string }) {
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

// ----------------------------------------------------------- seguimiento ---

export function Contactar({ prospectoId, hoy }: { prospectoId: number; hoy: string }) {
  const [estado, accion] = useActionState<EstadoSeguimiento, FormData>(anotarSeguimiento, {});
  const [resultado, setResultado] = useState("contactado");

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="prospectoId" value={prospectoId} />
      <Aviso estado={estado} sufijo="seguimiento" />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fecha" className={etiqueta}>Cuándo</label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} required className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="canal" className={etiqueta}>Por dónde</label>
          <select id="canal" name="canal" defaultValue="whatsapp" className={campo}>
            <option value="whatsapp">WhatsApp</option>
            <option value="llamada">Llamada</option>
            <option value="mensaje_directo">Mensaje directo</option>
            <option value="correo">Correo</option>
            <option value="presencial">En la academia</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="resultado" className={etiqueta}>Qué pasó</label>
          <select id="resultado" name="resultado" className={campo}
                  value={resultado} onChange={(e) => setResultado(e.target.value)}>
            <option value="contactado">Contestó</option>
            <option value="sin_respuesta">No contestó</option>
            <option value="pidio_informacion">Pidió información</option>
            <option value="agendo_clase_muestra">Agendó clase muestra</option>
            <option value="rechazo">Dijo que no</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proximoSeguimientoEl" className={etiqueta}>Siguiente contacto</label>
          <input id="proximoSeguimientoEl" name="proximoSeguimientoEl" type="date"
                 className={campo} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className={etiqueta}>Nota</label>
        <input id="nota" name="nota" className={campo}
               placeholder="«Prefiere sábados. Pregunta si hay descuento por dos hermanos»" />
      </div>

      {resultado === "rechazo" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Esto lo mueve a <strong>perdido</strong>. Registra el motivo abajo para que el
          reporte enseñe por qué se pierden.
        </p>
      )}
      {resultado === "agendo_clase_muestra" && (
        <p className="rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-xs text-vs-tinta-2">
          Pasa a <strong>clase muestra</strong>. Pon la fecha de la muestra abajo.
        </p>
      )}

      <div><Boton texto="Registrar contacto" pendiente="Guardando…" /></div>
    </form>
  );
}

// ----------------------------------------------------------------- etapa ---

const MOTIVOS: [string, string][] = [
  ["precio", "Precio"], ["horario", "No hay horario que le sirva"],
  ["distancia", "Distancia"], ["no_contesto", "Nunca contestó"],
  ["eligio_otra", "Eligió otra academia"], ["sin_interes", "Perdió el interés"],
  ["otro", "Otro"],
];

export function Etapa({ prospectoId, estadoActual, permitidas, claseMuestraEl, claseMuestraHora }: {
  prospectoId: number; estadoActual: string; permitidas: { valor: string; texto: string }[];
  claseMuestraEl: string | null; claseMuestraHora: string | null;
}) {
  const [estado, accion] = useActionState<EstadoSeguimiento, FormData>(moverEtapa, {});
  const [destino, setDestino] = useState(estadoActual);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="prospectoId" value={prospectoId} />
      <Aviso estado={estado} sufijo="etapa" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className={etiqueta}>Etapa</label>
          <select id="estado" name="estado" className={campo}
                  value={destino} onChange={(e) => setDestino(e.target.value)}>
            {permitidas.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proximoSeguimientoEl" className={etiqueta}>Siguiente contacto</label>
          <input id="proximoSeguimientoEl" name="proximoSeguimientoEl" type="date" className={campo} />
        </div>
      </div>

      {destino === "clase_muestra" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claseMuestraEl" className={etiqueta}>Fecha de la muestra</label>
            <input id="claseMuestraEl" name="claseMuestraEl" type="date"
                   defaultValue={claseMuestraEl ?? ""} className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claseMuestraHora" className={etiqueta}>Hora</label>
            <input id="claseMuestraHora" name="claseMuestraHora" type="time"
                   defaultValue={claseMuestraHora ?? ""} className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="claseMuestraAsistio" className={etiqueta}>¿Asistió?</label>
            <select id="claseMuestraAsistio" name="claseMuestraAsistio" defaultValue="" className={campo}>
              <option value="">Todavía no pasa</option>
              <option value="si">Sí llegó</option>
              <option value="no">No llegó</option>
            </select>
          </div>
        </div>
      )}

      {destino === "perdido" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivoPerdida" className={etiqueta}>Motivo · obligatorio</label>
            <select id="motivoPerdida" name="motivoPerdida" defaultValue="" className={campo}>
              <option value="" disabled>Elige…</option>
              {MOTIVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivoDetalle" className={etiqueta}>Detalle</label>
            <input id="motivoDetalle" name="motivoDetalle" className={campo} />
          </div>
        </div>
      )}

      <div><Boton texto="Actualizar etapa" pendiente="Guardando…" secundario /></div>
    </form>
  );
}

// ------------------------------------------------------------ conversión ---

export function Convertir({ prospectoId, nombre, edad, tutores, hayContacto }: {
  prospectoId: number; nombre: string; edad: number | null;
  tutores: { id: number; nombre: string }[]; hayContacto: boolean;
}) {
  const [estado, accion] = useActionState<EstadoConversion, FormData>(convertir, {});
  const [nacimiento, setNacimiento] = useState("");

  const edadCalculada = nacimiento
    ? Math.floor((Date.now() - new Date(nacimiento).getTime()) / (365.2425 * 86_400_000))
    : edad;
  const menor = edadCalculada !== null && edadCalculada < 18;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="prospectoId" value={prospectoId} />

      {estado.error && (
        <p id="error-conversion" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fechaNacimiento" className={etiqueta}>Fecha de nacimiento</label>
          <input id="fechaNacimiento" name="fechaNacimiento" type="date" className={campo}
                 value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
          <span className="text-xs text-vs-tinta-3">
            {edadCalculada !== null
              ? `${edadCalculada} años${menor ? " · menor de edad" : ""}`
              : "Se puede completar después en el expediente."}
          </span>
        </div>

        {tutores.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tutorExistenteId" className={etiqueta}>
              ¿El tutor ya está registrado?
            </label>
            <select id="tutorExistenteId" name="tutorExistenteId" defaultValue="" className={campo}>
              <option value="">No — usar los datos del prospecto</option>
              {tutores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      {menor && !hayContacto && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Es menor de edad y el prospecto no trae a quién contactar. El expediente quedará sin
          tutor y el contrato lo exige: agrégalo arriba antes de convertir, o complétalo
          enseguida en el expediente.
        </p>
      )}

      <label htmlFor="avisoPrivacidad" className="flex items-start gap-3 text-sm">
        <input id="avisoPrivacidad" name="avisoPrivacidad" type="checkbox" required className="mt-1" />
        <span>
          <strong>Aviso de privacidad aceptado</strong> · obligatorio
          <span className="mt-0.5 block text-xs text-vs-tinta-3">
            Sin esto no hay base legal para tratar los datos de {nombre}.
          </span>
        </span>
      </label>

      <label htmlFor="usoImagen" className="flex items-start gap-3 text-sm">
        <input id="usoImagen" name="usoImagen" type="checkbox" className="mt-1" />
        <span>
          Autoriza uso de imagen
          <span className="mt-0.5 block text-xs text-vs-tinta-3">
            Opcional. El «no» se guarda igual que el «sí».
          </span>
        </span>
      </label>

      <div><Boton texto="Convertir en alumno" pendiente="Creando expediente…" /></div>
    </form>
  );
}
