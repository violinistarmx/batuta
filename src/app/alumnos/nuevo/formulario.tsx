"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { darDeAlta, type EstadoAlta } from "./acciones";

type TutorDelPadron = {
  id: number; nombre: string; telefono: string | null; alumnos: string | null;
};

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                 transition hover:bg-vs-naranja-claro focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700
                 disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Dar de alta"}
    </button>
  );
}

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

function Campo({ id, label, children, ancho = "" }: {
  id: string; label: string; children: React.ReactNode; ancho?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${ancho}`}>
      <label htmlFor={id} className={etiqueta}>{label}</label>
      {children}
    </div>
  );
}

function Seccion({ titulo, nota, children }: {
  titulo: string; nota?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-vs-linea bg-white p-5">
      <h2 className="font-display text-lg font-semibold">{titulo}</h2>
      {nota && <p className="mt-1 text-xs text-vs-tinta-3">{nota}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormularioAlta({ tutores }: { tutores: TutorDelPadron[] }) {
  const [estado, accion] = useActionState<EstadoAlta, FormData>(darDeAlta, {});
  const [nacimiento, setNacimiento] = useState("");
  const [tutorExistente, setTutorExistente] = useState("");
  const delPadron = tutorExistente !== "";

  // Se calcula en el navegador solo para mostrar el aviso; el servidor lo vuelve
  // a verificar antes de guardar.
  const edad = nacimiento ? Math.floor(
    (Date.now() - new Date(nacimiento).getTime()) / (365.2425 * 86_400_000),
  ) : null;
  const menor = edad !== null && edad < 18;

  return (
    <form action={accion} className="flex flex-col gap-5">
      {estado.error && (
        <p
          id="error-alta"
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </p>
      )}

      <Seccion titulo="Datos del alumno">
        <Campo id="nombre" label="Nombre completo" ancho="sm:col-span-2">
          <input id="nombre" name="nombre" required className={campo} />
        </Campo>
        <Campo id="fechaNacimiento" label="Fecha de nacimiento">
          <input
            id="fechaNacimiento" name="fechaNacimiento" type="date" className={campo}
            value={nacimiento} onChange={(e) => setNacimiento(e.target.value)}
          />
          {edad !== null && (
            <span className="text-xs text-vs-tinta-3">
              {edad} años {menor && "· menor de edad"}
            </span>
          )}
        </Campo>
        <Campo id="sexo" label="Sexo">
          <select id="sexo" name="sexo" className={campo} defaultValue="">
            <option value="">Sin especificar</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>
        <Campo id="telefono" label="Teléfono">
          <input id="telefono" name="telefono" type="tel" className={campo} />
        </Campo>
        <Campo id="email" label="Correo electrónico">
          <input id="email" name="email" type="email" className={campo} />
        </Campo>
        <Campo id="direccion" label="Dirección">
          <input id="direccion" name="direccion" className={campo} />
        </Campo>
        <Campo id="colonia" label="Colonia">
          <input id="colonia" name="colonia" className={campo} />
        </Campo>
      </Seccion>

      <Seccion
        titulo={menor ? "Padre, madre o tutor · obligatorio" : "Padre, madre o tutor"}
        nota={
          menor
            ? "El alumno es menor de edad: el contrato lo hace responsable del expediente y del pago."
            : "Opcional para alumnos mayores de edad."
        }
      >
        {tutores.length > 0 && (
          <Campo id="tutorExistenteId" label="¿Ya está registrado?" ancho="sm:col-span-2">
            <select
              id="tutorExistenteId" name="tutorExistenteId" className={campo}
              value={tutorExistente} onChange={(e) => setTutorExistente(e.target.value)}
            >
              <option value="">No — es un tutor nuevo</option>
              {tutores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {t.alumnos ? ` · ${t.alumnos}` : ""}
                </option>
              ))}
            </select>
            <span className="text-xs text-vs-tinta-3">
              Elegirlo aquí vincula al mismo tutor en vez de crear una copia. Es lo que
              permite compartir un plan familiar entre hermanos.
            </span>
          </Campo>
        )}

        {!delPadron && (
          <>
            <Campo id="tutorNombre" label="Nombre completo" ancho="sm:col-span-2">
              <input id="tutorNombre" name="tutorNombre" required={menor} className={campo} />
            </Campo>
            <Campo id="tutorTelefono" label="Teléfono">
              <input id="tutorTelefono" name="tutorTelefono" type="tel" className={campo} />
            </Campo>
            <Campo id="tutorWhatsapp" label="WhatsApp">
              <input id="tutorWhatsapp" name="tutorWhatsapp" type="tel" placeholder="Si es distinto al teléfono" className={campo} />
            </Campo>
            <Campo id="tutorEmail" label="Correo electrónico">
              <input id="tutorEmail" name="tutorEmail" type="email" className={campo} />
            </Campo>
          </>
        )}

        {/* El parentesco es de esta relación, no del tutor: la misma persona puede
            ser madre de uno y tía de otro. Se pide siempre. */}
        <Campo id="tutorParentesco" label="Parentesco con este alumno">
          <input id="tutorParentesco" name="tutorParentesco" placeholder="Madre, padre, abuela…" className={campo} />
        </Campo>
      </Seccion>

      <Seccion
        titulo="Consideraciones de salud y aprendizaje"
        nota="Información sensible: se guarda cifrada, con permiso propio, y no aparece en listados ni reportes. Deja en blanco lo que no aplique."
      >
        <Campo id="condicionSalud" label="Condición de salud relevante" ancho="sm:col-span-2">
          <input id="condicionSalud" name="condicionSalud" placeholder="Respiratoria, cardiaca, otra…" className={campo} />
        </Campo>
        <Campo id="trastornoAprendizaje" label="Trastorno de aprendizaje o neurodesarrollo">
          <input id="trastornoAprendizaje" name="trastornoAprendizaje" placeholder="TDAH, TEA, dislexia…" className={campo} />
        </Campo>
        <Campo id="discapacidadSensorial" label="Discapacidad auditiva o visual">
          <input id="discapacidadSensorial" name="discapacidadSensorial" className={campo} />
        </Campo>
        <Campo id="medicamentos" label="Medicamentos que afecten la concentración">
          <input id="medicamentos" name="medicamentos" className={campo} />
        </Campo>
        <Campo id="consideracionEmocional" label="Consideración emocional para el maestro">
          <input id="consideracionEmocional" name="consideracionEmocional" className={campo} />
        </Campo>
        <Campo id="saludObservaciones" label="Observaciones adicionales" ancho="sm:col-span-2">
          <textarea id="saludObservaciones" name="saludObservaciones" rows={2} className={campo} />
        </Campo>
      </Seccion>

      <Seccion titulo="Objetivo y experiencia">
        <Campo id="objetivoMusical" label="Objetivo musical" ancho="sm:col-span-2">
          <input id="objetivoMusical" name="objetivoMusical" placeholder="¿Qué quiere lograr?" className={campo} />
        </Campo>
        <Campo id="experienciaPrevia" label="Experiencia previa" ancho="sm:col-span-2">
          <input id="experienciaPrevia" name="experienciaPrevia" className={campo} />
        </Campo>
        <Campo id="observaciones" label="Observaciones" ancho="sm:col-span-2">
          <textarea id="observaciones" name="observaciones" rows={2} className={campo} />
        </Campo>
      </Seccion>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Privacidad y consentimientos</h2>
        <div className="mt-4 flex flex-col gap-3">
          <label htmlFor="avisoPrivacidad" className="flex gap-3 text-sm">
            <input id="avisoPrivacidad" name="avisoPrivacidad" type="checkbox" className="mt-0.5" />
            <span>
              <strong>Se dio a conocer el aviso de privacidad.</strong>
              <span className="mt-0.5 block text-xs text-vs-tinta-3">
                Obligatorio. Sin esto no hay base legal para tratar los datos del alumno.
              </span>
            </span>
          </label>

          <label htmlFor="usoImagen" className="flex gap-3 text-sm">
            <input id="usoImagen" name="usoImagen" type="checkbox" className="mt-0.5" />
            <span>
              <strong>Autoriza el uso de imagen, voz y nombre.</strong>
              <span className="mt-0.5 block text-xs text-vs-tinta-3">
                Demo Videos, material educativo, redes sociales y contenido comunitario.
                Si no lo autoriza, déjalo sin marcar: el sistema excluirá al alumno de
                cualquier publicación.
              </span>
            </span>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <Guardar />
        <p className="text-xs text-vs-tinta-3">
          La inscripción es gratuita. Se generará el folio, el código QR y la credencial
          a entregar en siete días.
        </p>
      </div>
    </form>
  );
}
