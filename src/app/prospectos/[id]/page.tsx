import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { tutoresParaVincular } from "@/lib/datos/alumnos";
import {
  posiblesDuplicados, prospectoPorId, seguimientosDe,
} from "@/lib/datos/prospectos";
import {
  ETAPAS, NOMBRE_ETAPA, estadoDeSeguimiento, siguienteAccion,
  transicionValida, type Etapa,
} from "@/lib/dominio/prospectos";
import { hoyEnMexico } from "@/lib/zona";
import { Contactar, Convertir, Etapa as CambiarEtapa } from "./cliente";

export const dynamic = "force-dynamic";

const ORIGEN: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  recomendacion: "Recomendación", paso_por_la_calle: "Pasó por la calle",
  whatsapp: "WhatsApp", google: "Google", evento: "Evento", otro: "Otro",
};

const CANAL: Record<string, string> = {
  whatsapp: "WhatsApp", llamada: "Llamada", mensaje_directo: "Mensaje directo",
  correo: "Correo", presencial: "En la academia", otro: "Otro",
};

const RESULTADO: Record<string, string> = {
  contactado: "Contestó", sin_respuesta: "No contestó",
  agendo_clase_muestra: "Agendó clase muestra", pidio_informacion: "Pidió información",
  rechazo: "Dijo que no", otro: "Otro",
};

const MOTIVO: Record<string, string> = {
  precio: "Precio", horario: "No hay horario que le sirva", distancia: "Distancia",
  no_contesto: "Nunca contestó", eligio_otra: "Eligió otra academia",
  sin_interes: "Perdió el interés", otro: "Otro",
};

export default async function Prospecto({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("prospectos.leer");
  const { id } = await params;

  const prospectoId = Number(id);
  if (!Number.isInteger(prospectoId)) notFound();

  const p = prospectoPorId(prospectoId);
  if (!p) notFound();

  const hoy = hoyEnMexico();
  const contactos = seguimientosDe(p.id);
  const duplicados = posiblesDuplicados(p.telefono, p.nombre, p.id);
  const puedeEditar = tienePermiso(sesion, "prospectos.editar");
  const puedeConvertir = tienePermiso(sesion, "prospectos.convertir");

  const estado = p.estado as Etapa;
  const seg = estadoDeSeguimiento(p.proximoSeguimientoEl, hoy);
  const accion = siguienteAccion({
    estado,
    proximoSeguimientoEl: p.proximoSeguimientoEl,
    claseMuestraEl: p.claseMuestraEl,
    claseMuestraAsistio: p.claseMuestraAsistio,
    ultimoContactoEl: contactos[0]?.fecha ?? null,
  }, hoy);

  // Solo se ofrecen las etapas a las que de verdad se puede ir: un menú con
  // opciones que el servidor rechaza enseña a desconfiar de la pantalla.
  const permitidas = ETAPAS
    .filter((e) => e !== "convertido" && transicionValida(estado, e))
    .map((e) => ({ valor: e, texto: NOMBRE_ETAPA[e] }));

  const listo = estado !== "nuevo" && estado !== "perdido" && p.alumnoId === null;

  return (
    <>
      <Encabezado sesion={sesion} activo="prospectos" />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/prospectos" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Prospectos
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{p.nombre}</h1>
          <span id="etapa-actual"
                className="rounded bg-vs-crema px-2 py-1 text-[11px] uppercase tracking-wider text-vs-tinta-2">
            {NOMBRE_ETAPA[estado]}
          </span>
          {p.edadAproximada !== null && (
            <span className="text-sm text-vs-tinta-3">≈ {p.edadAproximada} años</span>
          )}
        </div>

        {puedeEditar && p.alumnoId === null && (
          <Link
            id="escribir-al-prospecto"
            href={`/comunicacion/redactar?prospecto=${p.id}`}
            className="mt-3 inline-block rounded-lg border border-vs-linea bg-white px-3.5 py-1.5
                       text-sm font-semibold no-underline transition hover:border-vs-naranja-700"
          >
            Escribir un mensaje
          </Link>
        )}

        <p id="siguiente-accion" className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
          seg === "vencido" ? "border-red-300 bg-red-50"
            : seg === "hoy" || seg === "sin_agendar" ? "border-amber-300 bg-amber-50"
            : "border-vs-linea bg-white"
        }`}>
          {accion}
        </p>

        {duplicados.length > 0 && (
          <div id="posibles-duplicados"
               className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
            <p className="font-medium text-amber-900">
              Puede estar duplicado: hay {duplicados.length} prospecto(s) con el mismo nombre o
              teléfono.
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {duplicados.map((d) => (
                <li key={d.id}>
                  <Link href={`/prospectos/${d.id}`}
                        className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs no-underline">
                    {d.nombre} · {NOMBRE_ETAPA[d.estado as Etapa]}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-amber-900">
              No se bloquea: en una familia el teléfono es el mismo para todos los hermanos.
            </p>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-vs-linea bg-white p-5">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Contacto</dt>
              <dd>
                {p.contactoNombre ?? p.nombre}
                {p.contactoParentesco && (
                  <span className="text-vs-tinta-3"> · {p.contactoParentesco}</span>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Teléfono</dt>
              <dd className="tabular-nums">{p.telefono ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">WhatsApp</dt>
              <dd className="tabular-nums">{p.whatsapp ?? p.telefono ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Correo</dt>
              <dd>{p.email ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Interés</dt>
              <dd>
                {p.programa ?? "Sin definir"}
                {p.instrumento ? ` · ${p.instrumento}` : ""}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Origen</dt>
              <dd id="origen">
                {ORIGEN[p.origen] ?? p.origen}
                {p.origenDetalle && <span className="text-vs-tinta-3"> · {p.origenDetalle}</span>}
              </dd>
            </div>
            {p.claseMuestraEl && (
              <div className="flex gap-2">
                <dt className="text-vs-tinta-3">Clase muestra</dt>
                <dd className="tabular-nums">
                  {p.claseMuestraEl}{p.claseMuestraHora ? ` · ${p.claseMuestraHora}` : ""}
                  {p.claseMuestraAsistio !== null && (
                    <span className="ml-2 text-vs-tinta-2">
                      {p.claseMuestraAsistio ? "· asistió" : "· no llegó"}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {p.motivoPerdida && (
              <div className="flex gap-2">
                <dt className="text-vs-tinta-3">Motivo</dt>
                <dd id="motivo-perdida">
                  {MOTIVO[p.motivoPerdida] ?? p.motivoPerdida}
                  {p.motivoDetalle && <span className="text-vs-tinta-3"> · {p.motivoDetalle}</span>}
                </dd>
              </div>
            )}
          </dl>
          {p.notas && (
            <p className="mt-3 border-t border-vs-linea pt-3 text-sm text-vs-tinta-2">{p.notas}</p>
          )}
        </section>

        {p.alumnoId !== null ? (
          <section id="ya-convertido"
                   className="mt-6 rounded-xl border border-vs-naranja bg-vs-crema p-5">
            <h2 className="font-display text-lg font-semibold">Ya es alumno</h2>
            <p className="mt-1 text-sm text-vs-tinta-2">
              Se convirtió el {p.convertidoEn?.toISOString().slice(0, 10)}. De aquí en adelante
              el expediente es el que manda.
            </p>
            <Link href={`/alumnos/${p.alumnoId}`}
                  className="mt-3 inline-block rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold
                             text-vs-tinta no-underline transition hover:bg-vs-naranja-claro">
              Abrir expediente →
            </Link>
          </section>
        ) : (
          <>
            {puedeEditar && (
              <section className="mt-6 rounded-xl border border-vs-linea bg-white p-5">
                <h2 className="font-display text-lg font-semibold">Registrar un contacto</h2>
                <div className="mt-3"><Contactar prospectoId={p.id} hoy={hoy} /></div>
              </section>
            )}

            {puedeEditar && permitidas.length > 0 && (
              <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
                <h2 className="font-display text-lg font-semibold">Mover de etapa</h2>
                <div className="mt-3">
                  <CambiarEtapa
                    prospectoId={p.id}
                    estadoActual={estado}
                    permitidas={permitidas}
                    claseMuestraEl={p.claseMuestraEl}
                    claseMuestraHora={p.claseMuestraHora}
                  />
                </div>
              </section>
            )}

            {puedeConvertir && (
              <section className="mt-5 rounded-xl border border-vs-naranja bg-vs-crema p-5">
                <h2 className="font-display text-lg font-semibold">Convertir en alumno</h2>
                {listo ? (
                  <>
                    <p className="mt-1 text-sm text-vs-tinta-2">
                      Se abre el expediente con estos datos y el prospecto se cierra. El contacto
                      pasa a ser tutor si es otra persona, y la credencial se agenda sola
                      (cláusula 10ª).
                    </p>
                    <div className="mt-4">
                      <Convertir
                        prospectoId={p.id}
                        nombre={p.nombre}
                        edad={p.edadAproximada}
                        tutores={tutoresParaVincular().map((t) => ({ id: t.id, nombre: t.nombre }))}
                        hayContacto={
                          p.contactoNombre !== null && p.contactoNombre.trim() !== ""
                          && p.contactoNombre.trim().toLowerCase() !== p.nombre.trim().toLowerCase()
                        }
                      />
                    </div>
                  </>
                ) : (
                  <p id="aun-no-convertible" className="mt-1 text-sm text-vs-tinta-2">
                    {estado === "nuevo"
                      ? "Registra al menos un contacto antes de convertirlo: si no, el embudo no mide nada."
                      : "Está marcado como perdido. Reactívalo con un contacto antes de convertirlo."}
                  </p>
                )}
              </section>
            )}
          </>
        )}

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">
            Historial de contactos <span className="text-vs-tinta-3">({contactos.length})</span>
          </h2>
          {contactos.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-6 text-center text-sm text-vs-tinta-3">
              Nadie le ha escrito todavía.
            </p>
          ) : (
            <ol id="historial" className="mt-3 flex flex-col gap-2">
              {contactos.map((c) => (
                <li key={c.id} className="rounded-lg border border-vs-linea bg-white px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="tabular-nums text-vs-tinta-2">{c.fecha}</span>
                    <span className="font-medium">{RESULTADO[c.resultado] ?? c.resultado}</span>
                    <span className="text-xs text-vs-tinta-3">
                      {CANAL[c.canal] ?? c.canal}{c.usuario ? ` · ${c.usuario}` : ""}
                    </span>
                  </div>
                  {c.nota && <p className="mt-1 text-sm text-vs-tinta-2">{c.nota}</p>}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2.5 text-xs text-vs-tinta-3">
            El historial no se edita ni se borra. «Ya le marqué tres veces» necesita las tres
            marcas, no un contador.
          </p>
        </section>
      </main>
    </>
  );
}
