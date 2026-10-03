import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { listarAlumnos } from "@/lib/datos/alumnos";
import { edad } from "@/lib/formato";

export const dynamic = "force-dynamic";

// En Next 16 `searchParams` es una promesa: el acceso síncrono se eliminó.
export default async function Alumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sesion = await exigirPermiso("alumnos.leer");
  const { q } = await searchParams;

  const alcance = alcanceDe(sesion);
  const lista = listarAlumnos(alcance, q);
  const puedeCrear = tienePermiso(sesion, "alumnos.crear");

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Alumnos</h1>
            <p className="mt-1 text-sm text-vs-tinta-3">
              {lista.length === 0 && !q
                ? "Todavía no hay alumnos registrados."
                : `${lista.length} ${lista.length === 1 ? "alumno" : "alumnos"}`}
              {alcance.tipo === "propio" && " asignados a ti"}
            </p>
          </div>

          {puedeCrear && (
            <Link
              href="/alumnos/nuevo"
              className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                         no-underline transition hover:bg-vs-naranja-claro
                         focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-vs-naranja-700"
            >
              Nueva inscripción
            </Link>
          )}
        </div>

        <form method="get" className="mt-6 flex gap-2">
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nombre, folio, teléfono o tutor…"
            className="w-full max-w-md rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm
                       focus-visible:outline-2 focus-visible:outline-offset-1
                       focus-visible:outline-vs-naranja-700"
          />
          <button
            type="submit"
            className="rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm font-medium
                       transition hover:border-vs-naranja-700 hover:text-vs-naranja-700"
          >
            Buscar
          </button>
          {q && (
            <Link href="/alumnos" className="self-center text-xs text-vs-tinta-3 no-underline hover:underline">
              Limpiar
            </Link>
          )}
        </form>

        {lista.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-vs-linea bg-white p-10 text-center">
            <p className="text-sm text-vs-tinta-2">
              {q
                ? `Ningún alumno coincide con «${q}».`
                : "Cuando des de alta al primer alumno, aparecerá aquí."}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-vs-linea bg-white">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  <th className="px-4 py-2.5 text-left font-semibold">Folio</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Alumno</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Edad</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Tutor</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Teléfono</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="border-t border-vs-linea hover:bg-vs-crema/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-vs-tinta-3">{a.codigo}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/alumnos/${a.id}`} className="font-medium no-underline hover:underline">
                        {a.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-2">
                      {a.fechaNacimiento ? edad(a.fechaNacimiento) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-vs-tinta-2">{a.tutor ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-vs-tinta-2">{a.telefono ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          a.estado === "activo"
                            ? "bg-green-50 text-green-800"
                            : "bg-vs-crema text-vs-tinta-3"
                        }`}
                      >
                        {a.estado === "activo" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
