import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { agendaEntre } from "@/lib/datos/clases";
import { fechaLarga } from "@/lib/formato";
import { hoyEnMexico, horaCivil, instanteEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

const ESTADO_ESTILO: Record<string, string> = {
  programada: "bg-vs-crema text-vs-tinta-2",
  asistio: "bg-green-50 text-green-800",
  falta: "bg-red-50 text-red-800",
  falta_justificada: "bg-amber-50 text-amber-900",
  cancelada: "bg-vs-crema text-vs-tinta-3 line-through",
  reprogramada: "bg-vs-crema text-vs-tinta-3 line-through",
};

const ESTADO_TEXTO: Record<string, string> = {
  programada: "Programada",
  asistio: "Asistió",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

function sumarDiasTexto(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a!, m! - 1, d! + dias));
  return t.toISOString().slice(0, 10);
}

export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; vista?: string }>;
}) {
  const sesion = await exigirPermiso("clases.leer");
  const { dia, vista } = await searchParams;

  const hoy = hoyEnMexico();
  const base = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : hoy;
  const porSemana = vista === "semana";

  // La semana arranca en lunes, como la agenda de la academia.
  const diaSemana = new Date(`${base}T12:00:00Z`).getUTCDay();
  const desplazamiento = (diaSemana + 6) % 7;
  const inicio = porSemana ? sumarDiasTexto(base, -desplazamiento) : base;
  const dias = porSemana ? 7 : 1;
  const fin = sumarDiasTexto(inicio, dias);

  const clases = agendaEntre(
    instanteEnMexico(inicio, "00:00"),
    instanteEnMexico(fin, "00:00"),
    alcanceDe(sesion),
  );

  const porDia = new Map<string, typeof clases>();
  for (let i = 0; i < dias; i++) porDia.set(sumarDiasTexto(inicio, i), []);
  for (const c of clases) {
    const f = hoyEnMexico(c.iniciaEn);
    porDia.get(f)?.push(c);
  }

  const ruta = (d: string, v: string) => `/agenda?dia=${d}&vista=${v}`;
  const paso = porSemana ? 7 : 1;

  return (
    <>
      <Encabezado sesion={sesion} activo="agenda" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Agenda</h1>
            <p className="mt-1 text-sm text-vs-tinta-3">
              {porSemana
                ? `Semana del ${inicio} al ${sumarDiasTexto(inicio, 6)}`
                : fechaLarga(new Date(`${base}T12:00:00Z`))}
              {alcanceDe(sesion).tipo === "propio" && " · solo tus clases"}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Link href={ruta(sumarDiasTexto(inicio, -paso), porSemana ? "semana" : "dia")}
                  className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 no-underline">
              ←
            </Link>
            <Link href={ruta(hoy, porSemana ? "semana" : "dia")}
                  className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 no-underline">
              Hoy
            </Link>
            <Link href={ruta(sumarDiasTexto(inicio, paso), porSemana ? "semana" : "dia")}
                  className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 no-underline">
              →
            </Link>
            <span className="ml-2 inline-flex overflow-hidden rounded-lg border border-vs-linea">
              <Link href={ruta(base, "dia")}
                    className={`px-3 py-1.5 no-underline ${!porSemana ? "bg-vs-amarillo-suave font-medium" : "bg-white"}`}>
                Día
              </Link>
              <Link href={ruta(base, "semana")}
                    className={`border-l border-vs-linea px-3 py-1.5 no-underline ${porSemana ? "bg-vs-amarillo-suave font-medium" : "bg-white"}`}>
                Semana
              </Link>
            </span>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-5">
          {[...porDia.entries()].map(([fecha, lista]) => (
            <section key={fecha}>
              {porSemana && (
                <h2 className={`mb-2 text-sm font-medium ${fecha === hoy ? "text-vs-naranja-700" : "text-vs-tinta-3"}`}>
                  {fechaLarga(new Date(`${fecha}T12:00:00Z`))}
                  {fecha === hoy && " · hoy"}
                </h2>
              )}

              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed border-vs-linea bg-white px-4 py-5 text-center text-sm text-vs-tinta-3">
                  Sin clases.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lista.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/clases/${c.id}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border
                                   border-vs-linea bg-white px-4 py-3 no-underline transition
                                   hover:border-vs-naranja-700"
                      >
                        <span className="font-mono text-sm tabular-nums">
                          {horaCivil(c.iniciaEn)}–{horaCivil(c.terminaEn)}
                        </span>
                        <span className="font-medium">{c.alumno}</span>
                        <span className="text-xs text-vs-tinta-3">
                          {c.instrumento} · {c.docente}
                        </span>
                        <span className="text-xs text-vs-tinta-3">
                          {c.modalidad === "en_linea" ? "En línea" : (c.aula ?? "Sin cubículo")}
                        </span>
                        {c.origen === "recuperacion" && (
                          <span className="rounded bg-vs-amarillo-suave px-1.5 py-0.5 text-[10px] font-semibold">
                            recuperación
                          </span>
                        )}
                        <span className={`ml-auto rounded px-2 py-0.5 text-[11px] font-semibold ${ESTADO_ESTILO[c.estado]}`}>
                          {ESTADO_TEXTO[c.estado]}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs text-vs-tinta-3">
          Las clases se agendan desde la inscripción del alumno. La academia tiene dos
          cubículos: el sistema avisa antes de guardar si hay choque de alumno, maestro o aula.
        </p>
      </main>
    </>
  );
}
