import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { cobranzaGlobal } from "@/lib/datos/finanzas";
import { adeudoDe, agingDeCobranza, resumirCobranza } from "@/lib/dominio/cobranza";
import { pesosExactos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

/**
 * Cobranza: lo que se debe, desde cuándo y quién. Vivía en la portada de Finanzas;
 * ahora la portada es el dashboard y esta es la lista de trabajo para cobrar.
 */
export default async function Cobranza() {
  const sesion = await exigirPermiso("finanzas.leer");
  const hoy = hoyEnMexico();
  const cargos = cobranzaGlobal();
  const resumen = resumirCobranza(cargos, hoy);
  const aging = agingDeCobranza(cargos, hoy);
  const conAdeudo = cargos
    .filter((c) => adeudoDe(c) > 0)
    .sort((a, b) => (a.venceEl < b.venceEl ? -1 : 1));

  const tramos = [
    { t: "1–7 días", v: aging.dias1a7, c: "bg-amber-50 text-amber-900" },
    { t: "8–15 días", v: aging.dias8a15, c: "bg-orange-50 text-orange-900" },
    { t: "16–30 días", v: aging.dias16a30, c: "bg-red-50 text-red-900" },
    { t: "+30 días", v: aging.dias30mas, c: "bg-red-100 text-red-900" },
  ].filter((x) => x.v > 0);

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}Cobranza
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Cobranza</h1>

        <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-3">
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Por cobrar</dt>
            <dd id="por-cobrar" className="mt-1 font-display text-2xl font-semibold tabular-nums">{pesosExactos(resumen.porCobrarCentavos)}</dd>
          </div>
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Vencido</dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{pesosExactos(resumen.vencidoCentavos)}</dd>
          </div>
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Cobrado</dt>
            <dd id="cobrado" className="mt-1 font-display text-2xl font-semibold tabular-nums">{pesosExactos(resumen.cobradoCentavos)}</dd>
          </div>
        </dl>

        {tramos.length > 0 && (
          <section className="mt-4 rounded-xl border border-vs-linea bg-white p-4">
            <h2 className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Antigüedad de cartera vencida</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tramos.map((x) => (
                <div key={x.t} className={`rounded-lg px-3 py-2 ${x.c}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider">{x.t}</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{pesosExactos(x.v)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {conAdeudo.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
            Nadie debe nada. 🎶
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-vs-linea bg-white">
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
                {conAdeudo.map((c) => (
                  <tr key={c.cargoId} className="border-t border-vs-linea">
                    <td className="px-4 py-2.5">
                      <Link href={`/alumnos/${c.alumnoId}`} className="font-medium no-underline hover:underline">{c.alumno}</Link>
                      <span className="ml-2 font-mono text-[11px] text-vs-tinta-3">{c.codigo}</span>
                    </td>
                    <td className="px-4 py-2.5 text-vs-tinta-2">{c.descripcion}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {c.venceEl}
                      {c.venceEl < hoy && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">vencido</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-3">{pesosExactos(c.montoCentavos)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{pesosExactos(adeudoDe(c))}</td>
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
