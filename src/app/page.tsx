import Image from "next/image";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bitacora, configuracion, usuarios } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirSesionUsable, tienePermiso } from "@/lib/auth/permisos";
import { alertasDe, clasesDeHoy, indicadores, ultimoRespaldo } from "@/lib/datos/tablero";
import { contarPorSeveridad, type Severidad } from "@/lib/dominio/alertas";
import { fechaLarga, hora, saludo } from "@/lib/formato";
import { hoyEnMexico, horaCivil } from "@/lib/zona";

// Lee la base en cada visita: nada se prerenderiza en tiempo de build.
export const dynamic = "force-dynamic";

const TITULO_ROL = { director: "Director", docente: "Maestro", asistente: "Asistente" } as const;

const ESTILO: Record<Severidad, string> = {
  urgente: "border-red-300 bg-red-50",
  pronto: "border-amber-300 bg-amber-50",
  informativa: "border-vs-linea bg-white",
};

const ETIQUETA: Record<Severidad, string> = {
  urgente: "Urgente", pronto: "Pronto", informativa: "Cuando puedas",
};

const ESTADO_CLASE: Record<string, string> = {
  programada: "Por registrar", asistio: "Asistió", falta: "Falta",
  falta_justificada: "Falta justificada", cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

export default async function Inicio() {
  // Sin sesión, esta pantalla no existe. El guardián vive aquí y no en un
  // middleware: así una pantalla nueva sin guardia no obtiene datos.
  const sesion = await exigirSesionUsable();
  const alcance = alcanceDe(sesion);
  const verFinanzas = tienePermiso(sesion, "finanzas.leer");

  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );

  const ahora = new Date();
  const hoy = hoyEnMexico();
  const alertas = alertasDe(
    alcance, verFinanzas, hoy,
    tienePermiso(sesion, "prospectos.leer"),
    tienePermiso(sesion, "comunicacion.aprobar"),
    ultimoRespaldo(),
    tienePermiso(sesion, "inventario.gestionar"),
    tienePermiso(sesion, "recitales.gestionar"),
  );
  const cuenta = contarPorSeveridad(alertas);
  const agenda = clasesDeHoy(alcance, hoy);
  const ind = indicadores(alcance, hoy);
  const visibles = alertas.slice(0, 12);

  const movimientos = tienePermiso(sesion, "bitacora.leer")
    ? db
        .select({
          id: bitacora.id,
          accion: bitacora.accion,
          creadoEn: bitacora.creadoEn,
          ip: bitacora.ip,
          usuario: usuarios.nombre,
        })
        .from(bitacora)
        .leftJoin(usuarios, eq(usuarios.id, bitacora.usuarioId))
        .orderBy(desc(bitacora.creadoEn))
        .limit(6)
        .all()
    : [];

  const tarjetas = [
    { t: "Alumnos activos", v: ind.alumnosActivos, n: "Con inscripción vigente" },
    { t: "Inscripciones", v: ind.inscripcionesActivas, n: "Programa · instrumento" },
    { t: "Clases hoy", v: ind.clasesHoy, n: fechaLarga(ahora).split(",")[0] },
    { t: "Próximos 7 días", v: ind.clasesEstaSemana, n: "Clases agendadas" },
  ];

  return (
    <>
      <Encabezado sesion={sesion} activo="tablero" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
              {cfg.academia_nombre}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {saludo(ahora)}, {TITULO_ROL[sesion.rol]} {sesion.nombre} 🎶
            </h1>
            <p className="mt-1 text-sm text-vs-tinta-3 tabular-nums">
              {fechaLarga(ahora)} · Son las {hora(ahora)}
            </p>
          </div>
          <Image
            src="/mascota-violinistar.png"
            alt="VioliniStar"
            width={100}
            height={100}
            className="shrink-0 drop-shadow-sm"
            priority
          />
        </header>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map((x) => (
            <div key={x.t} className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{x.t}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.v}</dd>
              <dd className="mt-0.5 text-[11px] text-vs-tinta-3">{x.n}</dd>
            </div>
          ))}
        </dl>

        {/* ---------------------------------------------------------- alertas */}
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="titulo-pendientes" className="font-display text-xl font-semibold">
              Pendientes
              {alertas.length > 0 && (
                <span className="ml-2 text-vs-tinta-3">({alertas.length})</span>
              )}
            </h2>
            {cuenta.urgente > 0 && (
              <p id="cuenta-urgente" className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                {cuenta.urgente} urgente{cuenta.urgente === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {alertas.length === 0 ? (
            <p id="sin-pendientes"
               className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Nada pendiente. Todo registrado, todo al corriente. 🎶
            </p>
          ) : (
            <ul id="lista-alertas" className="mt-3 flex flex-col gap-2">
              {visibles.map((a, i) => (
                <li key={`${a.clase}-${a.href}-${i}`} data-severidad={a.severidad}>
                  <Link
                    href={a.href}
                    className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-4 py-3
                                no-underline transition hover:border-vs-naranja-700 ${ESTILO[a.severidad]}`}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-vs-tinta-3">
                      {ETIQUETA[a.severidad]}
                    </span>
                    <span className="font-medium">{a.titulo}</span>
                    <span className="text-sm text-vs-tinta-2">{a.detalle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {alertas.length > visibles.length && (
            <p className="mt-2 text-xs text-vs-tinta-3">
              Y {alertas.length - visibles.length} pendiente(s) más, ordenados por urgencia.
            </p>
          )}
        </section>

        {/* ------------------------------------------------------ agenda de hoy */}
        <section className="mt-9">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Hoy en la academia</h2>
            <Link href="/agenda" className="text-sm no-underline hover:underline">
              Ver la agenda completa →
            </Link>
          </div>

          {agenda.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              No hay clases agendadas para hoy.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table id="agenda-hoy" className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Hora</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Alumno</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Programa</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Maestro</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.map((c) => (
                    <tr key={c.id} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 tabular-nums">
                        <Link href={`/clases/${c.id}`} className="font-medium no-underline hover:underline">
                          {horaCivil(c.iniciaEn)}
                        </Link>
                        <span className="ml-1.5 text-[11px] text-vs-tinta-3">{c.minutos} min</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/alumnos/${c.alumnoId}`} className="no-underline hover:underline">
                          {c.alumno}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">
                        {c.programa}
                        {c.modalidad === "en_linea" && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-vs-naranja-700">
                            en línea
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">{c.docente}</td>
                      <td className="px-4 py-2.5">
                        {c.estado === "programada" ? (
                          <Link href={`/clases/${c.id}`}
                                className="font-medium text-vs-naranja-700 no-underline hover:underline">
                            Registrar
                          </Link>
                        ) : (
                          <span className="text-vs-tinta-2">{ESTADO_CLASE[c.estado] ?? c.estado}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {movimientos.length > 0 && (
          <section className="mt-9">
            <h2 className="font-display text-xl font-semibold">Últimos movimientos</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Cuándo</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Quién</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Acción</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 tabular-nums text-vs-tinta-2">{hora(m.creadoEn)}</td>
                      <td className="px-4 py-2.5">{m.usuario ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{m.accion}</td>
                      <td className="px-4 py-2.5 text-vs-tinta-3">{m.ip ?? "local"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-xs text-vs-tinta-3">
              La bitácora no se edita ni se borra. Es la respuesta a «quién cambió esto y cuándo».
            </p>
          </section>
        )}

        <footer className="mt-12 border-t border-vs-linea pt-6 text-xs text-vs-tinta-3">
          <Link href="/catalogo" className="no-underline hover:underline">
            Catálogo y reglas del contrato
          </Link>
          {" · "}{cfg.academia_domicilio} · Tel. {cfg.academia_telefono}
        </footer>
      </main>
    </>
  );
}
