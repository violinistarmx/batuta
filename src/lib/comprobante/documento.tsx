/**
 * Comprobante de pago en PDF: la misma plantilla de la pantalla (carta, naranja y amarillo,
 * tipografías Barlow) dibujada con react-pdf. Se genera en el servidor, sin navegador, y es lo
 * que recibe quien abre el enlace privado de WhatsApp.
 *
 * Las medidas de la plantilla están en píxeles (hoja de 816 × 1056); aquí se pasan a puntos
 * (× 0.75) para que la hoja carta salga exacta. No incluye vales de entrega: el QR de un vale es
 * para el mostrador, no para un archivo que viaja por WhatsApp.
 */

import { Defs, ClipPath, Document, Font, G, Page, Polygon, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import type { Comprobante } from "@/lib/datos/comprobante";
import { METODOS, MESES } from "@/lib/datos/comprobante";
import { periodoLegible } from "@/lib/dominio/comprobante";
import { pesosExactos } from "@/lib/formato";
import { BARLOW_400, BARLOW_600, BARLOW_700, CONDENSADA_700, CONDENSADA_800 } from "./fuentes";

Font.register({
  family: "Barlow",
  fonts: [
    { src: BARLOW_400, fontWeight: 400 },
    { src: BARLOW_600, fontWeight: 600 },
    { src: BARLOW_700, fontWeight: 700 },
  ],
});
Font.register({
  family: "Barlow Condensed",
  fonts: [
    { src: CONDENSADA_700, fontWeight: 700 },
    { src: CONDENSADA_800, fontWeight: 800 },
  ],
});
// Sin guiones automáticos: partirían los nombres y los folios.
Font.registerHyphenationCallback((palabra) => [palabra]);

const K = { naranja: "#F28C0F", amarillo: "#FFC629", carbon: "#1A1A1A", blanco: "#FFFFFF", gris: "#F5F5F5", cafe: "#8A4B00", linea: "#E3E3E3" };
/** Píxeles de la plantilla → puntos del PDF. */
const p = (px: number) => px * 0.75;

/** Los vértices de un rectángulo de la plantilla girado `grados` (como CSS rotate: horario). */
function rectanguloGirado(cx: number, cy: number, ancho: number, alto: number, grados: number): string {
  const a = (grados * Math.PI) / 180;
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const x = (sx! * ancho) / 2;
    const y = (sy! * alto) / 2;
    return `${(cx + x * Math.cos(a) - y * Math.sin(a)).toFixed(1)},${(cy + x * Math.sin(a) + y * Math.cos(a)).toFixed(1)}`;
  });
  return pts.join(" ");
}

const s = StyleSheet.create({
  pagina: { fontFamily: "Barlow", fontSize: p(14), color: K.carbon, backgroundColor: K.blanco, paddingBottom: 0 },
  marco: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: p(14), borderColor: K.amarillo },
  cabeza: { marginTop: p(14), marginHorizontal: p(14), height: p(206), position: "relative" },
  etiqueta: {
    position: "absolute", left: p(42), top: p(26), backgroundColor: K.carbon, color: K.blanco,
    fontWeight: 700, fontSize: p(11), letterSpacing: p(2.6), textTransform: "uppercase",
    paddingVertical: p(6), paddingHorizontal: p(12),
  },
  titulo: {
    position: "absolute", left: p(42), top: p(65), fontFamily: "Barlow Condensed", fontWeight: 800,
    fontSize: p(48), lineHeight: 0.95, color: K.blanco, textTransform: "uppercase",
  },
  folio: {
    position: "absolute", left: p(42), top: p(160), fontFamily: "Barlow Condensed", fontWeight: 700,
    fontSize: p(22), letterSpacing: p(1.5), color: K.carbon,
  },
  fechaCaja: { position: "absolute", right: p(42), top: p(26), alignItems: "flex-end" },
  fechaEtiqueta: {
    backgroundColor: K.carbon, color: K.amarillo, fontWeight: 700, fontSize: p(11), letterSpacing: p(2.6),
    paddingVertical: p(6), paddingHorizontal: p(14), textTransform: "uppercase",
  },
  fechaValor: { fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: p(30), letterSpacing: p(1), marginTop: p(8) },
  sello: {
    position: "absolute", right: p(42), top: p(102), borderWidth: p(3), borderColor: K.carbon,
    backgroundColor: K.amarillo, paddingVertical: p(5), paddingHorizontal: p(12), transform: "rotate(-3deg)",
  },
  selloTexto: { fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: p(16), letterSpacing: p(2.5), textTransform: "uppercase" },
  datos: { marginTop: p(14), marginHorizontal: p(56) },
  fila: { flexDirection: "row", paddingVertical: p(9), borderBottomWidth: 0.75, borderBottomColor: K.linea, alignItems: "flex-start" },
  filaPrimera: { borderTopWidth: p(3), borderTopColor: K.naranja },
  etiquetaDato: { fontWeight: 700, fontSize: p(10.5), letterSpacing: p(2.2), textTransform: "uppercase", color: K.cafe, width: p(82), paddingTop: 1.5 },
  valor: { fontWeight: 600, fontSize: p(14) },
  tabla: { marginTop: p(14), marginHorizontal: p(56) },
  th: {
    flexDirection: "row", backgroundColor: K.carbon, color: K.blanco, paddingVertical: p(10), paddingHorizontal: p(14),
    borderBottomWidth: p(4), borderBottomColor: K.amarillo, fontWeight: 700, fontSize: p(10.5), letterSpacing: p(2.2), textTransform: "uppercase",
  },
  tr: { flexDirection: "row", padding: p(14), borderBottomWidth: 0.75, borderBottomColor: K.linea, alignItems: "flex-start" },
  cDesc: { flex: 1, paddingRight: p(8) },
  cUnit: { width: p(100), textAlign: "right" },
  cCant: { width: p(56), textAlign: "right" },
  cTotal: { width: p(110), textAlign: "right" },
  num: { fontWeight: 600, fontSize: p(14), paddingTop: p(4) },
  programa: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: p(24), lineHeight: 1, textTransform: "uppercase" },
  programaChico: { fontFamily: "Barlow", fontWeight: 600, fontSize: p(15) },
  periodo: {
    alignSelf: "flex-start", backgroundColor: K.amarillo, fontWeight: 700, fontSize: p(11), letterSpacing: p(1.4),
    paddingVertical: p(3), paddingHorizontal: p(8), marginTop: p(6), textTransform: "uppercase",
  },
  desc: { fontSize: p(12.5), color: "#444444", marginTop: p(8), lineHeight: 1.4 },
  clase: { flexDirection: "row", alignItems: "center", paddingVertical: p(3), borderBottomWidth: 0.75, borderBottomColor: K.linea, borderBottomStyle: "dashed" },
  claseNum: {
    width: p(22), height: p(22), backgroundColor: K.carbon, color: K.blanco, fontWeight: 700, fontSize: p(12),
    textAlign: "center", paddingTop: p(4), marginRight: p(10),
  },
  claseTexto: { fontSize: p(13), fontWeight: 400 },
  notas: { marginTop: p(8), marginHorizontal: p(56), backgroundColor: K.gris, borderLeftWidth: p(6), borderLeftColor: K.amarillo, paddingVertical: p(6), paddingHorizontal: p(12) },
  notasTitulo: { fontWeight: 700, fontSize: p(10.5), letterSpacing: p(2), color: K.cafe },
  notasTexto: { fontSize: p(11.5), marginTop: 2 },
  pie: { flexDirection: "row", marginTop: p(10), marginHorizontal: p(56) },
  terminos: { flex: 1, paddingRight: p(30) },
  terminosTitulo: {
    fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: p(15), letterSpacing: p(2), textTransform: "uppercase",
    borderLeftWidth: p(6), borderLeftColor: K.naranja, paddingLeft: p(8),
  },
  terminosTexto: { fontSize: p(9.4), lineHeight: 1.42, color: "#333333", textAlign: "justify", marginTop: p(7) },
  fiscal: { fontSize: p(9.4), lineHeight: 1.42, color: K.cafe, fontWeight: 600, marginTop: p(6) },
  totales: { width: p(270) },
  tFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: p(8), paddingHorizontal: 1.5, borderBottomWidth: 0.75, borderBottomColor: K.linea, fontSize: p(13) },
  tTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: K.naranja,
    paddingVertical: p(12), paddingHorizontal: p(14), marginTop: p(10), borderLeftWidth: p(8), borderLeftColor: K.carbon,
  },
  tTotalValor: { fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: p(30) },
  cierre: { position: "absolute", left: p(14), right: p(14), bottom: p(14) },
  banco: { backgroundColor: K.carbon, color: K.blanco, paddingTop: p(8), paddingBottom: p(9), paddingHorizontal: p(22), borderTopWidth: p(4), borderTopColor: K.naranja },
  bancoTitulo: { fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: p(12), letterSpacing: p(2.4), textTransform: "uppercase", color: K.amarillo, marginBottom: p(5) },
  bancoFila: { flexDirection: "row" },
  bancoCampo: { marginRight: p(16) },
  bancoEtiqueta: { fontWeight: 700, fontSize: p(8.5), letterSpacing: p(1.8), textTransform: "uppercase", color: K.amarillo },
  bancoValor: { fontWeight: 700, fontSize: p(11.5), marginTop: 1 },
  mision: { textAlign: "center", fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: p(20), color: K.naranja, letterSpacing: p(0.5), paddingTop: p(8), paddingBottom: p(6) },
  barra: {
    backgroundColor: K.carbon, color: K.amarillo, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: p(6), paddingHorizontal: p(28), fontWeight: 600, fontSize: p(11), letterSpacing: p(1.3), textTransform: "uppercase",
  },
  emitido: { textAlign: "center", fontSize: p(10), color: "#555555", paddingTop: p(8), paddingBottom: p(10) },
});

/**
 * Las clases del pago: en un plan familiar, un bloque por alumno con su nombre y su numeración.
 * Con varios alumnos las líneas van más juntas para que 3 × 4 clases quepan en la hoja.
 */
const ClasesPdf = ({ grupos }: { grupos: { alumno: string | null; clases: string[] }[] }) => {
  const compacto = grupos.length > 1;
  return (
    <View>
      {grupos.map((g, i) => (
        <View key={i} style={{ marginTop: p(compacto ? 6 : 12) }}>
          {g.alumno && (
            <Text style={{ fontWeight: 700, fontSize: p(10.5), letterSpacing: p(2), textTransform: "uppercase", color: K.cafe, marginBottom: p(3) }}>
              {g.alumno}
            </Text>
          )}
          {g.clases.map((t, k) => (
            <View key={k} style={[s.clase, compacto ? { paddingVertical: p(1) } : {}]} wrap={false}>
              <Text style={[s.claseNum, compacto ? { width: p(17), height: p(17), fontSize: p(10), paddingTop: p(3), marginRight: p(8) } : {}]}>{k + 1}</Text>
              <Text style={[s.claseTexto, compacto ? { fontSize: p(12) } : {}]}>{t}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const Fila = ({ etiqueta, children, primera }: { etiqueta: string; children: React.ReactNode; primera?: boolean }) => (
  <View style={primera ? [s.fila, s.filaPrimera] : s.fila}>
    <Text style={s.etiquetaDato}>{etiqueta}</Text>
    <View style={{ flex: 1 }}>{children}</View>
  </View>
);

export function ComprobantePdf({ c }: { c: Comprobante }) {
  const { r, renglones, cfg, fechaPago, emision, totalReal, aFavor, contacto, clasesGrupos, clasesLista, descripcionPago, banco, hayBanco, instagram } = c;
  const f2 = (n: number) => String(n).padStart(2, "0");
  // El pie viaja fijo al fondo de cada página; el contenido deja ese espacio libre.
  // Medido sobre el PDF: lema + franja + fecha de emisión + marco ≈ 92 pt; con datos de pago, ≈ 150 pt.
  const alturaCierre = hayBanco ? 150 : 92;

  return (
    <Document title={`Comprobante de pago ${r.folio}`} author="Academia de Música VioliniStar" subject="Comprobante de pago">
      <Page size="LETTER" style={[s.pagina, { paddingBottom: alturaCierre }]} wrap>
        <View style={s.marco} fixed />

        <View style={s.cabeza}>
          <Svg width={p(788)} height={p(206)} viewBox="0 0 788 206" style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <ClipPath id="cabeza"><Rect x={0} y={0} width={788} height={206} /></ClipPath>
            </Defs>
            <G clipPath="url(#cabeza)">
              <Rect x={0} y={0} width={788} height={206} fill={K.naranja} />
              <Polygon points={rectanguloGirado(693, 95, 330, 330, 30)} fill={K.amarillo} />
              <Polygon points={rectanguloGirado(447, 120, 46, 440, 30)} fill={K.carbon} />
            </G>
          </Svg>
          <Text style={s.etiqueta}>VioliniStar · Academia de Música</Text>
          <Text style={s.titulo}>{"Comprobante\nde pago"}</Text>
          <Text style={s.folio}>Folio {r.folio}</Text>
          {r.selloPago && (
            <View style={s.sello}><Text style={s.selloTexto}>Pago registrado</Text></View>
          )}
          <View style={s.fechaCaja}>
            <Text style={s.fechaEtiqueta}>Fecha</Text>
            <Text style={s.fechaValor}>{f2(fechaPago.dia)} / {f2(fechaPago.mes)} / {fechaPago.anio}</Text>
          </View>
        </View>

        <View style={s.datos}>
          <Fila etiqueta="Nombre" primera><Text style={s.valor}>{r.alumno} · {r.alumnoCodigo}</Text></Fila>
          {contacto.tutor && <Fila etiqueta="Tutor"><Text style={s.valor}>{contacto.tutor}</Text></Fila>}
          <View style={s.fila}>
            <Text style={s.etiquetaDato}>Dirección</Text>
            <Text style={[s.valor, { flex: 1 }]}>{contacto.direccion ?? "—"}</Text>
            <Text style={[s.etiquetaDato, { width: p(70) }]}>Teléfono</Text>
            <Text style={[s.valor, { width: p(120) }]}>{contacto.telefono ?? "—"}</Text>
          </View>
        </View>

        <View style={s.tabla}>
          <View style={s.th} wrap={false}>
            <Text style={s.cDesc}>Descripción</Text>
            <Text style={s.cUnit}>Precio unit.</Text>
            <Text style={s.cCant}>Cant.</Text>
            <Text style={s.cTotal}>Precio total</Text>
          </View>
          {renglones.map((x, i) => {
            const resta = x.montoCargo - x.aplicadoTotal;
            const parcial = x.montoAplicado < x.montoCargo;
            return (
              <View key={i} style={[s.tr, i === 0 ? { minHeight: p(130) } : {}, i === 0 && clasesGrupos.length > 1 ? { paddingVertical: p(9) } : {}]} wrap={i !== 0}>
                <View style={s.cDesc}>
                  <Text style={x.descripcion.length > 40 ? [s.programa, { fontSize: p(17) }] : s.programa}>{x.descripcion}</Text>
                  {x.periodo && <Text style={s.periodo}>{periodoLegible(x.periodo)}</Text>}
                  {parcial && (
                    <Text style={s.desc}>
                      Abono a cuenta de {pesosExactos(x.montoCargo)}{resta > 0 ? ` · resta ${pesosExactos(resta)}` : ""}
                    </Text>
                  )}
                  {i === 0 && descripcionPago && <Text style={s.desc}>{descripcionPago}</Text>}
                  {i === 0 && <ClasesPdf grupos={clasesGrupos} />}
                </View>
                <Text style={[s.num, s.cUnit]}>{pesosExactos(x.montoAplicado)}</Text>
                <Text style={[s.num, s.cCant]}>1</Text>
                <Text style={[s.num, s.cTotal]}>{pesosExactos(x.montoAplicado)}</Text>
              </View>
            );
          })}
          {renglones.length === 0 && (descripcionPago || clasesLista.length > 0) && (
            <View style={[s.tr, { minHeight: p(130) }]} wrap={false}>
              <View style={s.cDesc}>
                {descripcionPago && <Text style={[s.desc, { marginTop: 0 }]}>{descripcionPago}</Text>}
                <ClasesPdf grupos={clasesGrupos} />
              </View>
            </View>
          )}
          {r.descuentoCentavos > 0 && (
            <View style={s.tr} wrap={false}>
              <View style={s.cDesc}><Text style={s.programaChico}>Descuento / condonación autorizado por dirección</Text></View>
              <Text style={[s.num, s.cUnit]}>{pesosExactos(r.descuentoCentavos)}</Text>
              <Text style={[s.num, s.cCant]}>1</Text>
              <Text style={[s.num, s.cTotal]}>({pesosExactos(r.descuentoCentavos)})</Text>
            </View>
          )}
          {aFavor > 0 && (
            <View style={s.tr} wrap={false}>
              <View style={s.cDesc}><Text style={s.programaChico}>Saldo a favor del alumno</Text></View>
              <Text style={[s.num, s.cUnit]}>—</Text>
              <Text style={[s.num, s.cCant]}>1</Text>
              <Text style={[s.num, s.cTotal]}>{pesosExactos(aFavor)}</Text>
            </View>
          )}
        </View>

        {r.nota && (
          <View style={s.notas} wrap={false}>
            <Text style={s.notasTitulo}>NOTAS</Text>
            <Text style={s.notasTexto}>{r.nota}</Text>
          </View>
        )}

        <View style={s.pie} wrap={false}>
          <View style={s.terminos}>
            <Text style={s.terminosTitulo}>Términos y condiciones</Text>
            <Text style={s.terminosTexto}>
              Las clases son individuales y en el horario previamente acordado. Las inasistencias deberán avisarse con al menos {cfg.horas_aviso_posposicion ?? 24} horas para poder reprogramarse; de lo contrario, la clase se considera tomada. Los planes y mensualidades corresponden únicamente al periodo de clases acordado y no son transferibles. El pago asegura la reserva del horario y la disponibilidad del maestro. En caso de causas de fuerza mayor por parte de la academia, la clase será reprogramada sin afectación al alumno.
            </Text>
            <Text style={s.fiscal}>Este documento es un comprobante de pago y no es un comprobante fiscal digital (CFDI).</Text>
          </View>
          <View style={s.totales}>
            <View style={s.tFila}><Text style={[s.etiquetaDato, { width: "auto" }]}>Forma de pago</Text><Text>{METODOS[r.metodo] ?? r.metodo}</Text></View>
            {r.referencia && <View style={s.tFila}><Text style={[s.etiquetaDato, { width: "auto" }]}>Referencia</Text><Text>{r.referencia}</Text></View>}
            <View style={s.tFila}><Text style={[s.etiquetaDato, { width: "auto" }]}>Impuestos</Text><Text>—</Text></View>
            <View style={s.tTotal}>
              <Text style={[s.etiquetaDato, { color: K.carbon, fontSize: p(12), width: "auto" }]}>Total</Text>
              <Text style={s.tTotalValor}>{pesosExactos(totalReal)}</Text>
            </View>
          </View>
        </View>

        <View style={s.cierre} fixed>
          {hayBanco && (
            <View style={s.banco}>
              <Text style={s.bancoTitulo}>Datos para pago y transferencia</Text>
              <View style={s.bancoFila}>
                {banco.nombre && <View style={s.bancoCampo}><Text style={s.bancoEtiqueta}>Banco</Text><Text style={s.bancoValor}>{banco.nombre}</Text></View>}
                {banco.titular && <View style={[s.bancoCampo, { flex: 1 }]}><Text style={s.bancoEtiqueta}>Titular</Text><Text style={s.bancoValor}>{banco.titular}</Text></View>}
                {banco.cuenta && <View style={s.bancoCampo}><Text style={s.bancoEtiqueta}>Cuenta</Text><Text style={s.bancoValor}>{banco.cuenta}</Text></View>}
                {banco.clabe && <View style={s.bancoCampo}><Text style={s.bancoEtiqueta}>CLABE</Text><Text style={s.bancoValor}>{banco.clabe}</Text></View>}
                {banco.tarjeta && <View><Text style={s.bancoEtiqueta}>Tarjeta de débito</Text><Text style={s.bancoValor}>{banco.tarjeta}</Text></View>}
              </View>
            </View>
          )}
          <Text style={s.mision}>{cfg.academia_lema}</Text>
          <View style={s.barra}>
            <Text>{cfg.academia_telefono}</Text>
            <Text style={{ flex: 1, textAlign: "center", paddingHorizontal: p(10) }}>{cfg.academia_domicilio}</Text>
            <Text>{instagram}</Text>
          </View>
          <Text style={s.emitido}>
            Emitido el {emision.dia} de {MESES[emision.mes - 1]} de {emision.anio} · Academia de Música VioliniStar
          </Text>
        </View>
      </Page>
    </Document>
  );
}
