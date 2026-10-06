import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { aulasActivas, clasePorId } from "@/lib/datos/clases";
import { planeacionDeClase, tareasDeClase } from "@/lib/datos/expediente";
import { etiquetaDeEstado } from "@/lib/dominio/asistencia";
import { fechaLarga } from "@/lib/formato";
import { fechaCivil, hoyEnMexico, horaCivil } from "@/lib/zona";
import { Asistencia, Posponer } from "./acciones-cliente";
import { Corregir } from "./corregir";
import { Avance, Planeacion, Tareas } from "./academico";

export const dynamic = "force-dynamic";

export default async function Clase({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("clases.leer");
  const { id } = await params;

  const claseId = Number(id);
  if (!Number.isInteger(claseId)) notFound();

  const clase = clasePorId(claseId, alcanceDe(sesion));
  if (!clase) notFound();

  const puedeRegistrar = tienePermiso(sesion, "asistencia.registrar");
  const puedeReprogramar = tienePermiso(sesion, "clases.reprogramar");
  const puedeCorregir = tienePermiso(sesion, "clases.corregir");
  const puedeAutorizar = tienePermiso(sesion, "clases.autorizar_excepcion");
  const puedePlanear = tienePermiso(sesion, "planeaciones.subir");
  const planeacion = planeacionDeClase(clase.id);
  const tareas = tareasDeClase(clase.id);
  const ahora = new Date();

  const terminal = clase.estado === "reprogramada" || clase.estado === "cancelada";

  return (
    <>
      <Encabezado sesion={sesion} activo="agenda" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/agenda" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Agenda
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{clase.alumno}</h1>
            <p className="mt-1 text-sm text-vs-tinta-2">
              {clase.programa} · {clase.instrumento} · {clase.docente}
            </p>
          </div>
          <span className="rounded-lg bg-vs-crema px-3 py-1.5 text-sm font-semibold">
            {etiquetaDeEstado(clase.estado as never)}
          </span>
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-4">
          {[
            ["Fecha", fechaLarga(clase.iniciaEn)],
            ["Horario", `${horaCivil(clase.iniciaEn)} a ${horaCivil(clase.terminaEn)}`],
            ["Dónde", clase.modalidad === "en_linea" ? "En línea" : (clase.aula ?? "Sin cubículo")],
            ["Duración", `${clase.minutos} min`],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {clase.origen === "recuperacion" && (
          <p className="mt-4 rounded-lg border border-vs-linea bg-vs-crema px-4 py-2.5 text-sm">
            Clase de <strong>recuperación</strong>. No se puede volver a posponer: ya es la
            segunda oportunidad de la original.
          </p>
        )}

        {clase.observaciones && (
          <p className="mt-4 rounded-lg border border-vs-linea bg-white px-4 py-3 text-sm">
            <span className="text-xs uppercase tracking-wider text-vs-tinta-3">Observaciones</span>
            <br />
            {clase.observaciones}
          </p>
        )}

        {terminal ? (
          <p className="mt-7 rounded-lg border border-vs-linea bg-white px-4 py-4 text-sm text-vs-tinta-3">
            Esta clase está {etiquetaDeEstado(clase.estado as never)} y ya no admite cambios.
            {clase.estado === "reprogramada" && " Su recuperación quedó agendada aparte."}
          </p>
        ) : (
          <div className="mt-7 grid gap-5">
            {puedeRegistrar && (
              <section className="rounded-xl border border-vs-linea bg-white p-5">
                <h2 className="font-display text-lg font-semibold">Asistencia</h2>
                <div className="mt-4">
                  <Asistencia claseId={clase.id} estadoActual={clase.estado} minutos={clase.minutos} />
                </div>
              </section>
            )}

            {puedeReprogramar && clase.estado === "programada" && clase.origen !== "recuperacion" && (
              <section className="rounded-xl border border-vs-linea bg-white p-5">
                <h2 className="font-display text-lg font-semibold">Posponer</h2>
                <p className="mt-1 text-sm text-vs-tinta-2">
                  Cláusula 4ª: hacen falta 24 horas de aviso y la recuperación va dentro del
                  mismo período. La clase original no se consume.
                </p>
                <div className="mt-4">
                  <Posponer
                    claseId={clase.id}
                    hoy={hoyEnMexico(ahora)}
                    ahora={horaCivil(ahora)}
                    cierreDePeriodo={clase.cicloTerminaEl}
                    posposicionesUsadas={clase.posposicionesUsadas}
                    puedeAutorizar={puedeAutorizar}
                  />
                </div>
              </section>
            )}

            {/* Corregir va después de Posponer y con menos peso visual: lo normal
                es posponer, y esto es para el error de captura. */}
            {puedeCorregir && clase.estado === "programada" && (
              <section className="rounded-xl border border-vs-linea bg-vs-crema p-5">
                <h2 className="font-display text-lg font-semibold">Corregir el horario</h2>
                <p className="mt-1 text-sm text-vs-tinta-2">
                  Para un error de captura: hora equivocada, cubículo mal elegido o modalidad
                  incorrecta. <strong>No consume posposiciones</strong> ni genera clase de
                  recuperación — si el alumno pidió mover su clase, eso es Posponer. El cambio
                  queda registrado en la bitácora.
                </p>
                <div className="mt-4">
                  <Corregir
                    claseId={clase.id}
                    fecha={fechaCivil(clase.iniciaEn)}
                    hora={horaCivil(clase.iniciaEn)}
                    aulaId={clase.aulaId}
                    modalidad={clase.modalidad}
                    aulas={aulasActivas()}
                  />
                </div>
              </section>
            )}
          </div>
        )}

        {puedePlanear && (
          <div className="mt-5 grid gap-5">
            <section className="rounded-xl border border-vs-linea bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Planeación</h2>
                {!planeacion && clase.estado === "asistio" && (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    pendiente
                  </span>
                )}
              </div>
              <div className="mt-4">
                <Planeacion claseId={clase.id} actual={planeacion ?? null} />
              </div>
            </section>

            <section className="rounded-xl border border-vs-linea bg-white p-5">
              <h2 className="font-display text-lg font-semibold">
                Tareas <span className="text-vs-tinta-3">({tareas.length})</span>
              </h2>
              <div className="mt-4">
                <Tareas claseId={clase.id} tareas={tareas} />
              </div>
            </section>

            <section className="rounded-xl border border-vs-linea bg-white p-5">
              <h2 className="font-display text-lg font-semibold">Avance del alumno</h2>
              <p className="mt-1 text-sm text-vs-tinta-2">
                Queda fechado con el día de la clase, no con el de captura, para que la línea
                de tiempo del alumno no se desordene.
              </p>
              <div className="mt-4">
                <Avance claseId={clase.id} />
              </div>
            </section>
          </div>
        )}

        <p className="mt-7 text-xs text-vs-tinta-3">
          <Link href={`/inscripciones/${clase.inscripcionId}`} className="no-underline hover:underline">
            Ver el libro mayor de esta inscripción →
          </Link>
        </p>
      </main>
    </>
  );
}
