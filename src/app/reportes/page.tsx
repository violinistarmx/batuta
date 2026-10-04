import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { GraficaLinea } from "@/components/graficas";
import { exigirPermiso } from "@/lib/auth/permisos";
import { alumnosActivosPorMes } from "@/lib/datos/metricas";
import {
  alumnosEnRiesgo, asistenciaPorDocente, asistenciaPorPrograma, dineroPorPrograma,
  movimientoDeInscripciones, ocupacionDocente, type FilaAsistencia,
} from "@/lib/datos/reportes";
import { embudo, motivosDePerdida, porOrigen } from "@/lib/datos/prospectos";
import {
  ABIERTAS, NOMBRE_ETAPA, abiertosEn, ordenarOrigenes, tasaConversion,
} from "@/lib/dominio/prospectos";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

const ORIGEN: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  recomendacion: "Recomendación", paso_por_la_calle: "Pasó por la calle",
  whatsapp: "WhatsApp", google: "Google", evento: "Evento", otro: "Otro",
};

const MOTIVO_PERDIDA: Record<string, string> = {
  precio: "Precio", horario: "No hay horario que le sirva", distancia: "Distancia",
  no_contesto: "Nunca contestó", eligio_otra: "Eligió otra academia",
  sin_interes: "Perdió el interés", otro: "Otro",
};

/** Porcentaje de asistencia sobre lo que ya ocurrió: lo programado aún no cuenta. */
function tasaAsistencia(f: FilaAsistencia): number | null {
  const resueltas = f.asistio + f.falta + f.justificada;
  if (resueltas === 0) return null;
  return (f.asistio / resueltas) * 100;
}

function TablaAsistencia({ titulo, filas, encabezado }: {
  titulo: string; filas: FilaAsistencia[]; encabezado: string;
}) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-vs-linea bg-white px-4 py-6 text-center text-sm text-vs-tinta-3">
          Sin clases en el periodo.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-vs-linea bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                <th className="px-4 py-2.5 text-left font-semibold">{encabezado}</th>
                <th className="px-4 py-2.5 text-right font-semibold">Asistió</th>
                <th className="px-4 py-2.5 text-right font-semibold">Faltó</th>
                <th className="px-4 py-2.5 text-right font-semibold">Justificó</th>
                <th className="px-4 py-2.5 text-right font-semibold">Sin registrar</th>
                <th className="px-4 py-2.5 text-right font-semibold">Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const tasa = tasaAsistencia(f);
                return (
                  <tr key={f.clave} className="border-t border-vs-linea">
                    <td className="px-4 py-2.5 font-medium">{f.nombre}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.asistio}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.falta}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-2">{f.justificada}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${
                      f.programada > 0 ? "font-medium text-vs-naranja-700" : "text-vs-tinta-3"
                    }`}>
                      {f.programada}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {tasa === null ? "—" : `${tasa.toFixed(0)} %`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  // Un reporte de academia es información financiera y de desempeño del personal.
  // Ni el maestro ni el asistente entran aquí salvo que se les dé el permiso.
  const sesion = await exigirPermiso("reportes.leer");
  const { desde, hasta } = await searchParams;

  const hoy = hoyEnMexico();
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const d = desde && fecha.test(desde) ? desde : `${hoy.slice(0, 7)}-01`;
  const h = hasta && fecha.test(hasta) ? hasta : hoy;
  const r = { desde: d, hasta: h };

  const porDocente = asistenciaPorDocente(r);
  const porPrograma = asistenciaPorPrograma(r);
  const ocupacion = ocupacionDocente(r);
  const dinero = dineroPorPrograma(r);
  const mov = movimientoDeInscripciones(r);
  // Doce meses fijos, al margen del rango elegido arriba: la gráfica responde
  // «cómo venimos creciendo», no «qué pasó en este rango».
  const activos = alumnosActivosPorMes(hoy, 12);
  const riesgo = alumnosEnRiesgo(r);
  const emb = embudo(d, h);
  const origenes = ordenarOrigenes(porOrigen(d, h));
  const motivos = motivosDePerdida(d, h);
  const tasa = tasaConversion(emb);

  const totalCobrado = dinero.reduce((s, x) => s + x.cobradoCentavos, 0);
  const totalCosto = dinero.reduce((s, x) => s + x.costoDocenteCentavos, 0);

  return (
    <>
      <Encabezado sesion={sesion} activo="reportes" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Reportes</h1>
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

        {/* ------------------------------------------------------- crecimiento */}
        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">Crecimiento de la academia</h2>
          <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
            Alumnos con inscripción vigente al cierre de cada mes, últimos doce.{" "}
            <strong>No es un acumulado de altas</strong>: un acumulado solo sabe sumar y
            dibujaría una línea que nunca baja, aunque la academia estuviera perdiendo
            alumnos. Aquí las bajas se notan. Se cuentan alumnos distintos, así que quien
            lleva violín y piano cuenta una vez.
          </p>
          <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
            <GraficaLinea
              datos={activos}
              titulo="Alumnos activos al cierre de cada mes, últimos doce meses"
              formatoValor={(n) => String(n)}
              formatoEje={(n) => String(n)}
            />
          </div>
        </section>

        {/* ------------------------------------------------------- retención */}
        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Movimiento de inscripciones</h2>
          <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-3">
            <div className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Altas</dt>
              <dd id="altas" className="mt-1 font-display text-2xl font-semibold tabular-nums">{mov.altas}</dd>
            </div>
            <div className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Bajas</dt>
              <dd id="bajas" className={`mt-1 font-display text-2xl font-semibold tabular-nums ${
                mov.bajas > 0 ? "text-vs-naranja-700" : ""
              }`}>
                {mov.bajas}
              </dd>
            </div>
            <div className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Vigentes al cierre</dt>
              <dd id="vigentes" className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {mov.activasAlCierre}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-vs-tinta-3">
            Se cuentan inscripciones, no alumnos: alguien puede dar de baja el piano y seguir
            en violín, y eso es una baja aunque el alumno se quede.
          </p>
        </section>

        {/* ------------------------------------------------------ asistencia */}
        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Asistencia</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            El porcentaje se calcula solo sobre las clases con resultado. Las que siguen
            sin registrar se muestran aparte porque no son un dato: son un pendiente.
          </p>
          <div className="mt-4 flex flex-col gap-6">
            <TablaAsistencia titulo="Por maestro" filas={porDocente} encabezado="Maestro" />
            <TablaAsistencia titulo="Por programa" filas={porPrograma} encabezado="Programa" />
          </div>
        </section>

        {/* ------------------------------------------------------- ocupación */}
        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Carga de trabajo</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Solo cuenta lo que genera pago —asistió y falta sin aviso—, la misma regla de la
            nómina. Contar las canceladas daría dos verdades sobre el mismo mes.
          </p>
          {ocupacion.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-vs-linea bg-white px-4 py-6 text-center text-sm text-vs-tinta-3">
              Sin clases impartidas en el periodo.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table id="tabla-ocupacion" className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Maestro</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Clases</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Horas</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Alumnos</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {ocupacion.map((o) => (
                    <tr key={o.docenteId} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 font-medium">{o.docente}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{o.clases}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{(o.minutos / 60).toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{o.alumnos}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pesos(o.costoCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------------------------------------------- dinero por programa */}
        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Dinero por programa</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            El margen se calcula sobre lo <strong>cobrado</strong>, no sobre lo emitido. Un
            programa con mucho facturado y poco cobrado no tiene buen margen: tiene un
            problema de cobranza, y la columna de al lado lo dice.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
            <table id="tabla-programas-dinero" className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  <th className="px-4 py-2.5 text-left font-semibold">Programa</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Inscripciones</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cobrado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Por cobrar</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Costo docente</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody>
                {dinero.map((p) => {
                  const margen = p.cobradoCentavos - p.costoDocenteCentavos;
                  const pct = p.cobradoCentavos > 0
                    ? (margen / p.cobradoCentavos) * 100
                    : null;
                  return (
                    <tr key={p.programaId} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 font-medium">{p.programa}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.inscripciones}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pesos(p.cobradoCentavos)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${
                        p.porCobrarCentavos > 0 ? "text-vs-naranja-700" : "text-vs-tinta-3"
                      }`}>
                        {pesos(p.porCobrarCentavos)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-2">
                        {pesos(p.costoDocenteCentavos)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {pct === null ? "—" : `${pct.toFixed(1)} %`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-vs-linea bg-vs-crema font-medium">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td id="total-cobrado" className="px-4 py-2.5 text-right tabular-nums">{pesos(totalCobrado)}</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pesos(totalCosto)}</td>
                  <td id="margen-total" className="px-4 py-2.5 text-right tabular-nums">
                    {totalCobrado > 0
                      ? `${((totalCobrado - totalCosto) / totalCobrado * 100).toFixed(1)} %`
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-vs-tinta-3">
            En un plan familiar el cobro se atribuye al programa de la inscripción titular,
            que es donde vive el cargo, y el costo incluye las clases de todos los hermanos.
          </p>
        </section>

        {/* --------------------------------------------------------- prospectos */}
        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Embudo de prospectos</h2>
          <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
            La conversión se mide sobre los prospectos <strong>cerrados</strong>. Contar los que
            siguen en juego castiga a quien acaba de recibir diez mensajes: todavía no son un
            fracaso, solo no son un resultado.
          </p>

          <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-4">
            {ABIERTAS.map((k) => (
              <div key={k} className="bg-white px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  {NOMBRE_ETAPA[k]}
                </dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{emb[k]}</dd>
              </div>
            ))}
          </dl>

          <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-4">
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">En juego</dt>
              <dd id="rep-en-juego" className="mt-1 font-display text-xl font-semibold tabular-nums">
                {abiertosEn(emb)}
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Convertidos</dt>
              <dd id="rep-convertidos" className="mt-1 font-display text-xl font-semibold tabular-nums">
                {emb.convertido}
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Perdidos</dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{emb.perdido}</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Conversión</dt>
              <dd id="rep-tasa" className="mt-1 font-display text-xl font-semibold tabular-nums">
                {tasa === null ? "—" : `${tasa.toFixed(0)} %`}
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-base font-semibold">De dónde llegan</h3>
              <p className="mt-1 text-xs text-vs-tinta-3">
                Ordenado por alumnos conseguidos, no por mensajes recibidos: un canal con cien
                mensajes y dos inscripciones es peor que uno con diez y cinco.
              </p>
              {origenes.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-vs-linea bg-white px-4 py-6 text-center text-sm text-vs-tinta-3">
                  Sin prospectos en el periodo.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-vs-linea bg-white">
                  <table id="tabla-origenes" className="w-full text-sm">
                    <thead>
                      <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                        <th className="px-4 py-2.5 text-left font-semibold">Origen</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Prospectos</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Alumnos</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Tasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {origenes.map((o) => (
                        <tr key={o.origen} className="border-t border-vs-linea">
                          <td className="px-4 py-2.5 font-medium">{ORIGEN[o.origen] ?? o.origen}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{o.total}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {o.convertidos}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {o.tasa === null ? "—" : `${o.tasa.toFixed(0)} %`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-display text-base font-semibold">Por qué se pierden</h3>
              <p className="mt-1 text-xs text-vs-tinta-3">
                El motivo es obligatorio al marcar un prospecto como perdido. Sin él, esta tabla
                estaría vacía justo donde hay algo que cambiar.
              </p>
              {motivos.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-vs-linea bg-white px-4 py-6 text-center text-sm text-vs-tinta-3">
                  Nadie se ha perdido en el periodo.
                </p>
              ) : (
                <ul id="lista-motivos" className="mt-2 flex flex-col gap-1.5">
                  {motivos.map((m) => (
                    <li key={m.motivo}
                        className="flex items-baseline justify-between rounded-lg border border-vs-linea bg-white px-4 py-2.5 text-sm">
                      <span>{MOTIVO_PERDIDA[m.motivo ?? "otro"] ?? m.motivo}</span>
                      <span className="tabular-nums font-medium">{m.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- riesgo */}
        <section className="mt-9">
          <h2 className="font-display text-xl font-semibold">Alumnos en riesgo</h2>
          <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
            Faltaron a la mitad o más de sus clases del periodo. Es la señal temprana de una
            baja: llamar a tiempo sale más barato que reponer al alumno, y es lo único que
            se puede hacer antes de las 72 h de aviso de la cláusula 12ª.
          </p>
          {riesgo.length === 0 ? (
            <p id="sin-riesgo" className="mt-3 rounded-lg border border-dashed border-vs-linea bg-white px-4 py-6 text-center text-sm text-vs-tinta-3">
              Nadie con más faltas que asistencias. 🎶
            </p>
          ) : (
            <ul id="lista-riesgo" className="mt-3 flex flex-col gap-2">
              {riesgo.map((a) => (
                <li key={`${a.alumnoId}-${a.programa}`}>
                  <Link href={`/alumnos/${a.alumnoId}`}
                        className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-amber-300
                                   bg-amber-50 px-4 py-3 no-underline transition hover:border-vs-naranja-700">
                    <span className="font-medium">{a.alumno}</span>
                    <span className="text-sm text-vs-tinta-2">{a.programa}</span>
                    <span className="ml-auto text-sm tabular-nums">
                      {a.faltas} de {a.total} clases
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-12 border-t border-vs-linea pt-6 text-xs text-vs-tinta-3">
          Ningún reporte escribe en la base: correrlo dos veces da el mismo resultado.
        </footer>
      </main>
    </>
  );
}
