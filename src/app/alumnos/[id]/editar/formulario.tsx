"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { editarAlumnoAccion, type EstadoEdicion } from "./acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

type Tutor = {
  id: number; nombre: string; parentesco: string | null;
  telefono: string | null; whatsapp: string | null; email: string | null;
};

type Alumno = {
  id: number; nombre: string; fechaNacimiento: string | null; sexo: string | null;
  telefono: string | null; email: string | null; direccion: string | null; colonia: string | null;
  objetivoMusical: string | null; experienciaPrevia: string | null; observaciones: string | null;
};

type Salud = {
  condicionSalud: string | null; trastornoAprendizaje: string | null;
  discapacidadSensorial: string | null; medicamentos: string | null;
  consideracionEmocional: string | null; observaciones: string | null;
} | null;

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
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

export function FormularioEdicion({
  alumno, tutores, salud, puedeEditarSalud,
}: {
  alumno: Alumno;
  tutores: Tutor[];
  salud: Salud;
  puedeEditarSalud: boolean;
}) {
  const [estado, accion] = useActionState<EstadoEdicion, FormData>(editarAlumnoAccion, {});

  return (
    <form action={accion} className="flex flex-col gap-6">
      <input type="hidden" name="alumnoId" value={alumno.id} />

      {estado.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <Seccion titulo="Datos del alumno">
        <Campo id="nombre" label="Nombre completo" ancho="sm:col-span-2">
          <input id="nombre" name="nombre" required defaultValue={alumno.nombre} className={campo} />
        </Campo>
        <Campo id="fechaNacimiento" label="Fecha de nacimiento">
          <input id="fechaNacimiento" name="fechaNacimiento" type="date"
                 defaultValue={alumno.fechaNacimiento ?? ""} className={campo} />
        </Campo>
        <Campo id="sexo" label="Sexo">
          <select id="sexo" name="sexo" defaultValue={alumno.sexo ?? ""} className={campo}>
            <option value="">Sin especificar</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="otro">Otro</option>
            <option value="no_especifica">Prefiere no decirlo</option>
          </select>
        </Campo>
        <Campo id="telefono" label="Teléfono">
          <input id="telefono" name="telefono" type="tel" defaultValue={alumno.telefono ?? ""} className={campo} />
        </Campo>
        <Campo id="email" label="Correo electrónico">
          <input id="email" name="email" type="email" defaultValue={alumno.email ?? ""} className={campo} />
        </Campo>
        <Campo id="direccion" label="Dirección" ancho="sm:col-span-2">
          <input id="direccion" name="direccion" defaultValue={alumno.direccion ?? ""} className={campo} />
        </Campo>
        <Campo id="colonia" label="Colonia">
          <input id="colonia" name="colonia" defaultValue={alumno.colonia ?? ""} className={campo} />
        </Campo>
      </Seccion>

      <Seccion titulo="Objetivo y experiencia">
        <Campo id="objetivoMusical" label="Objetivo musical" ancho="sm:col-span-2">
          <input id="objetivoMusical" name="objetivoMusical" defaultValue={alumno.objetivoMusical ?? ""} className={campo} />
        </Campo>
        <Campo id="experienciaPrevia" label="Experiencia previa" ancho="sm:col-span-2">
          <input id="experienciaPrevia" name="experienciaPrevia" defaultValue={alumno.experienciaPrevia ?? ""} className={campo} />
        </Campo>
        <Campo id="observaciones" label="Observaciones" ancho="sm:col-span-2">
          <textarea id="observaciones" name="observaciones" rows={2} defaultValue={alumno.observaciones ?? ""} className={campo} />
        </Campo>
      </Seccion>

      <Seccion
        titulo="Padre, madre o tutor"
        nota="Los datos del tutor se comparten con todos sus alumnos (por ejemplo, hermanos). El parentesco se guarda solo para este alumno."
      >
        {tutores.length === 0 && (
          <p className="text-sm text-vs-tinta-3 sm:col-span-2">Este alumno no tiene tutor vinculado todavía.</p>
        )}
        {tutores.map((t) => (
          <fieldset key={t.id} className="grid gap-4 rounded-lg border border-vs-linea p-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold text-vs-tinta-2">{t.nombre}</legend>
            <Campo id={`tutor_${t.id}_nombre`} label="Nombre completo" ancho="sm:col-span-2">
              <input id={`tutor_${t.id}_nombre`} name={`tutor_${t.id}_nombre`} required
                     defaultValue={t.nombre} className={campo} />
            </Campo>
            <Campo id={`tutor_${t.id}_parentesco`} label="Parentesco con este alumno">
              <input id={`tutor_${t.id}_parentesco`} name={`tutor_${t.id}_parentesco`}
                     defaultValue={t.parentesco ?? ""} placeholder="Madre, padre, abuela…" className={campo} />
            </Campo>
            <Campo id={`tutor_${t.id}_telefono`} label="Teléfono">
              <input id={`tutor_${t.id}_telefono`} name={`tutor_${t.id}_telefono`} type="tel"
                     defaultValue={t.telefono ?? ""} className={campo} />
            </Campo>
            <Campo id={`tutor_${t.id}_whatsapp`} label="WhatsApp">
              <input id={`tutor_${t.id}_whatsapp`} name={`tutor_${t.id}_whatsapp`} type="tel"
                     defaultValue={t.whatsapp ?? ""} className={campo} />
            </Campo>
            <Campo id={`tutor_${t.id}_email`} label="Correo electrónico">
              <input id={`tutor_${t.id}_email`} name={`tutor_${t.id}_email`} type="email"
                     defaultValue={t.email ?? ""} className={campo} />
            </Campo>
          </fieldset>
        ))}

        <fieldset className="grid gap-4 rounded-lg border border-dashed border-vs-linea p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold text-vs-tinta-2">Agregar otro tutor (opcional)</legend>
          <Campo id="nuevoNombre" label="Nombre completo" ancho="sm:col-span-2">
            <input id="nuevoNombre" name="nuevoNombre" className={campo} />
          </Campo>
          <Campo id="nuevoParentesco" label="Parentesco con este alumno">
            <input id="nuevoParentesco" name="nuevoParentesco" placeholder="Madre, padre, abuela…" className={campo} />
          </Campo>
          <Campo id="nuevoTelefono" label="Teléfono">
            <input id="nuevoTelefono" name="nuevoTelefono" type="tel" className={campo} />
          </Campo>
          <Campo id="nuevoWhatsapp" label="WhatsApp">
            <input id="nuevoWhatsapp" name="nuevoWhatsapp" type="tel" className={campo} />
          </Campo>
          <Campo id="nuevoEmail" label="Correo electrónico">
            <input id="nuevoEmail" name="nuevoEmail" type="email" className={campo} />
          </Campo>
        </fieldset>
      </Seccion>

      {puedeEditarSalud ? (
        <Seccion titulo="Consideraciones de salud y aprendizaje" nota="Dato sensible. Cada cambio queda registrado en la bitácora.">
          <Campo id="condicionSalud" label="Condición de salud relevante" ancho="sm:col-span-2">
            <input id="condicionSalud" name="condicionSalud" defaultValue={salud?.condicionSalud ?? ""} className={campo} />
          </Campo>
          <Campo id="trastornoAprendizaje" label="Trastorno de aprendizaje o neurodesarrollo" ancho="sm:col-span-2">
            <input id="trastornoAprendizaje" name="trastornoAprendizaje" defaultValue={salud?.trastornoAprendizaje ?? ""} className={campo} />
          </Campo>
          <Campo id="discapacidadSensorial" label="Discapacidad sensorial" ancho="sm:col-span-2">
            <input id="discapacidadSensorial" name="discapacidadSensorial" defaultValue={salud?.discapacidadSensorial ?? ""} className={campo} />
          </Campo>
          <Campo id="medicamentos" label="Medicamentos" ancho="sm:col-span-2">
            <input id="medicamentos" name="medicamentos" defaultValue={salud?.medicamentos ?? ""} className={campo} />
          </Campo>
          <Campo id="consideracionEmocional" label="Consideración emocional" ancho="sm:col-span-2">
            <input id="consideracionEmocional" name="consideracionEmocional" defaultValue={salud?.consideracionEmocional ?? ""} className={campo} />
          </Campo>
          <Campo id="saludObservaciones" label="Observaciones de salud" ancho="sm:col-span-2">
            <textarea id="saludObservaciones" name="saludObservaciones" rows={2} defaultValue={salud?.observaciones ?? ""} className={campo} />
          </Campo>
        </Seccion>
      ) : (
        <p className="text-xs text-vs-tinta-3">
          La ficha de salud solo puede editarla quien tiene permiso para leerla y para capturarla.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Guardar />
        <Link href={`/alumnos/${alumno.id}`} className="text-sm text-vs-tinta-2 underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
