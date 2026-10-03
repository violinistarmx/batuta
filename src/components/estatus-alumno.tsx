import Link from "next/link";

import { diasDePeriodo, type Estatus } from "@/lib/datos/estatus";
import { edad, pesos } from "@/lib/formato";
import { fechaCivil, horaCivil } from "@/lib/zona";

const DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function diaLegible(fecha: string): string {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${DIA[t.getUTCDay()]} ${d} de ${MES[m - 1]}`;
}

/**
 * Tarjeta de estatus: lo que se contesta de pie en el mostrador.
 *
 * El orden es el de la conversación real — quién es, si le quedan clases, cuándo
 * es la siguiente y si debe algo — y no el del modelo de datos. Cada cifra trae su
 * unidad a la vista porque «2» solo no dice si son clases, días o pesos.
 */
export function EstatusAlumno({
  e, hoy, verFinanzas, compacto = false,
}: {
  e: Estatus; hoy: string; verFinanzas: boolean; compacto?: boolean;
}) {
  const años = e.alumno.fechaNacimiento ? edad(e.alumno.fechaNacimiento) : null;
  const sinPeriodo = e.inscripciones.every((i) => i.cicloId === null);
  const saldoTotal = e.inscripciones.reduce((s, i) => s + i.saldo, 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-xl border border-vs-linea bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{e.alumno.nombre}</h2>
          <span id="estatus-codigo" className="font-mono text-sm text-vs-tinta-3">
            {e.alumno.codigo}
          </span>
          {e.alumno.estado !== "activo" && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-800">
              {e.alumno.estado}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-vs-tinta-2">
          {años !== null ? `${años} años` : "Edad sin registrar"}
          {e.tutor && ` · ${e.tutor.parentesco}: ${e.tutor.nombre}`}
          {e.tutor?.telefono && ` · ${e.tutor.telefono}`}
        </p>
      </header>

      {/* ------------------------------------------------ saldo de clases */}
      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Clases disponibles</h3>

        {e.inscripciones.length === 0 ? (
          <p id="estatus-sin-inscripcion" className="mt-2 text-sm text-vs-tinta-2">
            Sin inscripciones activas.
          </p>
        ) : sinPeriodo ? (
          <p id="estatus-sin-periodo" className="mt-2 text-sm text-vs-naranja-700">
            Sin período abierto. Hay que renovar antes de la siguiente clase.
          </p>
        ) : (
          <>
            <p id="estatus-saldo" className="mt-1 font-display text-4xl font-semibold tabular-nums">
              {saldoTotal}
              <span className="ml-2 font-sans text-base font-normal text-vs-tinta-3">
                {saldoTotal === 1 ? "clase" : "clases"}
              </span>
            </p>

            <ul className="mt-3 flex flex-col gap-2">
              {e.inscripciones.map((i) => {
                const dias = diasDePeriodo(i, hoy);
                return (
                  <li key={i.inscripcionId}
                      data-inscripcion={i.inscripcionId}
                      className="rounded-lg border border-vs-linea px-4 py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{i.programa}</span>
                      <span className="tabular-nums">
                        {i.saldo} de {i.contratadas ?? "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-vs-tinta-3">
                      {i.instrumento} · {i.docente}
                      {i.terminaEl && ` · termina el ${i.terminaEl}`}
                      {dias !== null && (
                        dias < 0
                          ? ` · vencido hace ${-dias} día${-dias === 1 ? "" : "s"}`
                          : dias === 0
                            ? " · último día"
                            : ` · quedan ${dias} días`
                      )}
                      {i.posposicionesUsadas !== null && ` · ${i.posposicionesUsadas} de 2 posposiciones`}
                    </p>
                    {i.cubiertaPorId !== null && (
                      <p className="mt-0.5 text-xs text-vs-tinta-3">
                        Incluido en un plan familiar: la mensualidad la lleva el titular.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* -------------------------------------------------- próxima clase */}
      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Próxima clase</h3>
        {e.proxima ? (
          <p id="estatus-proxima" className="mt-1 text-lg">
            {diaLegible(fechaCivil(e.proxima.iniciaEn))}
            {" a las "}
            <strong>{horaCivil(e.proxima.iniciaEn)}</strong>
            <span className="block text-sm text-vs-tinta-2">
              {e.proxima.programa} · {e.proxima.docente} · {e.proxima.minutos} min
            </span>
          </p>
        ) : (
          <p id="estatus-sin-clase" className="mt-1 text-sm text-vs-tinta-2">
            No tiene ninguna clase agendada.
          </p>
        )}
      </section>

      {/* --------------------------------------------------------- adeudo */}
      {verFinanzas && e.adeudoCentavos !== null && (
        <section className={`rounded-xl border p-5 ${
          (e.vencidoCentavos ?? 0) > 0
            ? "border-red-300 bg-red-50"
            : e.adeudoCentavos > 0 ? "border-amber-300 bg-amber-50" : "border-vs-linea bg-white"
        }`}>
          <h3 className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Adeudo</h3>
          <p id="estatus-adeudo" className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {pesos(e.adeudoCentavos)}
          </p>
          {(e.vencidoCentavos ?? 0) > 0 && (
            <p id="estatus-vencido" className="mt-1 text-sm font-medium text-red-800">
              {pesos(e.vencidoCentavos ?? 0)} vencido
            </p>
          )}
          {e.adeudoCentavos === 0 && (
            <p className="mt-1 text-sm text-vs-tinta-2">Al corriente. 🎶</p>
          )}
        </section>
      )}

      {!compacto && (
        <Link
          href={`/alumnos/${e.alumno.id}`}
          className="self-start rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm
                     font-semibold no-underline transition hover:border-vs-naranja-700"
        >
          Abrir el expediente completo →
        </Link>
      )}
    </div>
  );
}
