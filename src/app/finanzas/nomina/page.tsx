import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import {
  cortesDeNomina, nominaPendientePorDocente, partidasPendientesDe,
} from "@/lib/datos/finanzas";
import { pesos } from "@/lib/formato";
import { fechaCivil, hoyEnMexico, horaCivil } from "@/lib/zona";
import { Calcular, PagarDocente } from "./cliente";

export const dynamic = "force-dynamic";

const ESTADO: Record<string, string> = {
  asistio: "Asistió", falta: "Falta sin aviso", falta_justificada: "Falta justificada",
};

const METODO: Record<string, string> = {
  transferencia: "Transferencia", efectivo: "Efectivo",
  deposito: "Depósito", otro: "Otro",
};

export default async function Nomina() {
  // Un docente entra con `nomina.leer_propia`; el alcance lo limita a lo suyo.
  const sesion = await exigirPermiso(
    // El director tiene ambos; el maestro solo el propio.
    "nomina.leer_propia",
  );
  const alcance = alcanceDe(sesion);
  const puedePagar = tienePermiso(sesion, "nomina.leer");

  const hoy = hoyEnMexico();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const pendientes = nominaPendientePorDocente(alcance);
  const total = pendientes.reduce((s, p) => s + p.totalCentavos, 0);
  const cortes = cortesDeNomina(alcance);

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        {puedePagar && (
          <Link href="/finanzas" className="text-xs text-vs-tinta-3 no-underline hover:underline">
            ← Finanzas
          </Link>
        )}

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {puedePagar ? "Nómina docente" : "Tu nómina"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          $120 por hora impartida: una clase de una hora paga $120 y una de dos, $240. Cuando el
          alumno falta sin avisar, el maestro cobra el 75 % porque reservó el horario y se
          presentó.
        </p>

        {puedePagar && (
          <section className="mt-6 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Calcular el corte</h2>
            <div className="mt-3">
              <Calcular desde={inicioMes} hasta={hoy} />
            </div>
          </section>
        )}

        <section className="mt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Pendiente de pago</h2>
            {pendientes.length > 0 && (
              <p id="nomina-total" className="font-display text-xl font-semibold tabular-nums">{pesos(total)}</p>
            )}
          </div>

          {pendientes.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              {puedePagar
                ? "No hay clases pendientes de pago. Calcula el corte para incorporar las impartidas."
                : "No tienes clases pendientes de pago."}
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              {pendientes.map((d) => {
                const partidas = partidasPendientesDe(d.docenteId);
                return (
                  <div key={d.docenteId} className="overflow-hidden rounded-xl border border-vs-linea bg-white">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-vs-linea bg-vs-crema px-5 py-3">
                      <div>
                        <p className="font-medium">{d.docente}</p>
                        <p className="text-xs text-vs-tinta-3">
                          {d.clases} clase{d.clases === 1 ? "" : "s"} · {(d.minutos / 60).toFixed(1)} horas
                        </p>
                      </div>
                      <p id={`nomina-docente-${d.docenteId}`} className="font-display text-2xl font-semibold tabular-nums">
                        {pesos(d.totalCentavos)}
                      </p>
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
                          <th className="px-5 py-2 text-left font-semibold">Clase</th>
                          <th className="px-5 py-2 text-left font-semibold">Alumno</th>
                          <th className="px-5 py-2 text-left font-semibold">Resultado</th>
                          <th className="px-5 py-2 text-right font-semibold">Min.</th>
                          <th className="px-5 py-2 text-right font-semibold">Factor</th>
                          <th className="px-5 py-2 text-right font-semibold">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partidas.map((p) => (
                          <tr key={p.id} data-partida={p.id} className="border-t border-vs-linea">
                            <td className="px-5 py-2 tabular-nums text-vs-tinta-2">
                              {fechaCivil(p.iniciaEn)} · {horaCivil(p.iniciaEn)}
                            </td>
                            <td className="px-5 py-2">{p.alumno}</td>
                            <td className="px-5 py-2 text-vs-tinta-2">
                              {ESTADO[p.estadoClase] ?? p.estadoClase}
                            </td>
                            <td className="px-5 py-2 text-right tabular-nums">{p.minutos}</td>
                            <td className="px-5 py-2 text-right tabular-nums">
                              {Number(p.factor) === 1 ? "—" : `${Number(p.factor) * 100} %`}
                            </td>
                            <td className="px-5 py-2 text-right tabular-nums font-medium">
                              {pesos(p.importeCentavos)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {puedePagar && (
                      <div className="border-t border-vs-linea px-5 py-4">
                        <PagarDocente
                          docenteId={d.docenteId}
                          docente={d.docente}
                          desde={inicioMes}
                          hasta={hoy}
                          total={pesos(d.totalCentavos)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Cortes pagados</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            {puedePagar
              ? "Constancia de lo ya liquidado. Al cerrar un corte las clases salen de la lista de pendientes; aquí queda el registro."
              : "Lo que la academia ya te liquidó."}
          </p>

          {cortes.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-6 text-center text-sm text-vs-tinta-3">
              Todavía no se ha cerrado ningún corte.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table id="cortes-pagados" className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Pagado el</th>
                    {puedePagar && <th className="px-4 py-2.5 text-left font-semibold">Maestro</th>}
                    <th className="px-4 py-2.5 text-left font-semibold">Periodo</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Forma</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Clases</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {cortes.map((c) => (
                    <tr key={c.id} data-corte={c.id} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 tabular-nums">{c.pagadoEl}</td>
                      {puedePagar && <td className="px-4 py-2.5">{c.docente}</td>}
                      <td className="px-4 py-2.5 tabular-nums text-vs-tinta-2">
                        {c.desdeEl} al {c.hastaEl}
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">{METODO[c.metodo] ?? c.metodo}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.clases}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {pesos(c.totalCentavos)}
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
