import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { listarEjemplares, prestamosVigentes } from "@/lib/datos/inventario";
import {
  NOMBRE_CONDICION, NOMBRE_ESTADO, estadoDeDevolucion, resumir,
  type Condicion, type EstadoEjemplar,
} from "@/lib/dominio/inventario";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

const COLOR_ESTADO: Record<EstadoEjemplar, string> = {
  disponible: "bg-green-100 text-green-900",
  prestado: "bg-vs-amarillo-suave text-vs-tinta",
  en_reparacion: "bg-amber-100 text-amber-900",
  baja: "bg-red-100 text-red-800",
};

export default async function Inventario() {
  const sesion = await exigirPermiso("inventario.gestionar");
  const hoy = hoyEnMexico();

  const lista = listarEjemplares();
  const r = resumir(lista);
  const vigentes = prestamosVigentes();
  const fuera = vigentes.filter((p) => estadoDeDevolucion(p.terminaEl, hoy) !== "vigente");

  const tarjetas = [
    { t: "Ejemplares", v: r.total, n: "En el inventario" },
    { t: "Disponibles", v: r.disponibles, n: "Listos para prestar" },
    { t: "Prestados", v: r.prestados, n: "Fuera de la academia" },
    { t: "En reparación", v: r.enReparacion, n: "No se pueden prestar" },
  ];

  return (
    <>
      <Encabezado sesion={sesion} activo="inventario" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Inventario</h1>
            <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
              Los instrumentos que la academia presta. Cláusula 9ª: los de gran formato no
              salen de las instalaciones, y solo Allegro Virtuoso autoriza llevárselo a casa.
            </p>
          </div>
          <Link
            href="/inventario/nuevo"
            className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                       no-underline transition hover:bg-vs-naranja-claro"
          >
            Dar de alta un ejemplar
          </Link>
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map((x) => (
            <div key={x.t} className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{x.t}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.v}</dd>
              <dd className="mt-0.5 text-[11px] text-vs-tinta-3">{x.n}</dd>
            </div>
          ))}
        </dl>

        {fuera.length > 0 && (
          <section id="por-devolver" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-lg font-semibold">Por devolver</h2>
            <p className="mt-1 text-sm text-amber-900">
              El préstamo dura lo que dura el período. Estos ya llegaron a su fin.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {fuera.map((p) => {
                const est = estadoDeDevolucion(p.terminaEl, hoy);
                return (
                  <li key={p.id}>
                    <Link href={`/inventario/${p.ejemplarId}`}
                          className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-amber-300
                                     bg-white px-4 py-2.5 no-underline transition hover:border-vs-naranja-700">
                      <span className="font-mono text-xs text-vs-tinta-3">{p.codigo}</span>
                      <span className="font-medium">{p.instrumento}</span>
                      <span className="text-sm text-vs-tinta-2">{p.alumno}</span>
                      <span className="ml-auto text-sm">
                        {est === "vencido"
                          ? `El período terminó el ${p.terminaEl}`
                          : `El período termina el ${p.terminaEl}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">Ejemplares</h2>
          {lista.length === 0 ? (
            <p id="sin-ejemplares"
               className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Todavía no hay ejemplares registrados.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table id="tabla-ejemplares" className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Folio</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Instrumento</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Detalle</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Condición</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Quién lo tiene</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((e) => (
                    <tr key={e.id} data-ejemplar={e.id} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5">
                        <Link href={`/inventario/${e.id}`}
                              className="font-mono text-xs no-underline hover:underline">
                          {e.codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {e.instrumento}
                        {e.granFormato && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-vs-naranja-700">
                            gran formato
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">
                        {[e.marca, e.modelo, e.medida].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${COLOR_ESTADO[e.estado]}`}>
                          {NOMBRE_ESTADO[e.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">
                        {NOMBRE_CONDICION[e.condicion as Condicion]}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.prestadoA ? (
                          <Link href={`/alumnos/${e.prestadoAId}`} className="no-underline hover:underline">
                            {e.prestadoA}
                          </Link>
                        ) : (
                          <span className="text-vs-tinta-3">{e.ubicacion ?? "En la academia"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
