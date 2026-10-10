import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { Encabezado } from "@/components/encabezado";
import { FotoPerfil } from "@/components/foto-perfil";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  alumnoPorId, consentimientosDe, credencialDe, saludDe, tutoresDe,
} from "@/lib/datos/alumnos";
import { inscripcionesDe } from "@/lib/datos/inscripciones";
import { cargosDeAlumno, cargosDeAlumnoCancelados, pagosDeAlumno } from "@/lib/datos/finanzas";
import { adeudoDe, resumirCobranza } from "@/lib/dominio/cobranza";
import { hoyEnMexico } from "@/lib/zona";
import { Cobrar } from "./cobrar";
import { BotonReactivar } from "./cargos/boton-reactivar";
import { edad, esMenorDeEdad, fechaLarga, pesos } from "@/lib/formato";
import { qrComoSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

// Next 16: `params` llega como promesa. El acceso síncrono se eliminó.
export default async function Expediente({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("alumnos.leer");
  const { id } = await params;

  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) notFound();

  const alumno = alumnoPorId(alumnoId, alcanceDe(sesion));
  // Fuera de alcance responde 404, no 403: para un docente, el expediente de un
  // alumno ajeno no existe.
  if (!alumno) notFound();

  const tutores = tutoresDe(alumno.id);
  const inscripciones = inscripcionesDe(alumno.id, alcanceDe(sesion));
  const puedeInscribir = tienePermiso(sesion, "inscripciones.crear");
  const puedeCobrar = tienePermiso(sesion, "pagos.registrar");
  const puedeDescontar = tienePermiso(sesion, "configuracion.gestionar");
  const verFinanzas = tienePermiso(sesion, "finanzas.leer") || puedeCobrar;
  const cargos = verFinanzas ? cargosDeAlumno(alumno.id) : [];
  const cargosCancelados = verFinanzas ? cargosDeAlumnoCancelados(alumno.id) : [];
  const pagos = verFinanzas ? pagosDeAlumno(alumno.id) : [];
  const hoyMx = hoyEnMexico();
  const cobranza = resumirCobranza(cargos, hoyMx);
  const consents = consentimientosDe(alumno.id);
  const credencial = credencialDe(alumno.id);
  const menor = esMenorDeEdad(alumno.fechaNacimiento);

  const puedeVerSalud = tienePermiso(sesion, "salud.leer");
  const salud = puedeVerSalud ? saludDe(alumno.id) : null;

  // Abrir la ficha de salud de un menor es un evento que debe quedar registrado.
  if (salud) {
    registrar({
      usuarioId: sesion.usuarioId,
      accion: "salud.leer",
      entidad: "salud_alumno",
      entidadId: alumno.id,
    });
  }

  const cabeceras = await headers();
  const host = cabeceras.get("host") ?? "localhost:3000";
  const protocolo = process.env.NODE_ENV === "production" ? "https" : "http";
  // URL_PUBLICA manda sobre el host de la petición, igual que en la credencial.
  // Si el QR se genera con el host de quien lo está viendo, el código apunta a
  // una dirección que el teléfono del alumno no alcanza: desde la red local sale
  // una IP privada, y desde un proxy, el nombre interno del contenedor.
  const qr = await qrComoSvg(alumno.qrToken, process.env.URL_PUBLICA ?? `${protocolo}://${host}`);

  const imagen = consents.find((c) => c.tipo === "uso_imagen");
  const privacidad = consents.find((c) => c.tipo === "aviso_privacidad");

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex items-baseline justify-between">
          <Link href="/alumnos" className="text-xs text-vs-tinta-3 no-underline hover:underline">
            ← Alumnos
          </Link>
          {tienePermiso(sesion, "alumnos.descartar") && (
            <Link href={`/alumnos/${alumno.id}/descartar`}
                  className="text-xs text-vs-tinta-3 no-underline hover:text-red-700 hover:underline">
              Descartar alumno
            </Link>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap items-start gap-5">
            <FotoPerfil
              tipo="alumno"
              id={alumno.id}
              nombre={alumno.nombre}
              tieneFoto={Boolean(alumno.fotoRuta)}
              puedeEditar={tienePermiso(sesion, "alumnos.editar")}
              version={alumno.fotoActualizadaEn?.getTime() ?? null}
            />
            <div>
            <p className="font-mono text-xs text-vs-tinta-3">{alumno.codigo}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              {alumno.nombre}
            </h1>
            <p className="mt-1 text-sm text-vs-tinta-2">
              {alumno.fechaNacimiento
                ? `${edad(alumno.fechaNacimiento)} años${menor ? " · menor de edad" : ""}`
                : "Edad no registrada"}
              {" · Alta el "}
              {fechaLarga(new Date(`${alumno.fechaInscripcion}T12:00:00`))}
            </p>
            </div>
          </div>

          <div className="rounded-xl border border-vs-linea bg-white p-3 text-center">
            <div
              className="[&>svg]:h-32 [&>svg]:w-32"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <Link
              id="abrir-credencial"
              href={`/alumnos/${alumno.id}/credencial`}
              className="mt-1.5 block text-[10px] uppercase tracking-wider text-vs-tinta-3
                         no-underline hover:text-vs-naranja-700 hover:underline"
            >
              Credencial · compartir
            </Link>
          </div>
        </div>

        {!imagen?.otorgado && (
          <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <strong>No autoriza uso de imagen.</strong> Este alumno queda excluido de Demo Videos,
            redes sociales y cualquier publicación.
          </p>
        )}

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Contacto</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              <dt className="text-vs-tinta-3">Teléfono</dt>
              <dd className="tabular-nums">{alumno.telefono ?? "—"}</dd>
              <dt className="text-vs-tinta-3">Correo</dt>
              <dd className="break-all">{alumno.email ?? "—"}</dd>
              <dt className="text-vs-tinta-3">Dirección</dt>
              <dd>{alumno.direccion ?? "—"}</dd>
              <dt className="text-vs-tinta-3">Colonia</dt>
              <dd>{alumno.colonia ?? "—"}</dd>
            </dl>
          </section>

          <section className="rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">
              {tutores.length === 1 ? "Tutor" : "Tutores"}
            </h2>
            {tutores.length === 0 ? (
              <p className="mt-3 text-sm text-vs-tinta-3">
                {menor
                  ? "⚠ Alumno menor de edad sin tutor registrado."
                  : "Sin tutor registrado."}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {tutores.map((t) => (
                  <li key={t.id} className="text-sm">
                    <p className="font-medium">
                      {t.nombre}
                      <span className="ml-2 font-normal text-vs-tinta-3">{t.parentesco}</span>
                      {t.esResponsablePago && (
                        <span className="ml-2 rounded bg-vs-amarillo-suave px-1.5 py-0.5 text-[10px] font-semibold">
                          responsable de pago
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-vs-tinta-2 tabular-nums">
                      {[t.telefono, t.whatsapp !== t.telefono ? t.whatsapp : null, t.email]
                        .filter(Boolean).join(" · ") || "Sin contacto"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Objetivo y experiencia</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              <dt className="text-vs-tinta-3">Objetivo</dt>
              <dd>{alumno.objetivoMusical ?? "—"}</dd>
              <dt className="text-vs-tinta-3">Experiencia</dt>
              <dd>{alumno.experienciaPrevia ?? "—"}</dd>
              <dt className="text-vs-tinta-3">Notas</dt>
              <dd>{alumno.observaciones ?? "—"}</dd>
            </dl>
          </section>

          <section className="rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Privacidad y credencial</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              <dt className="text-vs-tinta-3">Aviso de privacidad</dt>
              <dd>{privacidad?.otorgado ? "Dado a conocer" : "⚠ Sin registro"}</dd>
              <dt className="text-vs-tinta-3">Uso de imagen</dt>
              <dd>{imagen?.otorgado ? "Autorizado" : "No autorizado"}</dd>
              <dt className="text-vs-tinta-3">Otorgado por</dt>
              <dd>{privacidad?.otorgadoPor ?? "—"}</dd>
              <dt className="text-vs-tinta-3">Credencial</dt>
              <dd>
                {credencial?.entregadaEn
                  ? `Entregada el ${credencial.entregadaEn}`
                  : `Por entregar a partir del ${credencial?.emitirDesde ?? "—"}`}
              </dd>
            </dl>
          </section>
        </div>

        <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">
              Consideraciones de salud y aprendizaje
            </h2>
            <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-800">
              Datos sensibles
            </span>
          </div>

          {!puedeVerSalud ? (
            <p className="mt-3 text-sm text-vs-tinta-3">
              Tu cuenta no tiene permiso para ver esta sección.
            </p>
          ) : !salud ? (
            <p className="mt-3 text-sm text-vs-tinta-3">Sin consideraciones registradas.</p>
          ) : (
            <>
              <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                {([
                  ["Condición de salud", salud.condicionSalud],
                  ["Aprendizaje / neurodesarrollo", salud.trastornoAprendizaje],
                  ["Discapacidad sensorial", salud.discapacidadSensorial],
                  ["Medicamentos", salud.medicamentos],
                  ["Consideración emocional", salud.consideracionEmocional],
                  ["Observaciones", salud.observaciones],
                ] as const).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-vs-tinta-3">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-vs-tinta-3">
                Guardado cifrado. Esta consulta quedó registrada en bitácora.
              </p>
            </>
          )}
        </section>

        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">
              Inscripciones <span className="text-vs-tinta-3">({inscripciones.length})</span>
            </h2>
            <Link
              id="ver-estatus"
              href={`/alumnos/${alumno.id}/estatus`}
              className="rounded-lg border border-vs-linea bg-white px-3.5 py-1.5 text-sm
                         font-semibold no-underline transition hover:border-vs-naranja-700"
            >
              Estatus
            </Link>
            {tienePermiso(sesion, "comunicacion.redactar") && (
              <Link
                id="escribir-al-tutor"
                href={`/comunicacion/redactar?alumno=${alumno.id}`}
                className="rounded-lg border border-vs-linea bg-white px-3.5 py-1.5 text-sm
                           font-semibold no-underline transition hover:border-vs-naranja-700"
              >
                Escribir al tutor
              </Link>
            )}
            {puedeInscribir && (
              <Link
                href={`/alumnos/${alumno.id}/inscribir`}
                className="rounded-lg bg-vs-naranja px-3.5 py-1.5 text-sm font-semibold text-vs-tinta
                           no-underline transition hover:bg-vs-naranja-claro
                           focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-vs-naranja-700"
              >
                Inscribir en un programa
              </Link>
            )}
          </div>

          {inscripciones.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Sin inscripciones. Un alumno puede tener varias a la vez si son instrumentos
              distintos.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {inscripciones.map((i) => (
                <Link
                  key={i.id}
                  href={`/inscripciones/${i.id}`}
                  className="rounded-xl border border-vs-linea bg-white p-4 no-underline
                             transition hover:border-vs-naranja-700"
                >
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{i.programa}</span>
                    <span className="text-xs text-vs-tinta-3">{i.instrumento}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-vs-tinta-3">{i.docente}</p>

                  {i.cicloId ? (
                    <p className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-2xl font-semibold tabular-nums">
                        {i.saldo}
                      </span>
                      <span className="text-xs text-vs-tinta-3">
                        de {i.contratadas} clases · período {i.cicloNumero}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-vs-tinta-3">Sin período abierto</p>
                  )}

                  {i.terminaEl && (
                    <p className="mt-1 text-xs text-vs-tinta-3">Cierra el {i.terminaEl}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {verFinanzas && (
          <section className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-4">
                <h2 className="font-display text-xl font-semibold">Cobranza</h2>
                {puedeCobrar && (
                  <Link
                    href={`/alumnos/${alumno.id}/cargos/nuevo`}
                    className="text-sm font-medium text-vs-naranja-700 no-underline hover:underline"
                  >
                    + Cargo
                  </Link>
                )}
              </div>
              <p className="text-sm">
                <span className="text-vs-tinta-3">Adeudo: </span>
                <span id="adeudo-total" className={`font-semibold tabular-nums ${cobranza.porCobrarCentavos > 0 ? "text-vs-naranja-700" : ""}`}>
                  {pesos(cobranza.porCobrarCentavos)}
                </span>
                {cobranza.vencidoCentavos > 0 && (
                  <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
                    {pesos(cobranza.vencidoCentavos)} vencido
                  </span>
                )}
              </p>
            </div>

            {cargos.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-6 text-center text-sm text-vs-tinta-3">
                Sin cargos. Se generan al abrir o renovar un período.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                      <th className="px-4 py-2.5 text-left font-semibold">Concepto</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Periodo</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Vence</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Cargo</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Adeudo</th>
                      {verFinanzas && <th className="px-4 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {cargos.map((c) => (
                      <tr key={c.id} className="border-t border-vs-linea">
                        <td className="px-4 py-2.5">{c.descripcion}</td>
                        <td className="px-4 py-2.5 text-xs text-vs-tinta-3">{c.periodo ?? "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{c.venceEl}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-3">
                          {pesos(c.montoCentavos)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {adeudoDe(c) === 0
                            ? <span className="text-green-800">saldado</span>
                            : pesos(adeudoDe(c))}
                        </td>
                        {verFinanzas && (
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/alumnos/${alumno.id}/cargos/${c.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-vs-linea
                                         bg-vs-crema px-2.5 py-1 text-xs font-medium text-vs-tinta-2
                                         transition hover:border-vs-naranja-700 hover:text-vs-naranja-700"
                            >
                              ✎ Editar
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {cargosCancelados.length > 0 && puedeCobrar && (
              <details className="mt-3">
                <summary className="cursor-pointer select-none text-xs text-vs-tinta-3 hover:text-vs-tinta">
                  {cargosCancelados.length} cargo{cargosCancelados.length !== 1 ? "s" : ""} cancelado{cargosCancelados.length !== 1 ? "s" : ""} — clic para ver
                </summary>
                <div className="mt-2 overflow-x-auto rounded-lg border border-dashed border-vs-linea bg-white">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                        <th className="px-4 py-2 text-left font-semibold">Concepto</th>
                        <th className="px-4 py-2 text-left font-semibold">Periodo</th>
                        <th className="px-4 py-2 text-left font-semibold">Vence</th>
                        <th className="px-4 py-2 text-right font-semibold">Monto</th>
                        <th className="px-4 py-2 text-left font-semibold">Motivo</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {cargosCancelados.map((c) => (
                        <tr key={c.id} className="border-t border-vs-linea opacity-60">
                          <td className="px-4 py-2 line-through">{c.descripcion}</td>
                          <td className="px-4 py-2 text-xs text-vs-tinta-3">{c.periodo ?? "—"}</td>
                          <td className="px-4 py-2 tabular-nums">{c.venceEl}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{pesos(c.montoCentavos)}</td>
                          <td className="px-4 py-2 text-xs text-vs-tinta-3">{c.motivoCancelacion ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <BotonReactivar cargoId={c.id} alumnoId={alumno.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {pagos.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-vs-tinta-3">
                  Pagos recibidos
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {pagos.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4">
                      <span className="tabular-nums text-vs-tinta-3">{p.recibidoEl}</span>
                      <span className="font-medium tabular-nums">{pesos(p.montoCentavos)}</span>
                      <span className="text-xs text-vs-tinta-3">{p.metodo}</span>
                      {p.reciboId && (
                        <Link href={`/recibos/${p.reciboId}`} className="font-mono text-xs no-underline hover:underline">
                          {p.folio}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {puedeCobrar && (
              <div className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
                <h3 className="font-display text-lg font-semibold">Registrar un pago</h3>
                <div className="mt-4">
                  <Cobrar
                    alumnoId={alumno.id}
                    hoy={hoyMx}
                    adeudoTotal={cobranza.porCobrarCentavos}
                    adeudoTexto={
                      cobranza.porCobrarCentavos > 0
                        ? `Se aplicará primero al cargo más antiguo. Adeudo total: ${pesos(cobranza.porCobrarCentavos)}.`
                        : "Sin adeudos: lo que se cobre quedará a favor del alumno."
                    }
                    puedeDescontar={puedeDescontar}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-5 rounded-xl border border-dashed border-vs-linea p-8 text-center">
          <p className="text-sm text-vs-tinta-3">
            La línea de tiempo —clases, asistencias, planeaciones y pagos— aparece a partir
            de la etapa E4.
          </p>
        </section>
      </main>
    </>
  );
}
