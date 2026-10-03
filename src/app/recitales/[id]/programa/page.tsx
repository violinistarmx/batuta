import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { participacionesDe, recitalPorId } from "@/lib/datos/recitales";
import { duracionDelPrograma } from "@/lib/dominio/recitales";
import { BarraCredencial } from "@/app/alumnos/[id]/credencial/cliente";

export const dynamic = "force-dynamic";

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Programa de mano.
 *
 * Es el único documento de la casa que se le da al público, no a una familia, así
 * que baja el tono administrativo: sin folios, sin cláusulas, sin totales. Solo el
 * orden, quién toca, qué toca y con quién estudia.
 *
 * Comparte el armazón de la nota de remisión —caja, franja, impresión por
 * navegador— porque sigue siendo un papel de la academia.
 */
export default async function ProgramaDeMano({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("recitales.leer");
  const { id } = await params;

  const recitalId = Number(id);
  if (!Number.isInteger(recitalId)) notFound();

  const r = recitalPorId(recitalId);
  if (!r) notFound();

  // El programa se imprime completo aunque quien lo abra sea un maestro: un
  // programa de mano con solo sus alumnos no es un programa de mano.
  const filas = participacionesDe(recitalId, { tipo: "todo" }, false, "")
    .filter((f) => f.estado === "confirmada")
    .sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );

  const [anio = 0, mes = 1, dia = 1] = r.fecha.split("-").map(Number);
  const dur = duracionDelPrograma(filas.map((f) => ({
    participacionId: f.id, orden: f.orden, duracionMinutos: f.duracionMinutos,
  })));

  return (
    <>
      <div className="no-imprimir">
        <Encabezado sesion={sesion} activo="recitales" />
      </div>

      <BarraCredencial volverA={`/recitales/${r.id}`} volverTexto="Volver al recital" />

      <main className="recibo">
        <header className="recibo-cabeza">
          <div>
            <h1 className="recibo-titulo">{r.nombre.toUpperCase()}</h1>
            <p id="programa-sede" className="recibo-folio">{r.sede}</p>
          </div>
          <div className="recibo-fecha">
            <span className="recibo-fecha-rotulo">FECHA</span>
            <span className="recibo-fecha-valor">
              {String(dia).padStart(2, "0")} / {String(mes).padStart(2, "0")} / {anio}
            </span>
          </div>
        </header>

        <p className="programa-encabezado">
          {dia} de {MES[mes - 1]} de {anio} · {r.hora} h
          {r.direccionSede && ` · ${r.direccionSede}`}
        </p>

        {filas.length === 0 ? (
          <p id="programa-sin-numeros" className="programa-vacio">
            Todavía no hay participaciones confirmadas.
          </p>
        ) : (
          <ol id="programa-numeros" className="programa-numeros">
            {filas.map((f) => (
              <li key={f.id}>
                <span className="orden">{f.orden ?? "—"}</span>
                <span className="cuerpo">
                  <span className="obra">
                    {f.pieza}
                    {f.compositor && <em> · {f.compositor}</em>}
                  </span>
                  <span className="interprete">
                    {f.alumno} <em>· {f.instrumento}</em>
                  </span>
                  <span className="maestro">Clase de {f.docente}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="recibo-lema">{cfg.academia_lema}</p>

        <footer className="recibo-franja">
          <span>{cfg.academia_telefono}</span>
          <span className="dir">{cfg.academia_domicilio}</span>
          <span>{cfg.academia_instagram}</span>
        </footer>

        <p className="recibo-emision">
          {filas.length} {filas.length === 1 ? "número" : "números"}
          {dur.minutos > 0 && ` · unos ${dur.minutos} minutos`}
          {" "}· Academia de Música VioliniStar
        </p>
      </main>
    </>
  );
}
