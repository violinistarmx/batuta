"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { darDeAltaCuenta, type EstadoCuentas } from "../acciones";
import { Credencial } from "../credencial";

type Docente = { id: number; nombre: string };

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Campo({ id, label, children, ancho = "", nota }: {
  id: string; label: string; children: React.ReactNode; ancho?: string; nota?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${ancho}`}>
      <label htmlFor={id} className="text-xs font-medium text-vs-tinta-2">{label}</label>
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
      {pending ? "Creando…" : "Crear la cuenta"}
    </button>
  );
}

export function FormularioCuenta({ docentes }: { docentes: Docente[] }) {
  const [estado, accion] = useActionState<EstadoCuentas, FormData>(darDeAltaCuenta, {});
  const [rol, setRol] = useState("docente");

  // Si la cuenta ya nació, el formulario desaparece y queda la contraseña.
  // Volver a mostrarlo invitaría a crear la misma persona dos veces, y la
  // contraseña se perdería al recargar sin que nadie la hubiera anotado.
  if (estado.credencial) {
    return (
      <div className="flex flex-col gap-5">
        <Credencial c={estado.credencial} />
        <div className="flex gap-3">
          <Link href={`/usuarios/${estado.credencial.id}`}
                className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                           no-underline transition hover:bg-vs-naranja-claro">
            Ya la anoté, ver la cuenta
          </Link>
          <Link href="/usuarios/nuevo"
                className="rounded-lg border border-vs-linea px-4 py-2 text-sm font-medium
                           no-underline transition hover:border-vs-naranja-700">
            Dar de alta otra
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-5">
      {estado.error && (
        <p id="error-cuenta" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Quién es</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo id="nombre" label="Nombre completo" ancho="sm:col-span-2">
            <input id="nombre" name="nombre" required maxLength={120} className={campo}
                   placeholder="María Fernanda Ortega" />
          </Campo>
          <Campo id="email" label="Correo" ancho="sm:col-span-2"
                 nota="Es con lo que entra. No se le manda nada ahí: la contraseña se entrega aparte.">
            <input id="email" name="email" type="email" required maxLength={160}
                   className={campo} placeholder="maria@violinistar.mx" />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Hasta dónde llega</h2>
        <div className="mt-4 grid gap-4">
          <Campo id="rol" label="Rol">
            <select id="rol" name="rol" className={campo} value={rol}
                    onChange={(e) => setRol(e.target.value)}>
              <option value="docente">Maestro</option>
              <option value="asistente">Asistente</option>
              <option value="director">Director</option>
            </select>
          </Campo>

          <p id="alcance-rol" className="rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-xs">
            {rol === "docente" && (
              <>Ve <strong>sus</strong> alumnos, sus clases y su propia nómina. No ve las
              finanzas de la academia ni lo que gana otro maestro.</>
            )}
            {rol === "asistente" && (
              <>Recepción: da de alta alumnos, programa clases, registra pagos, presta
              instrumentos y atiende prospectos. No ve la nómina ni los reportes de dinero.</>
            )}
            {rol === "director" && (
              <>Ve y puede todo, incluidas las finanzas, la nómina y esta misma pantalla.
              Dáselo solo a quien administra la academia.</>
            )}
          </p>

          {rol === "docente" && (
            <Campo id="docenteId" label="Ficha de maestro"
                   nota="Si ya daba clase antes de tener acceso, líguala: así su historial y su nómina siguen siendo suyos en vez de partirse en dos.">
              <select id="docenteId" name="docenteId" className={campo} defaultValue="">
                <option value="">Crear una ficha nueva</option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </section>

      <div><Guardar /></div>
    </form>
  );
}
