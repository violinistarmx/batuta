import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { reciboPorId, renglonesDeRecibo } from "@/lib/datos/finanzas";
import { pesosExactos } from "@/lib/formato";
import { fechaCivil } from "@/lib/zona";
import { Imprimir } from "./imprimir";

export const dynamic = "force-dynamic";

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const METODO: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia",
  tarjeta: "Tarjeta", deposito: "Depósito", otro: "Otro",
};

export default async function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("recibos.emitir");
  const { id } = await params;

  const reciboId = Number(id);
  if (!Number.isInteger(reciboId)) notFound();

  const r = reciboPorId(reciboId);
  if (!r) notFound();

  const renglones = renglonesDeRecibo(r.pagoId);
  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recibo.imprimir",
    entidad: "recibos",
    entidadId: r.id,
    cambios: { folio: r.folio },
  });

  const [anio = 0, mes = 1, dia = 1] = r.recibidoEl.split("-").map(Number);
  // La emisión es su propio instante: puede caer un día después del pago cuando
  // el recibo se captura tarde, y el documento no debe disimularlo.
  const [ae = 0, me = 1, de = 1] = fechaCivil(r.emitidoEn).split("-").map(Number);
  const aplicado = renglones.reduce((s, x) => s + x.montoAplicado, 0);
  const aFavor = r.montoCentavos - aplicado;

  return (
    <>
      {/* La barra no se imprime: solo existe para volver y para disparar la impresión. */}
      <Imprimir volverA={`/alumnos/${r.alumnoId}`} folio={r.folio} />

      <main className="recibo">
        <header className="recibo-cabeza">
          <div>
            <h1 className="recibo-titulo">
              NOTA DE<br />REMISIÓN
            </h1>
            <p id="recibo-folio" className="recibo-folio">Folio {r.folio}</p>
          </div>
          <div className="recibo-fecha">
            <span className="recibo-fecha-rotulo">FECHA</span>
            <span className="recibo-fecha-valor">
              {String(dia).padStart(2, "0")} / {String(mes).padStart(2, "0")} / {anio}
            </span>
          </div>
        </header>

        <section className="recibo-datos">
          <p><span>NOMBRE</span> {r.alumno} <em>· {r.alumnoCodigo}</em></p>
          <p>
            <span>DIRECCIÓN</span> {r.alumnoDireccion ?? "—"}
            <span className="ml">TELÉFONO</span> {r.alumnoTelefono ?? "—"}
          </p>
        </section>

        <table className="recibo-tabla">
          <thead>
            <tr>
              <th>DESCRIPCIÓN</th>
              <th className="num">PRECIO UNIT.</th>
              <th className="num">CANT.</th>
              <th className="num">PRECIO TOTAL</th>
            </tr>
          </thead>
          <tbody id="recibo-renglones">
            {renglones.map((x, i) => {
              // Un abono parcial no puede imprimirse como «$750 × 1 = $400»: el
              // renglón debe cuadrar solo. El cargo completo y lo que resta se
              // dicen en la descripción, que es donde no engañan a nadie.
              const resta = x.montoCargo - x.aplicadoTotal;
              const parcial = x.montoAplicado < x.montoCargo;
              return (
                <tr key={i}>
                  <td>
                    {x.descripcion}
                    {x.periodo && <em className="periodo"> · {x.periodo}</em>}
                    {parcial && (
                      <em className="periodo">
                        {" "}· abono a cuenta de {pesosExactos(x.montoCargo)}
                        {resta > 0 && <> · resta {pesosExactos(resta)}</>}
                      </em>
                    )}
                  </td>
                  <td className="num">{pesosExactos(x.montoAplicado)}</td>
                  <td className="num">1</td>
                  <td className="num">{pesosExactos(x.montoAplicado)}</td>
                </tr>
              );
            })}
            {aFavor > 0 && (
              <tr>
                <td>Saldo a favor del alumno</td>
                <td className="num">—</td>
                <td className="num">1</td>
                <td className="num">{pesosExactos(aFavor)}</td>
              </tr>
            )}
            {Array.from({ length: Math.max(0, 5 - renglones.length - (aFavor > 0 ? 1 : 0)) }).map((_, i) => (
              <tr key={`v${i}`} className="vacia"><td colSpan={4}>&nbsp;</td></tr>
            ))}
          </tbody>
        </table>

        <section className="recibo-pie">
          <div className="recibo-terminos">
            <h2>TÉRMINOS Y CONDICIONES</h2>
            <p>
              Las clases son individuales y en el horario previamente acordado. Las inasistencias
              deberán avisarse con al menos {cfg.horas_aviso_posposicion ?? 24} horas para poder
              reprogramarse; de lo contrario, la clase se considera tomada. Los planes y
              mensualidades corresponden únicamente al periodo de clases acordado y no son
              transferibles. El pago asegura la reserva del horario y la disponibilidad del
              maestro. En caso de causas de fuerza mayor por parte de la academia, la clase será
              reprogramada sin afectación al alumno.
            </p>
            <p className="recibo-nofiscal">
              Este documento es una nota de remisión y <strong>no es un comprobante fiscal
              digital (CFDI)</strong>.
            </p>
          </div>

          <div className="recibo-totales">
            <div className="fila">
              <span>FORMA DE PAGO</span>
              <span>{METODO[r.metodo] ?? r.metodo}</span>
            </div>
            {r.referencia && (
              <div className="fila">
                <span>REFERENCIA</span><span>{r.referencia}</span>
              </div>
            )}
            <div className="fila">
              <span>IMPUESTOS</span><span>—</span>
            </div>
            <div className="total">
              <span>TOTAL</span><span id="recibo-total">{pesosExactos(r.montoCentavos)}</span>
            </div>
          </div>
        </section>

        <p className="recibo-lema">{cfg.academia_lema}</p>

        <footer className="recibo-franja">
          <span>{cfg.academia_telefono}</span>
          <span className="dir">
            {cfg.academia_domicilio}
          </span>
          <span>{cfg.academia_instagram}</span>
        </footer>

        <p className="recibo-emision">
          Emitido el {de} de {MES[me - 1]} de {ae} · Academia de Música VioliniStar
        </p>
      </main>
    </>
  );
}
