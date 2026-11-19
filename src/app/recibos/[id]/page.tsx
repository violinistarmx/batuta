import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { reciboPorId, renglonesDeRecibo } from "@/lib/datos/finanzas";
import { ValeEntrega } from "@/components/vale-entrega";
import { valesDeRecibo } from "@/lib/datos/vales";
import { tutoresDe } from "@/lib/datos/alumnos";
import {
  contactoDelComprobante, descripcionDelComprobante, lineasDeClases, periodoLegible,
} from "@/lib/dominio/comprobante";
import { esMenorDeEdad, pesosExactos } from "@/lib/formato";
import { qrDeVale, urlBase } from "@/lib/qr";
import { fechaCivil } from "@/lib/zona";
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
  // Vales de los productos que este pago cubrió: el comprobante lleva el código y el QR.
  const vales = valesDeRecibo(r.pagoId);
  const base = urlBase(await headers());
  const qrs = await Promise.all(vales.map((v) => qrDeVale(v.token, base, 120)));
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
  // El dinero real que entró: lo que pagó el alumno menos la condonación.
  // Si el formulario capturó el total del cargo como "monto", restamos el descuento
  // para obtener lo que el alumno efectivamente pagó de bolsillo.
  const totalReal = r.montoCentavos - r.descuentoCentavos;
  // El saldo a favor refleja solo el dinero real no aplicado a ningún cargo.
  const aFavor = Math.max(0, totalReal - Math.max(0, aplicado - r.descuentoCentavos));

  // Los datos de quien paga salen de la cuenta del alumno; si es menor, del tutor responsable.
  // Adulto solo si consta que tiene 18 o más (sin fecha se trata como menor, como en los recordatorios).
  const esAdulto = !!r.alumnoNacimiento && !esMenorDeEdad(r.alumnoNacimiento);
  const contacto = contactoDelComprobante(
    { nombre: r.alumno, telefono: r.alumnoTelefono, direccion: r.alumnoDireccion },
    esAdulto ? [] : tutoresDe(r.alumnoId),
    esAdulto,
  );
  const clasesLista = lineasDeClases(r.clasesTexto);
  const descripcionPago = descripcionDelComprobante(r.descripcion, clasesLista);
  const banco = {
    nombre: cfg.recibo_banco_nombre, titular: cfg.recibo_banco_titular, cuenta: cfg.recibo_banco_cuenta,
    clabe: cfg.recibo_banco_clabe, tarjeta: cfg.recibo_banco_tarjeta,
  };
  const hayBanco = Boolean(banco.cuenta || banco.clabe || banco.tarjeta);
  const instagram = cfg.academia_instagram ? `@${cfg.academia_instagram.replace(/^@/, "")}` : "";

  return (
    <>
      <Suspense fallback={null}>
        <AvisoTras />
      </Suspense>
      {/* La barra no se imprime: solo existe para volver y para disparar la impresión. */}
      <Imprimir volverA={`/alumnos/${r.alumnoId}`} folio={r.folio} reciboId={r.id} />

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
                      {i === 0 && clasesLista.length > 0 && (
                        <ol className="clases">
                          {clasesLista.map((c, k) => <li key={k}>{c}</li>)}
                        </ol>
                      )}
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
                    {clasesLista.length > 0 && (
                      <ol className="clases">{clasesLista.map((c, k) => <li key={k}>{c}</li>)}</ol>
                    )}
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
