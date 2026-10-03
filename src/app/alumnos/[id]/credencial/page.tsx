import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { estatusDeAlumno } from "@/lib/datos/estatus";
import { qrComoSvg } from "@/lib/qr";
import { hoyEnMexico } from "@/lib/zona";
import { BarraCredencial, Entregar } from "./cliente";

export const dynamic = "force-dynamic";

/**
 * Credencial digital del alumno: el QR para compartir.
 *
 * Mientras el diseño de la credencial física esté pendiente, esto es la credencial.
 * Se manda por WhatsApp y el alumno la muestra desde el teléfono; al escanearla,
 * quien atiende ve su estatus.
 *
 * Se imprime igual que la nota de remisión —por el navegador, sin dependencias— por
 * si hace falta una copia en papel antes de que exista la tarjeta definitiva.
 */
export default async function Credencial({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("alumnos.leer");
  const { id } = await params;

  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) notFound();

  const alumno = alumnoPorId(alumnoId, alcanceDe(sesion));
  if (!alumno) notFound();

  const hoy = hoyEnMexico();
  const e = estatusDeAlumno(alumnoId, alcanceDe(sesion), false, hoy);
  if (!e) notFound();

  const cabeceras = await headers();
  const host = cabeceras.get("host") ?? "localhost:3000";
  const protocolo = process.env.NODE_ENV === "production" ? "https" : "http";
  const qr = await qrComoSvg(alumno.qrToken, process.env.URL_PUBLICA ?? `${protocolo}://${host}`);

  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );

  const programa = e.inscripciones[0]?.programa ?? null;
  const puedeEntregar = tienePermiso(sesion, "alumnos.editar");
  const entregada = e.credencial?.entregadaEn ?? null;

  const pendienteDesde = e.credencial?.emitirDesde ?? null;
  const yaTocaba = pendienteDesde !== null && pendienteDesde <= hoy;

  return (
    <>
      {/* El menú va arriba y fuera de la impresión: la tarjeta sale sola en papel. */}
      <div className="no-imprimir">
        <Encabezado sesion={sesion} activo="alumnos" />
      </div>

      <BarraCredencial volverA={`/alumnos/${alumno.id}`} />

      <main className="recibo">
        <header className="recibo-cabeza">
          <div>
            <h1 className="recibo-titulo">CREDENCIAL<br />DIGITAL</h1>
            <p id="credencial-codigo" className="recibo-folio">{alumno.codigo}</p>
          </div>
          <div className="recibo-fecha">
            <span className="recibo-fecha-rotulo">VIGENTE</span>
            <span className="recibo-fecha-valor">{hoy}</span>
          </div>
        </header>

        <section className="credencial-cuerpo">
          <div className="credencial-datos">
            <p className="credencial-nombre">{alumno.nombre}</p>
            {programa && <p className="credencial-programa">{programa}</p>}
            {e.tutor && (
              <p className="credencial-tutor">
                {e.tutor.parentesco}: {e.tutor.nombre}
              </p>
            )}
            <p className="credencial-instruccion">
              Muestra este código al llegar a tu clase. Quien te atienda verá tu
              estatus: clases disponibles, período y próxima sesión.
            </p>
          </div>

          <div className="credencial-qr" aria-label="Código QR del alumno"
               dangerouslySetInnerHTML={{ __html: qr }} />
        </section>

        <p className="recibo-lema">{cfg.academia_lema}</p>

        <footer className="recibo-franja">
          <span>{cfg.academia_telefono}</span>
          <span className="dir">{cfg.academia_domicilio}</span>
          <span>{cfg.academia_instagram}</span>
        </footer>

        <p className="recibo-emision">
          El código no contiene ningún dato del alumno: solo un identificador que la
          academia resuelve con sesión activa. Perderlo no revela nada.
        </p>
      </main>

      <div className="no-imprimir mx-auto max-w-[820px] px-5 pb-10 pt-6">
        <section className="rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Compartirla</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Descarga el código y mándalo por WhatsApp. El alumno lo guarda en su
            teléfono y lo muestra al llegar.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              id="descargar-qr"
              href={`/api/qr/${alumno.id}`}
              className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                         no-underline transition hover:bg-vs-naranja-claro"
            >
              Descargar el QR (PNG)
            </a>
            <Link href={`/alumnos/${alumno.id}/estatus`}
                  className="text-sm no-underline hover:underline">
              Ver el estatus que se muestra al escanear →
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Entrega</h2>
          {entregada ? (
            <p id="credencial-entregada" className="mt-1 text-sm text-vs-tinta-2">
              Entregada el <strong>{entregada}</strong>. Cláusula 10ª cumplida.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-vs-tinta-2">
                {yaTocaba
                  ? <>Pendiente desde el <strong>{pendienteDesde}</strong>.</>
                  : <>Toca entregarla a partir del <strong>{pendienteDesde ?? "—"}</strong>.</>}
                {" "}Cláusula 10ª: a los {cfg.dias_entrega_credencial} días del alta, sin costo.
                Mientras la credencial física siga en diseño, entregar el QR cuenta como entrega.
              </p>
              {puedeEntregar && <div className="mt-3"><Entregar alumnoId={alumno.id} /></div>}
            </>
          )}
        </section>
      </div>
    </>
  );
}
