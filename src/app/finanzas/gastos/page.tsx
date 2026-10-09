import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { ETIQUETA_CATEGORIA, gastosPorCategoria, gastosDelPeriodo } from "@/lib/datos/gastos";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const sesion = await exigirPermiso("gastos.gestionar");
  const { desde, hasta } = await searchParams;

  const hoy = hoyEnMexico();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const d = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : inicioMes;
  const h = hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : hoy;

  const lista = gastosDelPeriodo(d, h);
  const porCategoria = gastosPorCategoria(d, h);
  const totalCentavos = lista.reduce((s: number, g: { montoCentavos: number }) => s + g.montoCentavos, 0);

  const anioActual = Number(hoy.slice(0, 4));
  const mesActual = Number(hoy.slice(5, 7));
  const nombresMes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mesesRapidos = Array.from({ length: mesActual }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    const ultimoDia = new Date(anioActual, i + 1, 0).getDate();
    return {
      etiqueta: nombresMes[i],
      desde: `${anioActual}-${m}-01`,
      hasta: `${anioActual}-${m}-${String(ultimoDia).padStart(2, "0")}`,
    };
  });

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-5xl px-5 py-8">

        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
              <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
              {" "}›{" "}Gastos
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Gastos</h1>
            <p className="mt-1 text-sm text-vs-tinta-3">Del {d} al {h}</p>
          </div>
          <Link
            href="/finanzas/gastos/nuevo"
            className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta no-underline
                       transition hover:bg-vs-naranja-700 hover:text-white
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
          >
            + Nuevo gasto
          </Link>
        </div>

        {/* Filtro de fechas */}
        <form method="get" className="mt-4 flex flex-wrap items-end gap-2 text-sm">
          <label htmlFor="desde" className="sr-only">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={d}
                 className="rounded-lg border border-vs-linea bg-white px-3 py-1.5" />
          <label htmlFor="hasta" className="sr-only">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={h}
                 className="rounded-lg border border-vs-linea bg-white px-3 py-1.5" />
          <button type="submit"
                  className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 font-medium">
            Ver
          </button>
        </form>

        {/* Acceso rápido por mes */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mesesRapidos.map((m) => {
            const activo = d === m.desde && h === m.hasta;
            return (
              <a
                key={m.etiqueta}
                href={`/finanzas/gastos?desde=${m.desde}&hasta=${m.hasta}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  activo
                    ? "bg-vs-naranja text-vs-tinta"
                    : "border border-vs-linea bg-white text-vs-tinta-2 hover:border-vs-naranja hover:text-vs-tinta"
                }`}
              >
                {m.etiqueta}
              </a>
            );
          })}
        </div>

        {/* Resumen por categoría */}
        {porCategoria.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display text-lg font-semibold">Por categoría</h2>
            <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-2 lg:grid-cols-3">
              {porCategoria.map((c) => (
                <div key={c.categoria} className="bg-white px-4 py-3.5">
                  <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    {ETIQUETA_CATEGORIA[c.categoria]}
                  </dt>
                  <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
                    {pesos(c.totalCentavos)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Tabla de gastos */}
        <section className="mt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">
              Detalle
              {lista.length > 0 && (
                <span className="ml-2 text-vs-tinta-3">({lista.length})</span>
              )}
            </h2>
            {totalCentavos > 0 && (
              <p className="text-sm font-semibold tabular-nums">
                Total: {pesos(totalCentavos)}
              </p>
            )}
          </div>

          {lista.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Sin gastos registrados en este periodo.{" "}
              <Link href="/finanzas/gastos/nuevo" className="font-medium text-vs-naranja-700 no-underline hover:underline">
                Registrar el primero →
              </Link>
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Categoría</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Concepto</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Registrado por</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Monto</th>
                    <th className="px-4 py-2.5 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((g) => (
                    <tr key={g.id} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 tabular-nums text-vs-tinta-2">{g.fecha}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-vs-crema px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-vs-tinta-2">
                          {ETIQUETA_CATEGORIA[g.categoria as keyof typeof ETIQUETA_CATEGORIA] ?? g.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{g.concepto}</td>
                      <td className="px-4 py-2.5 text-vs-tinta-3">{g.registradoPor ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {pesos(g.montoCentavos)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/finanzas/gastos/editar?id=${g.id}`}
                          className="text-xs text-vs-tinta-3 no-underline hover:text-vs-naranja-700 hover:underline"
                        >
                          Editar
                        </Link>
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
