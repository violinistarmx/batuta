import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { cobranzaGlobal, resultadoAdministrativo } from "@/lib/datos/finanzas";
import { adeudoDe, resumirCobranza } from "@/lib/dominio/cobranza";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

export default async function Finanzas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const sesion = await exigirPermiso("finanzas.leer");
  const { desde, hasta } = await searchParams;

  const hoy = hoyEnMexico();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const d = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : inicioMes;
  const h = hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : hoy;

  const res = resultadoAdministrativo(d, h);
  const cargos = cobranzaGlobal();
  const resumen = resumirCobranza(cargos, hoy);
  const conAdeudo = cargos
    .filter((c) => adeudoDe(c) > 0)
    .sort((a, b) => (a.venceEl < b.venceEl ? -1 : 1));

  const tarjetas = [
    { t: "Ingresos del periodo", v: res.ingresosCentavos, n: "Pagos recibidos" },
    { t: "Nómina pagada", v: -res.nominaPagadaCentavos, n: "Cortes cerrados" },
    { t: "Nómina por pagar", v: -res.nominaPendienteCentavos, n: "Clases impartidas sin corte" },
    { t: "Gastos", v: -res.gastosCentavos, n: "Registrados en el periodo" },
  ];

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Finanzas</h1>
            <p className="mt-1 text-sm text-vs-tinta-3">Del {d} al {h}</p>
          </div>
          <form method="get" className="flex items-end gap-2 text-sm">
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
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map((x) => (
            <div key={x.t} className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{x.t}</dt>
              <dd className={`mt-1 font-display text-2xl font-semibold tabular-nums ${
                x.v < 0 ? "text-vs-naranja-700" : ""
              }`}>
                {pesos(Math.abs(x.v))}
              </dd>
              <dd className="mt-0.5 text-[11px] text-vs-tinta-3">{x.n}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Resultado administrativo</h2>
          <p id="resultado-admin" className="mt-2 font-display text-4xl font-semibold tabular-nums">
            {pesos(res.resultadoCentavos)}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-vs-tinta-2">
            Ingresos menos nómina —pagada y devengada— menos gastos registrados.
            <strong> No es utilidad contable formal</strong>: mientras no exista contabilidad
            fiscal integrada, es un indicador administrativo.
          </p>
          <p className="mt-1 text-xs text-vs-tinta-3">
            Incluye la nómina ya impartida aunque todavía no se haya pagado. Sin eso, el
            resultado se vería inflado hasta hacer el corte.
          </p>
        </section>

        <section className="mt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Por cobrar</h2>
            <Link href="/finanzas/nomina" className="text-sm no-underline hover:underline">
              Ir a nómina docente →
            </Link>
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Total por cobrar</dt>
              <dd id="por-cobrar" className="font-medium tabular-nums">{pesos(resumen.porCobrarCentavos)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Vencido</dt>
              <dd id="vencido" className={`font-medium tabular-nums ${resumen.vencidoCentavos > 0 ? "text-vs-naranja-700" : ""}`}>
                {pesos(resumen.vencidoCentavos)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Cobrado</dt>
              <dd id="cobrado" className="font-medium tabular-nums">{pesos(resumen.cobradoCentavos)}</dd>
            </div>
          </dl>

          {conAdeudo.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Nadie debe nada. 🎶
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Alumno</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Concepto</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Vence</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Cargo</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Adeudo</th>
                  </tr>
                </thead>
                <tbody>
                  {conAdeudo.map((c) => {
                    const vencido = c.venceEl < hoy;
                    return (
                      <tr key={c.cargoId} className="border-t border-vs-linea">
                        <td className="px-4 py-2.5">
                          <Link href={`/alumnos/${c.alumnoId}`} className="font-medium no-underline hover:underline">
                            {c.alumno}
                          </Link>
                          <span className="ml-2 font-mono text-[11px] text-vs-tinta-3">{c.codigo}</span>
                        </td>
                        <td className="px-4 py-2.5 text-vs-tinta-2">{c.descripcion}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {c.venceEl}
                          {vencido && (
                            <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                              vencido
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-3">
                          {pesos(c.montoCentavos)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {pesos(adeudoDe(c))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
