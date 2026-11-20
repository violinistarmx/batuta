import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { armarComprobante, tokenDeRecibo } from "@/lib/datos/comprobante";
import { ValeEntrega } from "@/components/vale-entrega";
import { valesDeRecibo } from "@/lib/datos/vales";
import { periodoLegible, textoComprobanteWhatsApp } from "@/lib/dominio/comprobante";
import { destinosDeClase, enlaceWhatsApp } from "@/lib/dominio/recordatorios";
import { pesosExactos } from "@/lib/formato";
import { qrDeVale, urlBase } from "@/lib/qr";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Suspense } from "react";
import { AvisoTras } from "@/components/aviso";
import { Imprimir } from "./imprimir";
import "./comprobante.css";

export const dynamic = "force-dynamic";

// Tipografías de la plantilla. next/font las descarga al compilar y las sirve desde el mismo
// dominio: el navegador no le pide nada a Google.
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-barlow" });
const barlowCondensada = Barlow_Condensed({
  subsets: ["latin"], weight: ["600", "700", "800"], display: "swap", variable: "--font-barlow-condensed",
});

const MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Las clases del pago. En un plan familiar, un bloque por alumno con su nombre y su propia numeración. */
function Clases({ grupos }: { grupos: { alumno: string | null; clases: string[] }[] }) {
  return (
    <>
      {grupos.map((g, i) => (
        <div key={i} className="clases-grupo">
          {g.alumno && <p className="clases-alumno">{g.alumno}</p>}
          <ol className="clases">
            {g.clases.map((c, k) => <li key={k}>{c}</li>)}
          </ol>
        </div>
      ))}
    </>
  );
}

const METODO: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia",
  tarjeta: "Tarjeta", deposito: "Depósito", otro: "Otro",
};

export default async function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("recibos.emitir");
  const { id } = await params;

  const reciboId = Number(id);
  if (!Number.isInteger(reciboId)) notFound();

  const c = armarComprobante(reciboId);
  if (!c) notFound();
  const {
    r, renglones, cfg, fechaPago, emision, totalReal, aFavor, esAdulto, tutoresDelAlumno, contacto,
    clasesGrupos, clasesLista, descripcionPago, banco, hayBanco, instagram,
  } = c;
  const { anio, mes, dia } = fechaPago;
  const { anio: ae, mes: me, dia: de } = emision;

  // Vales de los productos que este pago cubrió: el comprobante lleva el código y el QR.
  const vales = valesDeRecibo(r.pagoId);
  const base = urlBase(await headers());
  const qrs = await Promise.all(vales.map((v) => qrDeVale(v.token, base, 120)));

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recibo.imprimir",
    entidad: "recibos",
    entidadId: r.id,
    cambios: { folio: r.folio },
  });

  // WhatsApp del comprobante: a quien paga. Un alumno adulto (o la cuenta de un responsable de
  // pago, como la titular de un plan familiar) recibe en su propio número; un menor, en el de su
  // tutor responsable. Sin número registrado el botón avisa en vez de abrir un chat equivocado.
  // El mensaje lleva el enlace privado al PDF: la liga de wa.me no puede adjuntar el archivo.
  const destinos = destinosDeClase(tutoresDelAlumno, { nombre: r.alumno, telefono: r.alumnoTelefono }, esAdulto);
  const preferido = destinos.sugerido === "tutor" ? destinos.tutor : destinos.alumno;
  const destinoWa = preferido ?? destinos.alumno ?? destinos.tutor;
  const token = destinoWa ? tokenDeRecibo(r.id) : null;
  const whatsapp = destinoWa && token
    ? {
        href: enlaceWhatsApp(destinoWa.numero, textoComprobanteWhatsApp({
          saludo: destinoWa.saludo,
          alumno: r.alumno.split(" ")[0] ?? r.alumno,
          paraTutor: destinoWa.paraTutor,
          folio: r.folio,
          total: pesosExactos(totalReal),
          enlace: `${base}/comprobante/${token}`,
        })),
        para: destinoWa.paraTutor ? `${destinoWa.saludo} (tutor responsable)` : destinoWa.saludo,
      }
    : null;

  return (
    <>
      <Suspense fallback={null}>
        <AvisoTras />
      </Suspense>
      {/* La barra no se imprime: solo existe para volver y para disparar la impresión. */}
      <Imprimir volverA={`/alumnos/${r.alumnoId}`} folio={r.folio} reciboId={r.id} whatsapp={whatsapp} />

      <div className={`comprobante ${barlow.variable} ${barlowCondensada.variable}`}>
        <main className="hoja recibo-hoja">
          <div className="marco" />

          <header className="head">
            <span className="etiqueta">VioliniStar · Academia de Música</span>
            <h1>
              Comprobante<br />de pago
            </h1>
            <p id="recibo-folio" className="folio">Folio {r.folio}</p>
            {r.selloPago && <div className="sello">Pago registrado</div>}
            <div className="fecha">
              <span className="l">Fecha</span>
              <div className="v">
                {String(dia).padStart(2, "0")} / {String(mes).padStart(2, "0")} / {anio}
              </div>
            </div>
          </header>

          <section className="datos">
            <div className="fila">
              <div className="campo">
                <span className="lab">Nombre</span>
                <span className="val">{r.alumno} · {r.alumnoCodigo}</span>
              </div>
            </div>
            {contacto.tutor && (
              <div className="fila">
                <div className="campo">
                  <span className="lab">Tutor</span>
                  <span className="val">{contacto.tutor}</span>
                </div>
              </div>
            )}
            <div className="fila">
              <div className="campo">
                <span className="lab">Dirección</span>
                <span className="val">{contacto.direccion ?? "—"}</span>
              </div>
              <div className="campo corto">
                <span className="lab" style={{ minWidth: 0 }}>Teléfono</span>
                <span className="val">{contacto.telefono ?? "—"}</span>
              </div>
            </div>
          </section>

          <section className="tabla">
            <div className="th">
              <div>Descripción</div>
              <div className="r">Precio unit.</div>
              <div className="r">Cant.</div>
              <div className="r">Precio total</div>
            </div>
            <div id="recibo-renglones">
              {renglones.map((x, i) => {
                // Un abono parcial no puede imprimirse como «$750 × 1 = $400»: el renglón debe
                // cuadrar solo. El cargo completo y lo que resta se dicen en la descripción.
                const resta = x.montoCargo - x.aplicadoTotal;
                const parcial = x.montoAplicado < x.montoCargo;
                return (
                  <div key={i} className={`tr${i === 0 ? " primera" : ""}`}>
                    <div>
                      <div className="programa">{x.descripcion}</div>
                      {x.periodo && <span className="periodo">{periodoLegible(x.periodo)}</span>}
                      {parcial && (
                        <p className="desc">
                          Abono a cuenta de {pesosExactos(x.montoCargo)}
                          {resta > 0 && <> · resta {pesosExactos(resta)}</>}
                        </p>
                      )}
                      {/* Descripción y clases del pago: van con la primera partida. */}
                      {i === 0 && descripcionPago && <p className="desc">{descripcionPago}</p>}
                      {i === 0 && <Clases grupos={clasesGrupos} />}
                    </div>
                    <div className="num r">{pesosExactos(x.montoAplicado)}</div>
                    <div className="num r">1</div>
                    <div className="num r">{pesosExactos(x.montoAplicado)}</div>
                  </div>
                );
              })}
              {/* Sin cargos que cubrir (todo quedó a favor) la descripción y las clases van solas. */}
              {renglones.length === 0 && (descripcionPago || clasesLista.length > 0) && (
                <div className="tr primera">
                  <div>
                    {descripcionPago && <p className="desc" style={{ marginTop: 0 }}>{descripcionPago}</p>}
                    <Clases grupos={clasesGrupos} />
                  </div>
                  <div /><div /><div />
                </div>
              )}
              {r.descuentoCentavos > 0 && (
                <div className="tr nota-fila">
                  <div><div className="programa">Descuento / condonación autorizado por dirección</div></div>
                  <div className="num r">{pesosExactos(r.descuentoCentavos)}</div>
                  <div className="num r">1</div>
                  <div className="num r">({pesosExactos(r.descuentoCentavos)})</div>
                </div>
              )}
              {aFavor > 0 && (
                <div className="tr nota-fila">
                  <div><div className="programa">Saldo a favor del alumno</div></div>
                  <div className="num r">—</div>
                  <div className="num r">1</div>
                  <div className="num r">{pesosExactos(aFavor)}</div>
                </div>
              )}
            </div>
          </section>

          {r.nota && (
            <div className="notas recibo-obs-internas">
              <b>NOTAS</b><br />{r.nota}
            </div>
          )}

          <section className="pie">
            <div className="terminos">
              <h3>Términos y condiciones</h3>
              <p>
                Las clases son individuales y en el horario previamente acordado. Las inasistencias
                deberán avisarse con al menos {cfg.horas_aviso_posposicion ?? 24} horas para poder
                reprogramarse; de lo contrario, la clase se considera tomada. Los planes y
                mensualidades corresponden únicamente al periodo de clases acordado y no son
                transferibles. El pago asegura la reserva del horario y la disponibilidad del
                maestro. En caso de causas de fuerza mayor por parte de la academia, la clase será
                reprogramada sin afectación al alumno.
              </p>
              <p className="fiscal">
                Este documento es un comprobante de pago y no es un comprobante fiscal digital (CFDI).
              </p>
            </div>

            <div className="totales">
              <div className="t-fila">
                <span className="lab">Forma de pago</span>
                <span>{METODO[r.metodo] ?? r.metodo}</span>
              </div>
              {r.referencia && (
                <div className="t-fila">
                  <span className="lab">Referencia</span><span>{r.referencia}</span>
                </div>
              )}
              <div className="t-fila">
                <span className="lab">Impuestos</span><span>—</span>
              </div>
              <div className="t-total">
                <span className="lab">Total</span>
                <span className="val" id="recibo-total">{pesosExactos(totalReal)}</span>
              </div>
            </div>
          </section>

          {vales.length > 0 && (
            <section className="vales space-y-2" aria-label="Vales de entrega">
              {vales.map((v, i) => (
                <ValeEntrega key={v.id} vale={v} qrSvg={qrs[i]!} claseExtra="break-inside-avoid" />
              ))}
            </section>
          )}

          <footer className="cierre">
            {hayBanco && (
              <div className="banco">
                <div className="tit">Datos para pago y transferencia</div>
                <div className="g">
                  {banco.nombre && <div className="c"><div className="l">Banco</div><div className="v">{banco.nombre}</div></div>}
                  {banco.titular && <div className="c t"><div className="l">Titular</div><div className="v">{banco.titular}</div></div>}
                  {banco.cuenta && <div className="c"><div className="l">Cuenta</div><div className="v">{banco.cuenta}</div></div>}
                  {banco.clabe && <div className="c"><div className="l">CLABE</div><div className="v">{banco.clabe}</div></div>}
                  {banco.tarjeta && <div className="c"><div className="l">Tarjeta de débito</div><div className="v">{banco.tarjeta}</div></div>}
                </div>
              </div>
            )}
            <div className="mision">{cfg.academia_lema}</div>
            <div className="barra">
              <span>{cfg.academia_telefono}</span>
              <span>{cfg.academia_domicilio}</span>
              <span>{instagram}</span>
            </div>
            <div className="emitido">
              Emitido el {de} de {MES[me - 1]} de {ae} · Academia de Música VioliniStar
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
