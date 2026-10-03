import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { embudo, listarProspectos } from "@/lib/datos/prospectos";
import {
  ABIERTAS, NOMBRE_ETAPA, abiertosEn, estadoDeSeguimiento, siguienteAccion,
  tasaConversion, type Etapa,
} from "@/lib/dominio/prospectos";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

const COLOR_SEG: Record<string, string> = {
  vencido: "border-red-300 bg-red-50",
  hoy: "border-amber-300 bg-amber-50",
  sin_agendar: "border-amber-300 bg-amber-50",
  programado: "border-vs-linea bg-white",
};

const ORIGEN: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  recomendacion: "Recomendación", paso_por_la_calle: "Pasó por la calle",
  whatsapp: "WhatsApp", google: "Google", evento: "Evento", otro: "Otro",
};

export default async function Prospectos({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>;
}) {
  const sesion = await exigirPermiso("prospectos.leer");
  const { etapa } = await searchParams;
  const hoy = hoyEnMexico();

  const filtro = (etapa && [...ABIERTAS, "convertido", "perdido"].includes(etapa)
    ? etapa as Etapa
    : "abiertos") as Etapa | "abiertos";

  const filas = listarProspectos(filtro);
  const e = embudo();
  const tasa = tasaConversion(e);
  const puedeCrear = tienePermiso(sesion, "prospectos.crear");

  const pestañas: { clave: string; texto: string; n: number }[] = [
    { clave: "abiertos", texto: "En juego", n: abiertosEn(e) },
    ...ABIERTAS.map((k) => ({ clave: k, texto: NOMBRE_ETAPA[k], n: e[k] })),
    { clave: "convertido", texto: "Convertidos", n: e.convertido },
    { clave: "perdido", texto: "Perdidos", n: e.perdido },
  ];

  return (
    <>
      <Encabezado sesion={sesion} activo="prospectos" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Prospectos</h1>
            <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
              Un prospecto rara vez se pierde por falta de interés: se pierde porque nadie
              volvió a escribirle. Aquí arriba está a quién toca buscar hoy.
            </p>
          </div>
          {puedeCrear && (
            <Link
              href="/prospectos/nuevo"
              className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                         no-underline transition hover:bg-vs-naranja-claro"
            >
              Registrar prospecto
            </Link>
          )}
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-3">
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">En juego</dt>
            <dd id="en-juego" className="mt-1 font-display text-2xl font-semibold tabular-nums">
              {abiertosEn(e)}
            </dd>
          </div>
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Convertidos</dt>
            <dd id="convertidos" className="mt-1 font-display text-2xl font-semibold tabular-nums">
              {e.convertido}
            </dd>
          </div>
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
              Conversión sobre cerrados
            </dt>
            <dd id="tasa-conversion" className="mt-1 font-display text-2xl font-semibold tabular-nums">
              {tasa === null ? "—" : `${tasa.toFixed(0)} %`}
            </dd>
            <dd className="mt-0.5 text-[11px] text-vs-tinta-3">
              {e.convertido + e.perdido} cerrado{e.convertido + e.perdido === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>

        <nav className="mt-6 flex flex-wrap gap-1.5 text-sm">
          {pestañas.map((t) => (
            <Link
              key={t.clave}
              href={`/prospectos?etapa=${t.clave}`}
              aria-current={filtro === t.clave ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 no-underline transition ${
                filtro === t.clave
                  ? "border-vs-naranja bg-vs-amarillo-suave font-medium"
                  : "border-vs-linea bg-white hover:border-vs-naranja-700"
              }`}
            >
              {t.texto} <span className="text-vs-tinta-3">({t.n})</span>
            </Link>
          ))}
        </nav>

        {filas.length === 0 ? (
          <p id="sin-prospectos"
             className="mt-5 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
            Nada en esta etapa.
          </p>
        ) : (
          <ul id="lista-prospectos" className="mt-5 flex flex-col gap-2">
            {filas.map((f) => {
              const seg = estadoDeSeguimiento(f.proximoSeguimientoEl, hoy);
              const accion = siguienteAccion({
                estado: f.estado,
                proximoSeguimientoEl: f.proximoSeguimientoEl,
                claseMuestraEl: f.claseMuestraEl,
                claseMuestraAsistio: f.claseMuestraAsistio,
                ultimoContactoEl: f.ultimoContactoEl,
              }, hoy);
              return (
                <li key={f.id} data-seguimiento={seg} data-etapa={f.estado}>
                  <Link
                    href={`/prospectos/${f.id}`}
                    className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-4 py-3
                                no-underline transition hover:border-vs-naranja-700 ${COLOR_SEG[seg]}`}
                  >
                    <span className="font-medium">{f.nombre}</span>
                    <span className="rounded bg-vs-crema px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-vs-tinta-3">
                      {NOMBRE_ETAPA[f.estado]}
                    </span>
                    <span className="text-xs text-vs-tinta-3">
                      {ORIGEN[f.origen] ?? f.origen}
                      {f.programa ? ` · ${f.programa}` : ""}
                      {f.contactos > 0 ? ` · ${f.contactos} contacto${f.contactos === 1 ? "" : "s"}` : ""}
                    </span>
                    <span className="ml-auto text-sm text-vs-tinta-2">{accion}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
