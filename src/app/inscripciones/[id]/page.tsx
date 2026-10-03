import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { aulasActivas, clasesDeInscripcion } from "@/lib/datos/clases";
import { ciclosDe, familiaDe, inscripcionPorId, movimientosDe } from "@/lib/datos/inscripciones";
import { progresoDeInscripcion, tareasDeInscripcion } from "@/lib/datos/expediente";
import { diasRestantes } from "@/lib/dominio/ciclos";
import { ZONA, fechaLarga, pesos } from "@/lib/formato";
import { horaCivil } from "@/lib/zona";
import { Agendar } from "./agendar";
import { BotonRenovar } from "./renovar";

export const dynamic = "force-dynamic";

const ESTADO_TEXTO: Record<string, string> = {
  programada: "Programada", asistio: "Asistió", falta: "Falta",
  falta_justificada: "Falta justificada", cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

const VALORACION: Record<string, string> = {
  requiere_apoyo: "Requiere apoyo", en_desarrollo: "En desarrollo",
  consolidado: "Consolidado", destacado: "Destacado",
};

const MOTIVOS: Record<string, string> = {
  emision_ciclo: "Emisión del período",
  clase_tomada: "Clase tomada",
  falta_sin_aviso: "Falta sin aviso",
  expiracion_ciclo: "Expiración al cerrar",
  cancelada_por_academia: "Cancelada por la academia",
  credito_cortesia: "Cortesía",
  ajuste_manual: "Ajuste manual",
};

export default async function Inscripcion({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("inscripciones.leer");
  const { id } = await params;

  const inscripcionId = Number(id);
  if (!Number.isInteger(inscripcionId)) notFound();

  const insc = inscripcionPorId(inscripcionId, alcanceDe(sesion));
  if (!insc) notFound();

  const periodos = ciclosDe(insc.id);
  const vigente = periodos.find((c) => c.estado === "abierto");
  const puedeRenovar = tienePermiso(sesion, "inscripciones.crear");
  const puedeAgendar = tienePermiso(sesion, "clases.crear");
  const puedeDarDeBaja = tienePermiso(sesion, "inscripciones.baja");
  const clases = clasesDeInscripcion(insc.id);
  const aulas = aulasActivas();
  const tareas = tareasDeInscripcion(insc.id);
  const avances = progresoDeInscripcion(insc.id);
  const familia = familiaDe(insc.id);
  const esTitular = familia?.titularInscripcionId === insc.id;

  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link
          href={`/alumnos/${insc.alumnoId}`}
          className="text-xs text-vs-tinta-3 no-underline hover:underline"
        >
          ← {insc.alumno}
        </Link>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {insc.programa}
        </h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          {insc.instrumento} · {insc.docente} · desde el {insc.fechaInicio}
          {insc.estado !== "activa" && (
            <span id="estado-inscripcion"
                  className="ml-2 rounded bg-vs-crema px-2 py-0.5 text-[11px] font-semibold text-vs-tinta-3">
              {insc.estado}
            </span>
          )}
        </p>

        {insc.estado === "finalizada" && insc.fechaFin && (
          <p id="aviso-dada-de-baja"
             className="mt-4 rounded-lg border border-vs-linea bg-vs-crema px-4 py-3 text-sm">
            Dada de baja con efecto al <strong>{insc.fechaFin}</strong> (cláusula 12ª).
            {insc.notas && <> Motivo: {insc.notas}.</>}{" "}
            El expediente, las clases tomadas y los pagos siguen completos: lo que se
            detuvo es el cobro y la ocupación del cubículo.
          </p>
        )}

        {familia && (
          <section className="mt-7 rounded-xl border border-vs-naranja bg-vs-crema p-5">
            <h2 className="font-display text-lg font-semibold">
              {esTitular ? "Titular de un plan familiar" : "Incluido en un plan familiar"}
            </h2>

            {esTitular ? (
              <p className="mt-1 text-sm text-vs-tinta-2">
                Esta inscripción lleva la mensualidad de{" "}
                <strong>{pesos(familia.precioCentavos)}</strong> de todo el grupo. Los hermanos
                tienen su propio maestro, horario y saldo de clases, y su período abre en $0.
              </p>
            ) : (
              <p className="mt-1 text-sm text-vs-tinta-2">
                La mensualidad la lleva la inscripción de{" "}
                <Link href={`/inscripciones/${familia.titularInscripcionId}`}
                      className="font-medium no-underline hover:underline">
                  {familia.titular}
                </Link>
                . Aquí no hay adeudo que cobrar: el cargo del grupo vive una sola vez.
              </p>
            )}

            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              <li className="rounded-lg border border-vs-linea bg-white px-3 py-1.5">
                <Link href={`/inscripciones/${familia.titularInscripcionId}`} className="no-underline">
                  {familia.titular}
                </Link>
                <span className="ml-2 text-[11px] uppercase tracking-wider text-vs-tinta-3">titular</span>
              </li>
              {familia.cubiertos.map((c) => (
                <li key={c.inscripcionId} className="rounded-lg border border-vs-linea bg-white px-3 py-1.5">
                  <Link href={`/inscripciones/${c.inscripcionId}`} className="no-underline">
                    {c.alumno}
                  </Link>
                </li>
              ))}
              {Array.from({
                length: familia.alumnosIncluidos - 1 - familia.cubiertos.length,
              }).map((_, i) => (
                <li key={`libre-${i}`}
                    className="rounded-lg border border-dashed border-vs-linea px-3 py-1.5 text-vs-tinta-3">
                  Lugar libre
                </li>
              ))}
            </ul>
          </section>
        )}

        {vigente ? (
          <section className="mt-7 rounded-xl border border-vs-linea bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  Período {vigente.numero} · {vigente.iniciaEl} al {vigente.terminaEl}
                </p>
                <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
                  {vigente.saldo}
                  <span className="ml-2 text-lg font-normal text-vs-tinta-3">
                    de {vigente.contratadas} {vigente.contratadas === 1 ? "clase" : "clases"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-vs-tinta-2">
                  {(() => {
                    const d = diasRestantes(
                      { iniciaEl: vigente.iniciaEl, terminaEl: vigente.terminaEl }, hoy,
                    );
                    if (d < 0) return `El período cerró hace ${-d} día${-d === 1 ? "" : "s"}.`;
                    if (d === 0) return "Hoy es el último día del período.";
                    return `Quedan ${d} día${d === 1 ? "" : "s"} de período.`;
                  })()}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm">
                <dt className="text-vs-tinta-3">Duración</dt>
                <dd className="tabular-nums">{vigente.minutos} min por clase</dd>
                <dt className="text-vs-tinta-3">Tarifa</dt>
                <dd className="tabular-nums">
                  {familia && familia.titularInscripcionId !== insc.id
                    ? "Cubierta por el plan familiar"
                    : pesos(vigente.precio)}
                </dd>
                <dt className="text-vs-tinta-3">Posposiciones</dt>
                <dd className="tabular-nums">{vigente.posposicionesUsadas} de 2 usadas</dd>
              </dl>
            </div>

            {puedeRenovar && (
              <div className="mt-5 border-t border-vs-linea pt-4">
                <BotonRenovar inscripcionId={insc.id} saldo={vigente.saldo} />
                <p className="mt-2 text-xs text-vs-tinta-3">
                  Cláusula 4ª: las clases no tomadas no se acumulan. Al renovar, el saldo
                  restante expira con su registro en el libro mayor.
                </p>
              </div>
            )}
          </section>
        ) : (
          <p className="mt-7 rounded-lg border border-vs-linea bg-white px-4 py-3 text-sm text-vs-tinta-3">
            Esta inscripción no tiene un período abierto.
          </p>
        )}

        {insc.estado === "activa" && puedeDarDeBaja && (
          <section className="mt-7 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Terminar el contrato</h2>
            <p className="mt-1 text-sm text-vs-tinta-2">
              Cláusula 12ª: con aviso de 72 horas y sin devolución de lo ya pagado. La
              pantalla enseña qué pasa con el cargo del período y con las clases agendadas
              antes de hacer nada.
            </p>
            <Link href={`/inscripciones/${insc.id}/baja`}
                  className="mt-4 inline-block rounded-lg border border-vs-linea px-4 py-2 text-sm
                             font-medium no-underline transition hover:border-vs-naranja-700">
              Dar de baja
            </Link>
          </section>
        )}

        {vigente && puedeAgendar && (
          <section className="mt-7 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Agendar una clase</h2>
            <div className="mt-4">
              <Agendar
                inscripcionId={insc.id}
                cicloId={vigente.id}
                aulas={aulas}
                hoy={hoy}
                minutos={vigente.minutos}
                saldo={vigente.saldo}
              />
            </div>
          </section>
        )}

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">
            Clases <span className="text-vs-tinta-3">({clases.length})</span>
          </h2>
          {clases.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-6 text-center text-sm text-vs-tinta-3">
              Todavía no hay clases agendadas en esta inscripción.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {clases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clases/${c.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border
                               border-vs-linea bg-white px-4 py-2.5 no-underline transition
                               hover:border-vs-naranja-700"
                  >
                    <span className="text-sm">{fechaLarga(c.iniciaEn)}</span>
                    <span className="font-mono text-sm tabular-nums text-vs-tinta-2">
                      {horaCivil(c.iniciaEn)}–{horaCivil(c.terminaEn)}
                    </span>
                    <span className="text-xs text-vs-tinta-3">
                      {c.modalidad === "en_linea" ? "En línea" : (c.aula ?? "Sin cubículo")}
                    </span>
                    {c.origen === "recuperacion" && (
                      <span className="rounded bg-vs-amarillo-suave px-1.5 py-0.5 text-[10px] font-semibold">
                        recuperación
                      </span>
                    )}
                    <span className="ml-auto text-xs font-semibold">
                      {ESTADO_TEXTO[c.estado] ?? c.estado}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">Libro mayor de clases</h2>
          <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
            El saldo no se guarda en ningún campo: es la suma de estos movimientos. Cada uno
            tiene motivo y fecha, así que siempre se puede explicar de dónde salió el número.
          </p>

          <div className="mt-4 flex flex-col gap-5">
            {periodos.map((c) => {
              const movs = movimientosDe(c.id);
              let corriente = 0;
              return (
                <div key={c.id} className="overflow-hidden rounded-lg border border-vs-linea bg-white">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-vs-linea bg-vs-crema px-4 py-2.5">
                    <p className="text-sm font-medium">
                      Período {c.numero}
                      <span className="ml-2 font-normal text-vs-tinta-3">
                        {c.iniciaEl} al {c.terminaEl}
                      </span>
                    </p>
                    <p className="text-xs">
                      <span className={c.estado === "abierto" ? "text-green-800" : "text-vs-tinta-3"}>
                        {c.estado === "abierto" ? "Abierto" : "Cerrado"}
                      </span>
                      <span className="ml-3 font-semibold tabular-nums">saldo {c.saldo}</span>
                    </p>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
                        <th className="px-4 py-2 text-left font-semibold">Fecha</th>
                        <th className="px-4 py-2 text-left font-semibold">Motivo</th>
                        <th className="px-4 py-2 text-right font-semibold">Mov.</th>
                        <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movs.map((m) => {
                        corriente += m.delta;
                        return (
                          <tr key={m.id} className="border-t border-vs-linea">
                            <td className="px-4 py-2 tabular-nums text-vs-tinta-3">
                              {m.creadoEn.toISOString().slice(0, 10)}
                            </td>
                            <td className="px-4 py-2">
                              {MOTIVOS[m.motivo] ?? m.motivo}
                              {m.nota && (
                                <span className="ml-2 text-xs text-vs-tinta-3">{m.nota}</span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-2 text-right tabular-nums font-medium ${
                                m.delta > 0 ? "text-green-800" : "text-vs-naranja-700"
                              }`}
                            >
                              {m.delta > 0 ? `+${m.delta}` : m.delta}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-vs-tinta-2">
                              {corriente}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>

        {(tareas.length > 0 || avances.length > 0) && (
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {tareas.length > 0 && (
              <section className="rounded-xl border border-vs-linea bg-white p-5">
                <h2 className="font-display text-lg font-semibold">
                  Tareas <span className="text-vs-tinta-3">({tareas.length})</span>
                </h2>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {tareas.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex gap-2">
                      <span className={t.completadaEn ? "text-green-700" : "text-vs-tinta-3"}>
                        {t.completadaEn ? "✓" : "○"}
                      </span>
                      <span className={t.completadaEn ? "text-vs-tinta-3 line-through" : ""}>
                        {t.descripcion}
                        {t.repertorio && (
                          <span className="block text-xs text-vs-tinta-3">{t.repertorio}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {avances.length > 0 && (
              <section className="rounded-xl border border-vs-linea bg-white p-5">
                <h2 className="font-display text-lg font-semibold">Avance académico</h2>
                <ul className="mt-3 flex flex-col gap-3 text-sm">
                  {avances.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs tabular-nums text-vs-tinta-3">{a.fecha}</span>
                        {a.valoracion && (
                          <span className="rounded bg-vs-amarillo-suave px-1.5 py-0.5 text-[10px] font-semibold">
                            {VALORACION[a.valoracion] ?? a.valoracion}
                          </span>
                        )}
                        {a.autor && <span className="text-xs text-vs-tinta-3">{a.autor}</span>}
                      </p>
                      <p className="mt-0.5 text-vs-tinta-2">{a.notas}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <section className="mt-7 rounded-xl border border-dashed border-vs-linea p-8 text-center">
          <p className="text-sm text-vs-tinta-3">
            Las clases programadas y la asistencia llegan en E4. Ahí el libro mayor empezará
            a moverse solo.
          </p>
        </section>
      </main>
    </>
  );
}
