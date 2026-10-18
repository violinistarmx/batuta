import Link from "next/link";

import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { egresosNominaDelPeriodo } from "@/lib/datos/finanzas";
import { dashboardFinanzas, metasFinanzas } from "@/lib/datos/finanzas-dashboard";
import { disenoDe } from "@/lib/datos/paneles";
import { limitesDeMes } from "@/lib/finanzas/fechas";
import { escribirSeleccion, leerSeleccion, type Busqueda } from "@/lib/finanzas/parametros";
import { pesosExactos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";
import { Tablero } from "./tablero/tablero";

export const dynamic = "force-dynamic";

/**
 * Dashboard de finanzas. Solo dirección (`finanzas.leer`): ni maestros ni
 * asistentes lo ven en el menú ni por URL. Periodo, comparación y filtros viven
 * en la URL; el reporte PDF usa exactamente la misma selección.
 */
export default async function Finanzas({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sesion = await exigirPermiso("finanzas.leer");
  const hoy = hoyEnMexico();
  const seleccion = leerSeleccion(await searchParams, hoy);

  const d = dashboardFinanzas(seleccion, hoy);
  const diseno = disenoDe(sesion.usuarioId);
  const metas = metasFinanzas();

  const [desde, hasta] = seleccion.periodo.modo === "mes"
    ? limitesDeMes(seleccion.periodo.mes)
    : [`${seleccion.periodo.anio}-01-01`, `${seleccion.periodo.anio}-12-31`];
  const puedeNomina = tienePermiso(sesion, "nomina.leer");
  const pagosDocentes = puedeNomina ? egresosNominaDelPeriodo(desde, hasta) : [];
  const query = escribirSeleccion(seleccion);

  return (
    <>
      <main className="mx-auto max-w-[1400px] px-3 py-5 sm:px-5 sm:py-7">
        <Tablero
          d={d}
          seleccion={seleccion}
          disenoInicial={diseno}
          retencionMeta={metas.retencionMin}
          enlacePdf={`/finanzas/reporte?${query}`}
          enlaceCsv={`/finanzas/exportar/flujo?desde=${desde}&hasta=${hasta}`}
        />

        {puedeNomina && (
          <section className="mt-6 rounded-2xl border border-vs-linea bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Pagos a docentes · {d.periodo.etiqueta}</h2>
              <Link href="/finanzas/nomina" className="text-sm no-underline hover:underline">Ir a nómina docente →</Link>
            </div>
            {pagosDocentes.length === 0 ? (
              <p className="mt-3 text-sm text-vs-tinta-3">Sin pagos a docentes en el periodo.</p>
            ) : (
              <ul className="mt-3 divide-y divide-vs-linea text-sm">
                {pagosDocentes.map((e) => (
                  <li key={`${e.nominaId}-${e.programaId}`} className="flex items-center justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{e.concepto}</p>
                      <p className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{e.pagadoEl} · {e.clases} clase(s)</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{pesosExactos(e.totalCentavos)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  );
}
