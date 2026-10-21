import Link from "next/link";

import type { RenovacionPendiente } from "@/lib/datos/tablero";

/**
 * Los alumnos que ya deben renovar, arriba de los pendientes para que no se pierdan entre adeudos.
 * Solo se muestra a dirección y administración (quien llama decide con el permiso).
 */
export function TarjetaRenovaciones({ filas }: { filas: RenovacionPendiente[] }) {
  if (filas.length === 0) return null;
  const ahora = filas.filter((f) => f.nivel === "ahora").length;
  const top = filas.slice(0, 6);
  return (
    <section aria-labelledby="titulo-renovaciones" className="mt-8 rounded-xl border border-vs-naranja/40 bg-vs-crema p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="titulo-renovaciones" className="font-display text-lg font-semibold">
          Por renovar
          <span className="ml-2 text-sm font-normal text-vs-tinta-3">({filas.length})</span>
        </h2>
        <p className="text-xs text-vs-tinta-2">
          {ahora > 0 && <span className="font-semibold text-red-800">{ahora} sin clases · </span>}
          <Link href="/renovaciones" className="font-medium underline">ver todos</Link>
        </p>
      </div>
      <ul className="mt-3 divide-y divide-vs-linea rounded-lg border border-vs-linea bg-white">
        {top.map((f) => (
          <li key={f.inscripcionId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{f.alumno}</span>
              <span className="text-vs-tinta-3"> · {f.programa}</span>
            </span>
            <span className={f.nivel === "ahora" ? "font-semibold text-red-800" : "text-vs-tinta-2"}>
              {f.nivel === "ahora" ? "Renovar ya" : `Quedan ${f.restantes} clase${f.restantes === 1 ? "" : "s"}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
