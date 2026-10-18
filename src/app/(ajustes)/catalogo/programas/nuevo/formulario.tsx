"use client";

import { useActionState } from "react";

import { crearProgramaAccion, type EstadoNuevo } from "./acciones";

const campo = "mt-1 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

export function FormularioNuevoPrograma({ hoy }: { hoy: string }) {
  const [estado, accion, pending] = useActionState<EstadoNuevo, FormData>(
    crearProgramaAccion,
    {},
  );

  return (
    <form action={accion} className="space-y-6">
      {estado.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      {/* Identificación */}
      <section>
        <h2 className="font-display text-base font-semibold">Identificación</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="clave" className="block text-sm font-medium">
              Clave interna <span className="font-normal text-vs-tinta-3">(única, sin espacios)</span>
            </label>
            <input
              id="clave" name="clave" type="text" required maxLength={30}
              placeholder="ej: allegro_virtuoso"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="orden" className="block text-sm font-medium">
              Orden en la lista
            </label>
            <input
              id="orden" name="orden" type="number" min="0" defaultValue="0"
              className={campo}
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="nombre" className="block text-sm font-medium">Nombre del programa</label>
          <input
            id="nombre" name="nombre" type="text" required maxLength={80}
            placeholder="ej: Allegro Virtuoso"
            className={campo}
          />
        </div>
        <div className="mt-4">
          <label htmlFor="descripcion" className="block text-sm font-medium">Descripción breve</label>
          <textarea
            id="descripcion" name="descripcion" required maxLength={200} rows={2}
            placeholder="ej: 4 clases individuales de 45 min al mes"
            className={`${campo} resize-none`}
          />
        </div>
      </section>

      {/* Estructura del ciclo */}
      <section>
        <h2 className="font-display text-base font-semibold">Estructura del ciclo</h2>
        <p className="mt-0.5 text-xs text-vs-tinta-3">
          Estos valores definen el contrato. Solo pueden cambiarse directamente en la base de datos
          una vez creado el programa.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="clasesPorCiclo" className="block text-sm font-medium">Clases por ciclo</label>
            <input
              id="clasesPorCiclo" name="clasesPorCiclo" type="number"
              required min="1" max="31" defaultValue="4"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="minutosPorClase" className="block text-sm font-medium">Minutos por clase</label>
            <input
              id="minutosPorClase" name="minutosPorClase" type="number"
              required min="15" max="180" step="5" defaultValue="45"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="alumnosIncluidos" className="block text-sm font-medium">
              Alumnos incluidos <span className="font-normal text-vs-tinta-3">(1 = individual)</span>
            </label>
            <input
              id="alumnosIncluidos" name="alumnosIncluidos" type="number"
              required min="1" max="5" defaultValue="1"
              className={campo}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="renovable" value="0" />
            <input
              type="checkbox" name="renovable" value="1"
              defaultChecked
              className="h-4 w-4 rounded border-vs-linea accent-vs-naranja"
            />
            Renovable mensualmente
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="permitePrestamoACasa" value="0" />
            <input
              type="checkbox" name="permitePrestamoACasa" value="1"
              className="h-4 w-4 rounded border-vs-linea accent-vs-naranja"
            />
            Permite préstamo de instrumento a casa
          </label>
        </div>
      </section>

      {/* Precio inicial */}
      <section>
        <h2 className="font-display text-base font-semibold">Precio inicial</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="precioPesos" className="block text-sm font-medium">Precio mensual (pesos)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vs-tinta-3">$</span>
              <input
                id="precioPesos" name="precioPesos" type="number"
                required min="1" step="0.50"
                placeholder="0.00"
                className={`${campo} pl-7`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="vigenteDesde" className="block text-sm font-medium">Vigente desde</label>
            <input
              id="vigenteDesde" name="vigenteDesde" type="date"
              required defaultValue={hoy}
              className={campo}
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                   transition hover:bg-vs-naranja-claro disabled:opacity-50"
      >
        {pending ? "Creando programa…" : "Crear programa"}
      </button>
    </form>
  );
}
