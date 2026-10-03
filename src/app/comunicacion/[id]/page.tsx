import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { mensajePorId } from "@/lib/datos/comunicacion";
import { aWhatsapp, type EstadoMensaje } from "@/lib/dominio/plantillas";
import { fechaLarga, hora } from "@/lib/formato";
import { Decidir, Editar } from "./cliente";

export const dynamic = "force-dynamic";

const NOMBRE: Record<EstadoMensaje, string> = {
  borrador: "Esperando aprobación", aprobado: "Aprobado, listo para mandar",
  rechazado: "Devuelto para corregir", enviado: "Enviado", cancelado: "Cancelado",
};

const COLOR: Record<EstadoMensaje, string> = {
  borrador: "border-amber-300 bg-amber-50", aprobado: "border-green-300 bg-green-50",
  rechazado: "border-red-300 bg-red-50", enviado: "border-vs-linea bg-vs-crema",
  cancelado: "border-vs-linea bg-vs-crema",
};

export default async function Mensaje({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("comunicacion.redactar");
  const { id } = await params;

  const mensajeId = Number(id);
  if (!Number.isInteger(mensajeId)) notFound();

  const m = mensajePorId(mensajeId);
  if (!m) notFound();

  const estado = m.estado as EstadoMensaje;
  const puedeAprobar = tienePermiso(sesion, "comunicacion.aprobar");
  const editable = estado === "borrador" || estado === "rechazado";
  const wa = aWhatsapp(m.telefono);

  return (
    <>
      <Encabezado sesion={sesion} activo="comunicacion" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/comunicacion" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Comunicación
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{m.destinatario}</h1>
          <span id="estado-mensaje"
                className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${COLOR[estado]}`}>
            {NOMBRE[estado]}
          </span>
        </div>

        <p className="mt-1 text-sm text-vs-tinta-3">
          {m.plantilla ?? "Mensaje suelto"}
          {m.redactor ? ` · redactó ${m.redactor}` : ""}
          {` · ${fechaLarga(m.creadoEn)}`}
          {m.telefono ? ` · ${m.telefono}` : " · sin teléfono"}
          {m.alumnoId && (
            <> · <Link href={`/alumnos/${m.alumnoId}`} className="no-underline hover:underline">
              expediente
            </Link></>
          )}
          {m.prospectoId && (
            <> · <Link href={`/prospectos/${m.prospectoId}`} className="no-underline hover:underline">
              prospecto
            </Link></>
          )}
        </p>

        {m.motivoRechazo && (
          <p id="motivo-rechazo"
             className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>Devuelto:</strong> {m.motivoRechazo}
          </p>
        )}

        <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">
            {editable ? "Texto que se mandará" : "Texto aprobado"}
          </h2>
          <pre id="cuerpo-mensaje"
               className="mt-3 whitespace-pre-wrap rounded-lg bg-vs-crema px-4 py-3 font-sans text-sm">
{m.cuerpo}
          </pre>
          {estado === "enviado" && (
            <p className="mt-3 text-xs text-vs-tinta-3">
              Enviado el {m.enviadoEn ? fechaLarga(m.enviadoEn) : "—"}
              {m.enviadoEn ? ` a las ${hora(m.enviadoEn)}` : ""}.
              {m.notaEnvio ? ` ${m.notaEnvio}` : ""}
            </p>
          )}
        </section>

        {estado === "aprobado" && wa && (
          <section className="mt-5 rounded-xl border border-vs-naranja bg-vs-crema p-5">
            <h2 className="font-display text-lg font-semibold">Mandarlo</h2>
            <p className="mt-1 text-sm text-vs-tinta-2">
              Abre WhatsApp con el texto ya escrito. El sistema no manda por ti: no hay
              integración con WhatsApp y fingir que la hay sería peor que no tenerla.
              Después, marca el envío aquí abajo para que quede registrado.
            </p>
            <a
              id="enlace-whatsapp"
              href={`https://wa.me/${wa}?text=${encodeURIComponent(m.cuerpo)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold
                         text-vs-tinta no-underline transition hover:bg-vs-naranja-claro"
            >
              Abrir en WhatsApp →
            </a>
          </section>
        )}

        {editable && (
          <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Corregir</h2>
            <div className="mt-3">
              <Editar id={m.id} cuerpo={m.cuerpo} telefono={m.telefono} />
            </div>
          </section>
        )}

        {/* La sección se muestra siempre que el mensaje siga vivo. Condicionarla a
            `puedeAprobar` escondía la explicación justo para quien la necesita: el
            asistente mandaba el mensaje y la pantalla no le decía qué sigue. */}
        {estado !== "enviado" && estado !== "cancelado" && (
          <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">
              {estado === "borrador" ? "Aprobación" : "Siguiente paso"}
            </h2>
            {estado === "borrador" && !puedeAprobar ? (
              <p id="sin-permiso-aprobar" className="mt-1 text-sm text-vs-tinta-2">
                Esperando a alguien que pueda aprobarlo. Redactar y autorizar son permisos
                distintos a propósito.
              </p>
            ) : (
              <div className="mt-3"><Decidir id={m.id} estado={estado} /></div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
