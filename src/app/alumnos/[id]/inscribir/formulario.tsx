"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { inscribir, type EstadoInscripcion } from "./acciones";

type Programa = {
  id: number; nombre: string; descripcion: string;
  clases: number; minutos: number; precio: number; alumnosIncluidos: number;
};
type Opcion = { id: number; nombre: string };
type PlanFamiliar = {
  inscripcionId: number; titular: string; titularCodigo: string;
  alumnosIncluidos: number; ocupados: number; restantes: number; tutorEnComun: boolean;
};

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                 transition hover:bg-vs-naranja-claro focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700
                 disabled:opacity-60"
    >
      {pending ? "Inscribiendo…" : "Crear inscripción"}
    </button>
  );
}

type TutorOpcion = { id: number; nombre: string; parentesco: string; esResponsablePago: boolean };

export function FormularioInscripcion({
  alumnoId, alumnoNombre, esAdulto, tutores, programas, instrumentos, docentes, planesFamiliares, hoy,
}: {
  alumnoId: number; alumnoNombre: string; esAdulto: boolean; tutores: TutorOpcion[];
  programas: Programa[]; instrumentos: Opcion[];
  docentes: Opcion[]; planesFamiliares: Record<number, PlanFamiliar[]>; hoy: string;
}) {
  const [estado, accion] = useActionState<EstadoInscripcion, FormData>(inscribir, {});
  const [programaId, setProgramaId] = useState<number | null>(null);
  const [cubiertaPor, setCubiertaPor] = useState<string>("");

  const elegido = programas.find((p) => p.id === programaId);
  const esFamiliar = (elegido?.alumnosIncluidos ?? 1) > 1;
  const planes = (programaId !== null ? planesFamiliares[programaId] : undefined) ?? [];
  const seSuma = cubiertaPor !== "";
  const planElegido = planes.find((pl) => String(pl.inscripcionId) === cubiertaPor);
  const pideConfirmar = planElegido !== undefined && !planElegido.tutorEnComun;
  const conTutor = planes.filter((pl) => pl.tutorEnComun);
  const sinTutor = planes.filter((pl) => !pl.tutorEnComun);
  const pesos = (c: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 })
      .format(c / 100);

  const tarjetas = (lista: PlanFamiliar[]) => (
    <>
      {lista.map((pl) => (
              <label
                key={pl.inscripcionId}
                htmlFor={`plan-${pl.inscripcionId}`}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  cubiertaPor === String(pl.inscripcionId)
                    ? "border-vs-naranja bg-vs-crema"
                    : "border-vs-linea hover:border-vs-line-strong"
                }`}
              >
                <input
                  id={`plan-${pl.inscripcionId}`} type="radio" name="cubiertaPorId"
                  value={pl.inscripcionId} className="mt-1"
                  onChange={() => setCubiertaPor(String(pl.inscripcionId))}
                />
                <span>
                  <span className="text-sm font-medium">
                    Sumarlo al plan de {pl.titular}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-vs-tinta-3">
                    {pl.titularCodigo}
                  </span>
                  <span className="mt-0.5 block text-xs text-vs-tinta-3">
                    Ocupa {pl.ocupados + 1} de {pl.alumnosIncluidos} lugares ·{" "}
                    {pl.restantes} libre{pl.restantes === 1 ? "" : "s"}. Su período abre en $0:
                    la mensualidad la sigue pagando {pl.titular.split(" ")[0]}.
                  </span>
                </span>
              </label>
            ))}
    </>
  );

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="alumnoId" value={alumnoId} />

      {estado.error && (
        <p id="error-inscripcion" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Programa</h2>
        <div className="mt-4 flex flex-col gap-2">
          {programas.map((p) => (
            <label
              key={p.id}
              htmlFor={`programa-${p.id}`}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                programaId === p.id
                  ? "border-vs-naranja bg-vs-crema"
                  : "border-vs-linea hover:border-vs-line-strong"
              }`}
            >
              <input
                id={`programa-${p.id}`}
                type="radio"
                name="programaId"
                value={p.id}
                className="mt-1"
                onChange={() => setProgramaId(p.id)}
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="tabular-nums font-semibold">{pesos(p.precio)}</span>
                </span>
                <span className="mt-0.5 block text-xs text-vs-tinta-3">
                  {p.descripcion} ·{" "}
                  {p.alumnosIncluidos > 1
                    ? `${(p.clases * p.minutos) / 60} h al mes por alumno · ${
                        (p.clases * p.minutos * p.alumnosIncluidos) / 60} h en total`
                    : `${(p.clases * p.minutos) / 60} horas al mes`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {esFamiliar && (
        <section className="rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Plan familiar</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            El precio de {pesos(elegido?.precio ?? 0)} cubre a {elegido?.alumnosIncluidos} alumnos
            y lo carga una sola inscripción, la titular. Cada hermano recibe sus propias clases
            individuales con su maestro y su horario.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="titular-nuevo"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                !seSuma ? "border-vs-naranja bg-vs-crema" : "border-vs-linea"
              }`}
            >
              <input
                id="titular-nuevo" type="radio" name="cubiertaPorId" value=""
                className="mt-1" defaultChecked onChange={() => setCubiertaPor("")}
              />
              <span>
                <span className="text-sm font-medium">Abrir un plan nuevo</span>
                <span className="mt-0.5 block text-xs text-vs-tinta-3">
                  {esAdulto
                    ? <>{alumnoNombre} es la titular: el plan de {pesos(elegido?.precio ?? 0)} se le carga a ella.</>
                    : <>El titular es el adulto que paga: el plan de {pesos(elegido?.precio ?? 0)} se le carga a su cuenta, no a la del alumno.</>}
                  {" "}Los familiares se suman después.
                </span>
              </span>
            </label>

            {conTutor.length > 0 && tarjetas(conTutor)}

            {sinTutor.length > 0 && (
              <>
                <p className="mt-2 text-xs font-medium text-vs-tinta-2">
                  {conTutor.length > 0 ? "Otros planes con lugar libre" : "Planes con lugar libre"}{" "}
                  <span className="font-normal text-vs-tinta-3">
                    — no comparten tutor: al elegir uno confirmas que son familia
                  </span>
                </p>
                {tarjetas(sinTutor)}
              </>
            )}
          </div>

          {!seSuma && !esAdulto && (
            <div className="mt-3 rounded-lg border border-vs-naranja bg-vs-crema px-3 py-3">
              <label htmlFor="responsableTutorId" className="text-sm font-medium">
                Titular del plan y responsable de pago
              </label>
              {tutores.length === 0 ? (
                <p className="mt-1 text-xs text-vs-tinta-2">
                  {alumnoNombre} es menor de edad y no tiene un tutor registrado. Un menor no puede
                  ser titular: registra primero al tutor que paga en{" "}
                  <Link href={`/alumnos/${alumnoId}/editar`} className="underline">Editar datos</Link>.
                </p>
              ) : (
                <>
                  <select
                    id="responsableTutorId" name="responsableTutorId" required className={`${campo} mt-1.5 w-full`}
                    defaultValue={String((tutores.find((t) => t.esResponsablePago) ?? tutores[0])?.id ?? "")}
                  >
                    {tutores.map((t) => (
                      <option key={t.id} value={t.id}>{t.nombre} · {t.parentesco}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-vs-tinta-3">
                    La mensualidad, los recibos y los avisos de adeudo van a su nombre.
                  </p>
                </>
              )}
            </div>
          )}

          {pideConfirmar && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-vs-naranja bg-vs-crema px-3 py-2 text-sm">
              <input type="checkbox" name="familiaConfirmada" value="1" required className="mt-1" />
              <span>
                Confirmo que este alumno y {planElegido?.titular} son familia
                <span className="block text-xs text-vs-tinta-3">
                  No comparten tutor registrado (por ejemplo, abuela y nieta: la abuela es adulta y no
                  tiene tutor). La confirmación queda en la bitácora.
                </span>
              </span>
            </label>
          )}

          {planes.length === 0 && (
            <p className="mt-3 rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-xs text-vs-tinta-2">
              Todavía no hay un plan de este programa con lugar libre. Elige «Abrir un plan nuevo»
              para que este alumno sea el titular; el familiar se suma después, desde su propia
              inscripción.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Materia o instrumento, maestro y horario</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="instrumentoId" className="text-xs font-medium text-vs-tinta-2">
              Materia o instrumento
            </label>
            <select id="instrumentoId" name="instrumentoId" required className={campo} defaultValue="">
              <option value="" disabled>Elige…</option>
              {instrumentos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="docenteId" className="text-xs font-medium text-vs-tinta-2">
              Maestro asignado
            </label>
            {docentes.length === 0 ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No hay maestros dados de alta. Créalos con{" "}
                <code className="font-mono">npm run docente</code>.
              </p>
            ) : (
              <select id="docenteId" name="docenteId" required className={campo} defaultValue="">
                <option value="" disabled>Elige…</option>
                {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fechaInicio" className="text-xs font-medium text-vs-tinta-2">
              Inicio del período
            </label>
            <input
              id="fechaInicio" name="fechaInicio" type="date" required
              defaultValue={hoy} className={campo}
            />
            <span className="text-xs text-vs-tinta-3">
              El período corre desde esta fecha, no del 1 al 30.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notas" className="text-xs font-medium text-vs-tinta-2">
              Notas
            </label>
            <input id="notas" name="notas" className={campo} />
          </div>
        </div>
      </section>

      {elegido && (
        <section className="rounded-xl border border-vs-naranja bg-vs-crema p-5">
          <h2 className="font-display text-lg font-semibold">Al guardar</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            <li>
              Se abre el primer período con{" "}
              <strong>{elegido.clases} {elegido.clases === 1 ? "clase" : "clases"} de{" "}
              {elegido.minutos} minutos</strong>.
            </li>
            <li>
              El libro mayor recibe <strong>+{elegido.clases} créditos</strong> con motivo
              «emisión del ciclo».
            </li>
            {seSuma ? (
              <li>
                El período abre en <strong>$0</strong>: la mensualidad de{" "}
                <strong>{pesos(elegido.precio)}</strong> la lleva el titular del plan familiar,
                y el cargo dirá a quiénes cubre.
              </li>
            ) : (
              <li>
                Se congela el precio en <strong>{pesos(elegido.precio)}</strong>: un cambio de
                tarifa posterior no afectará este contrato.
                {elegido.alumnosIncluidos > 1 && " Cubre a toda la familia."}
              </li>
            )}
            <li>Lo que no se tome al cerrar el período expira (cláusula 4ª).</li>
          </ul>
        </section>
      )}

      <div>
        <Guardar />
      </div>
    </form>
  );
}
