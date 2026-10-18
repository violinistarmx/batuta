import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { InsigniaPago } from "@/components/vale-entrega";
import { exigirPermiso } from "@/lib/auth/permisos";
import { conceptosPendientes, sedesActivas, valesPendientes } from "@/lib/datos/vales";
import { pesosExactos } from "@/lib/formato";

export const dynamic = "force-dynamic";

const campo = "mt-1 block rounded-lg border border-vs-linea bg-white px-2.5 py-1.5 text-sm";

/**
 * Entregas pendientes: lo que hay que preparar. Filtrable por sede y por concepto. La
 * parte de arriba resume cuántas piezas de cada cosa hay que sacar; la tabla dice a quién
 * va cada una y si ya está pagada.
 */
export default async function Entregas({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; concepto?: string }>;
}) {
  const sesion = await exigirPermiso("vales.entregar");
  const q = await searchParams;

  const sedes = sedesActivas();
  const sedeId = sedes.find((s) => String(s.id) === q.sede)?.id ?? null;
  const conceptos = conceptosPendientes();
  const concepto = conceptos.find((c) => c === q.concepto) ?? null;

  const vales = valesPendientes({ sedeId, concepto });

  const resumen = new Map<string, { total: number; listos: number }>();
  for (const v of vales) {
    const r = resumen.get(v.concepto) ?? { total: 0, listos: 0 };
    r.total += 1;
    if (v.aplicadoCentavos >= v.montoCentavos) r.listos += 1;
    resumen.set(v.concepto, r);
  }

  return (
    <>
      <Encabezado sesion={sesion} activo="entregas" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Entregas pendientes</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Productos vendidos que aún no se entregan. «Pagado» significa que ya se puede entregar; los
          demás esperan su pago.
        </p>

        <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-xs text-vs-tinta-3">
            Sede
            <select name="sede" defaultValue={sedeId ?? ""} className={campo}>
              <option value="">Todas</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <label className="text-xs text-vs-tinta-3">
            Concepto
            <select name="concepto" defaultValue={concepto ?? ""} className={`${campo} max-w-xs`}>
              <option value="">Todos</option>
              {conceptos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="submit"
                  className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm font-medium transition hover:border-vs-naranja-700 hover:text-vs-naranja-700">
            Filtrar
          </button>
          {(sedeId !== null || concepto !== null) && (
            <Link href="/entregas" className="py-1.5 text-sm text-vs-tinta-3 hover:underline">Quitar filtros</Link>
          )}
        </form>

        {vales.length === 0 ? (
          <p className="mt-8 rounded-xl border border-vs-linea bg-white px-4 py-8 text-center text-sm text-vs-tinta-3">
            No hay entregas pendientes{sedeId !== null || concepto !== null ? " con esos filtros" : ""}.
          </p>
        ) : (
          <>
            <section className="mt-6" aria-label="Para preparar">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-vs-tinta-3">Para preparar</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...resumen.entries()].map(([nombre, r]) => (
                  <li key={nombre} className="rounded-xl border border-vs-linea bg-white px-4 py-3">
                    <p className="text-sm font-medium">{nombre}</p>
                    <p className="mt-0.5 text-xs text-vs-tinta-3">
                      <span className="font-display text-xl font-semibold text-vs-tinta tabular-nums">{r.total}</span>
                      {" "}pieza{r.total === 1 ? "" : "s"} · {r.listos} lista{r.listos === 1 ? "" : "s"} para entregar
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-6 overflow-x-auto rounded-xl border border-vs-linea bg-white">
              <table className="w-full text-sm">
                <thead className="bg-vs-crema text-left text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Vale</th>
                    <th className="px-3 py-2 font-semibold">Producto</th>
                    <th className="px-3 py-2 font-semibold">Alumno</th>
                    <th className="px-3 py-2 font-semibold">Sede</th>
                    <th className="px-3 py-2 text-right font-semibold">Importe</th>
                    <th className="px-3 py-2 font-semibold">Pago</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-vs-linea">
                  {vales.map((v) => (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">{v.codigo}</td>
                      <td className="px-3 py-2">{v.concepto}</td>
                      <td className="px-3 py-2">
                        <Link href={`/alumnos/${v.alumnoId}`} className="no-underline hover:underline">{v.alumno}</Link>
                      </td>
                      <td className="px-3 py-2">{v.sede ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pesosExactos(v.montoCentavos)}</td>
                      <td className="px-3 py-2"><InsigniaPago v={v} /></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Link href={`/vales/${v.token}`} className="text-xs font-medium text-vs-naranja-700 hover:underline">
                          Abrir vale
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
