import Link from "next/link";

import { exigirPermiso } from "@/lib/auth/permisos";
import { parametrosNomina } from "@/lib/datos/costo-docente";
import { historialTarifas, tarifasActuales } from "@/lib/datos/tarifas";
import { pesosExactos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";
import { CambiarTarifa } from "./cliente";

export const dynamic = "force-dynamic";

/** Tarifas por hora de los maestros, con vigencia. Fuente única de nómina y dashboard. */
export default async function Tarifas() {
  const sesion = await exigirPermiso("nomina.leer");
  const hoy = hoyEnMexico();
  const maestros = tarifasActuales();
  const { tarifaHoraCentavos: general } = parametrosNomina();

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}Tarifas de maestros
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Tarifas de maestros</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Lo que gana cada maestro por hora impartida. Un cambio vale desde la fecha que elijas:
          las clases anteriores conservan la tarifa de su día. Sin tarifa propia, se usa la del
          programa o la general ({pesosExactos(general)} por hora,{" "}
          <Link href="/ajustes/direccion" className="underline">Ajustes</Link>).
        </p>

        <ul className="mt-6 space-y-4">
          {maestros.map((m) => {
            const historial = historialTarifas(m.id);
            return (
              <li key={m.id} className="rounded-xl border border-vs-linea bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">{m.nombre}</h2>
                  <p className="tabular-nums">
                    {m.tarifaHoraCentavos === null
                      ? <span className="text-sm text-vs-tinta-3">Tarifa del programa o general</span>
                      : <span className="font-display text-xl font-semibold">{pesosExactos(m.tarifaHoraCentavos)}<span className="text-sm font-normal text-vs-tinta-3"> / hora</span></span>}
                  </p>
                </div>
                <div className="mt-3">
                  <CambiarTarifa docenteId={m.id} actual={m.tarifaHoraCentavos} hoy={hoy} />
                </div>
                {historial.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs text-vs-tinta-3">Historial ({historial.length})</summary>
                    <ul className="mt-2 divide-y divide-vs-linea">
                      {historial.map((t) => (
                        <li key={t.id} className="flex flex-wrap justify-between gap-2 py-1.5 tabular-nums">
                          <span className="text-vs-tinta-2">
                            {t.vigenteDesde === "2000-01-01" ? "Desde siempre" : `Desde ${t.vigenteDesde}`}
                            {t.vigenteHasta ? ` hasta ${t.vigenteHasta}` : " · vigente"}
                          </span>
                          <span className="font-medium">{pesosExactos(t.tarifaHoraCentavos)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
