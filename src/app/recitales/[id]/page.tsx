import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import {
  boletosDe, candidatasParaRecital, participacionesDe, recitalPorId, taquillaDe,
} from "@/lib/datos/recitales";
import {
  NOMBRE_PARTICIPACION, NOMBRE_RECITAL, admiteCambios, duracionDelPrograma,
  lugaresDisponibles, problemasDelOrden, type EstadoParticipacion, type EstadoRecital,
} from "@/lib/dominio/recitales";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";
import {
  CambiarEstado, CancelarBoleto, Decidir, Lista, Ordenar, Proponer, Taquilla,
} from "./cliente";

export const dynamic = "force-dynamic";

export default async function Recital({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("recitales.leer");
  const { id } = await params;

  const recitalId = Number(id);
  if (!Number.isInteger(recitalId)) notFound();

  const r = recitalPorId(recitalId);
  if (!r) notFound();

  const hoy = hoyEnMexico();
  const alcance = alcanceDe(sesion);
  const gestiona = tienePermiso(sesion, "recitales.gestionar");
  const propone = tienePermiso(sesion, "recitales.proponer");
  const verFinanzas = tienePermiso(sesion, "finanzas.leer");

  const filas = participacionesDe(recitalId, alcance, verFinanzas, hoy);
  const confirmadas = filas.filter((f) => f.estado === "confirmada");
  const propuestas = filas.filter((f) => f.estado === "propuesta");
  const devueltas = filas.filter((f) => f.estado === "rechazada");

  const estado = r.estado as EstadoRecital;
  const puedeProponer = propone && admiteCambios(estado);
  const candidatas = puedeProponer ? candidatasParaRecital(recitalId, alcance) : [];

  const dur = duracionDelPrograma(confirmadas.map((c) => ({
    participacionId: c.id, orden: c.orden, duracionMinutos: c.duracionMinutos,
  })));
  const problemas = problemasDelOrden(confirmadas.map((c) => ({
    participacionId: c.id, orden: c.orden, duracionMinutos: c.duracionMinutos,
  })));

  const taquilla = gestiona ? taquillaDe(recitalId) : null;
  const libres = lugaresDisponibles({ capacidad: r.capacidad, vendidos: taquilla?.vendidos ?? 0 });
  const ventas = gestiona ? boletosDe(recitalId) : [];
  const sinImagen = confirmadas.filter((c) => !c.autorizaImagen);

  return (
    <>
      <Encabezado sesion={sesion} activo="recitales" />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/recitales" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Recitales
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{r.nombre}</h1>
          <span id="estado-recital"
                className="rounded bg-vs-crema px-2 py-1 text-[11px] uppercase tracking-wider text-vs-tinta-2">
            {NOMBRE_RECITAL[estado]}
          </span>
        </div>
        <p className="mt-1 text-sm text-vs-tinta-2">
          {r.fecha} a las {r.hora} · {r.sede}
          {r.direccionSede && ` · ${r.direccionSede}`}
        </p>

        {gestiona && (
          <div className="mt-4"><CambiarEstado recitalId={r.id} estado={estado} /></div>
        )}

        {/* ----------------------------------------------------- el programa */}
        <section className="mt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">
              Programa <span className="text-vs-tinta-3">({confirmadas.length})</span>
            </h2>
            {confirmadas.length > 0 && (
              <Link href={`/recitales/${r.id}/programa`} className="text-sm no-underline hover:underline">
                Programa de mano →
              </Link>
            )}
          </div>

          {dur.minutos > 0 && (
            <p className="mt-1 text-sm text-vs-tinta-3">
              Unos {dur.minutos} minutos de música
              {dur.sinDato > 0 && ` · ${dur.sinDato} sin duración registrada`}.
            </p>
          )}

          {gestiona && problemas.length > 0 && confirmadas.length > 0 && (
            <p id="problemas-orden"
               className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {problemas.join(" ")} El programa no se puede cerrar así.
            </p>
          )}

          {sinImagen.length > 0 && (
            <p id="sin-uso-imagen"
               className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>{sinImagen.length} participante(s) no autorizan uso de imagen:</strong>{" "}
              {sinImagen.map((s) => s.alumno).join(", ")}. No pueden salir en fotos ni video del
              recital.
            </p>
          )}

          {confirmadas.length === 0 ? (
            <p id="programa-vacio"
               className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Todavía no hay nadie confirmado.
            </p>
          ) : (
            <ol id="lista-programa" className="mt-3 flex flex-col gap-2">
              {confirmadas.map((c) => (
                <li key={c.id} data-participacion={c.id}
                    className="rounded-lg border border-vs-linea bg-white px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-lg font-semibold tabular-nums text-vs-naranja-700">
                      {c.orden ?? "—"}
                    </span>
                    <span className="font-medium">{c.alumno}</span>
                    <span className="text-sm text-vs-tinta-2">{c.pieza}</span>
                    {c.compositor && <span className="text-xs text-vs-tinta-3">{c.compositor}</span>}
                    {!c.autorizaImagen && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        sin uso de imagen
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-vs-tinta-3">
                    {c.instrumento} · {c.docente}
                    {c.duracionMinutos && ` · ${c.duracionMinutos} min`}
                  </p>
                  {gestiona && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {admiteCambios(estado) && (
                        <Ordenar participacionId={c.id} recitalId={r.id} orden={c.orden} />
                      )}
                      {(estado === "programa_cerrado" || estado === "realizado") && (
                        <Lista participacionId={c.id} recitalId={r.id} asistio={c.asistio} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ------------------------------------------------ por confirmar */}
        {propuestas.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">
              Por confirmar <span className="text-vs-tinta-3">({propuestas.length})</span>
            </h2>
            <ul id="lista-propuestas" className="mt-3 flex flex-col gap-2">
              {propuestas.map((c) => (
                <li key={c.id} data-propuesta={c.id}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium">{c.alumno}</span>
                    <span className="text-sm text-vs-tinta-2">{c.pieza}</span>
                    <span className="text-xs text-vs-tinta-3">
                      {c.instrumento} · {c.docente}
                      {c.propuestaPor && ` · propuso ${c.propuestaPor}`}
                    </span>
                  </div>
                  {verFinanzas && (c.adeudoVencidoCentavos ?? 0) > 0 && (
                    <p data-adeudo={c.id} className="mt-1 text-sm font-medium text-red-800">
                      Debe {pesos(c.adeudoVencidoCentavos ?? 0)} vencidos: no se puede confirmar
                      hasta que se ponga al corriente.
                    </p>
                  )}
                  {gestiona && (
                    <div className="mt-2"><Decidir participacionId={c.id} recitalId={r.id} /></div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {devueltas.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">Devueltas</h2>
            <ul id="lista-devueltas" className="mt-3 flex flex-col gap-2">
              {devueltas.map((c) => (
                <li key={c.id} className="rounded-lg border border-vs-linea bg-white px-4 py-3 text-sm">
                  <span className="font-medium">{c.alumno}</span>
                  <span className="ml-2 text-vs-tinta-2">{c.pieza}</span>
                  <p className="mt-0.5 text-xs text-vs-tinta-3">{c.motivoRechazo}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --------------------------------------------------------- proponer */}
        {puedeProponer && (
          <section className="mt-8 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Proponer a un alumno</h2>
            <p className="mt-1 text-sm text-vs-tinta-2">
              {gestiona
                ? "Queda como propuesta hasta que se confirme, igual que si la mandara un maestro."
                : "Tu propuesta queda pendiente: la dirección la confirma."}
            </p>
            {candidatas.length === 0 ? (
              <p className="mt-3 text-sm text-vs-tinta-3">No hay alumnos con inscripción activa.</p>
            ) : (
              <div className="mt-3"><Proponer recitalId={r.id} candidatas={candidatas} /></div>
            )}
          </section>
        )}

        {/* --------------------------------------------------------- taquilla */}
        {gestiona && taquilla && (
          <section className="mt-9">
            <h2 className="font-display text-xl font-semibold">Taquilla</h2>

            <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-4">
              <div className="bg-white px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Boletos</dt>
                <dd id="boletos-vendidos" className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {taquilla.vendidos}
                </dd>
              </div>
              <div className="bg-white px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Ingreso</dt>
                <dd id="ingreso-taquilla" className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {pesos(taquilla.ingresoCentavos)}
                </dd>
              </div>
              <div className="bg-white px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Cortesías</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {taquilla.cortesias}
                </dd>
              </div>
              <div className="bg-white px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Lugares libres</dt>
                <dd id="lugares-libres" className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {libres === null ? "sin tope" : libres}
                </dd>
              </div>
            </dl>

            {estado !== "cancelado" && estado !== "realizado" && (
              <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
                <h3 className="font-display text-base font-semibold">Vender</h3>
                <div className="mt-3">
                  <Taquilla recitalId={r.id} hoy={hoy}
                            precio={pesos(r.precioBoletoCentavos)} libres={libres} />
                </div>
              </div>
            )}

            {ventas.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-vs-linea bg-white">
                <table id="tabla-boletos" className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                      <th className="px-4 py-2.5 text-left font-semibold">Folio</th>
                      <th className="px-4 py-2.5 text-left font-semibold">A nombre de</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Cant.</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Forma</th>
                      <th className="px-4 py-2.5 text-left font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => (
                      <tr key={v.id} data-boleto={v.id}
                          className={`border-t border-vs-linea ${v.cancelado ? "text-vs-tinta-3 line-through" : ""}`}>
                        <td className="px-4 py-2.5 font-mono text-xs">{v.folio}</td>
                        <td className="px-4 py-2.5">{v.compradorNombre}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{v.cantidad}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{pesos(v.totalCentavos)}</td>
                        <td className="px-4 py-2.5 text-vs-tinta-2">{v.metodo}</td>
                        <td className="px-4 py-2.5">
                          {!v.cancelado && <CancelarBoleto boletoId={v.id} recitalId={r.id} />}
                          {v.cancelado && (
                            <span className="text-xs no-underline">{v.motivoCancelacion}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-2.5 text-xs text-vs-tinta-3">
              La taquilla vive aparte de las mensualidades: un boleto lo compra quien viene al
              recital, que muchas veces no es familia de nadie. El total lo comprueba la base —
              cantidad por precio unitario— para que la caja no descuadre.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
