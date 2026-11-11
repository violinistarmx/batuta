"use client";

import { useTransition } from "react";

import type { Tema } from "@/lib/tema";
import { cambiarTemaAccion } from "./acciones";

type Opcion = { valor: Tema; nombre: string; descripcion: string; fondo: string };

/** Dos tarjetas con la vista previa de cada tema. Elegir una lo aplica de inmediato. */
export function SelectorTema({ actual, temas }: { actual: Tema; temas: Opcion[] }) {
  const [pendiente, empezar] = useTransition();
  return (
    <div role="radiogroup" aria-label="Tema" className="mt-6 grid gap-4 sm:grid-cols-2">
      {temas.map((t) => {
        const activo = t.valor === actual;
        return (
          <button
            key={t.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={pendiente}
            onClick={() => empezar(() => cambiarTemaAccion(t.valor))}
            className={`overflow-hidden rounded-2xl border bg-white text-left transition
                        ${activo ? "border-vs-naranja ring-2 ring-vs-naranja" : "border-vs-linea hover:border-vs-naranja-700"}`}
          >
            <span
              aria-hidden="true"
              className="block h-36 bg-cover bg-center"
              style={{ backgroundImage: `url(/fondo/${t.fondo}.jpg)` }}
            />
            <span className="block p-4">
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-semibold">{t.nombre}</span>
                {activo && <span className="rounded-full bg-vs-amarillo px-2 py-0.5 text-[11px] font-semibold text-vs-tinta">En uso</span>}
              </span>
              <span className="mt-1 block text-sm text-vs-tinta-3">{t.descripcion}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
