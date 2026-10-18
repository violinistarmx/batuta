/**
 * Reporte PDF «Hoja de cálculo de Finanzas».
 *
 * Mismo dashboard, mismo color. Las gráficas se dibujan como vectores (SVG de
 * react-pdf) con los mismos datos, no como capturas: se imprimen nítidas a
 * cualquier tamaño. Fuente Helvetica (WinAnsi): cubre acentos y ñ; por eso aquí no
 * se usan símbolos fuera de ese juego (✓, ▲, el signo menos tipográfico).
 *
 * Sin datos de contacto de maestros: ni teléfonos ni correos.
 */

import {
  Defs, Document, G, Image, LinearGradient, Page, Path, Polyline, Rect, Stop, StyleSheet, Svg, Text, View, Circle, Line,
} from "@react-pdf/renderer";

import { pesosExactos } from "../../formato.ts";
import { nombreCortoDeMes } from "../fechas.ts";
import type { Semaforo } from "../indicadores.ts";
import type { Dashboard, FilaMes, FilaRentable, GastoCategoria, Kpi } from "../tipos";
import { LOGO_ALTO, LOGO_ANCHO, LOGO_DATA_URI } from "./logo.ts";

// ── Estilo ───────────────────────────────────────────────────────────────────

const C = {
  tinta: "#221a0e", tinta2: "#4a3b28", tinta3: "#6e5c45", linea: "#e6dcc0", crema: "#fffceb",
  indigo: "#3730a3", violeta: "#7c3aed", cian: "#0891b2", dorado: "#fcd34d",
  ingresos: "#2a78d6", costo: "#1baf7a", gastos: "#eb6834", resultado: "#6250d6", negativo: "#e34948",
};

const ESTADO: Record<Semaforo, { color: string; fondo: string; texto: string }> = {
  verde: { color: "#0a7d0a", fondo: "#e8f6e8", texto: "En meta" },
  ambar: { color: "#8a5a00", fondo: "#fff4d6", texto: "Cerca del límite" },
  rojo: { color: "#b42f2f", fondo: "#fbe9e9", texto: "Fuera de meta" },
  sin_dato: { color: "#6e5c45", fondo: "#f3efe3", texto: "Sin dato" },
};

const s = StyleSheet.create({
  pagina: { paddingTop: 30, paddingBottom: 40, paddingHorizontal: 30, fontFamily: "Helvetica", fontSize: 9, color: C.tinta },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 8, color: C.tinta },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 6, color: C.tinta },
  tarjeta: { borderWidth: 1, borderColor: C.linea, borderRadius: 8, padding: 10, backgroundColor: "#ffffff" },
  pie: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C.tinta3 },
  fila: { flexDirection: "row" },
  celda: { paddingVertical: 3, paddingHorizontal: 3, textAlign: "right", fontSize: 7 },
  encabezadoTabla: { backgroundColor: C.crema, fontFamily: "Helvetica-Bold", color: C.tinta3 },
});

// ── Formato ──────────────────────────────────────────────────────────────────

const pct = (x: number | null | undefined, decimales = 0) =>
  x === null || x === undefined ? "-" : `${(x * 100).toFixed(decimales)} %`;
const compacto = (c: number) => {
  const p = c / 100;
  const a = Math.abs(p);
  const signo = p < 0 ? "-" : "";
  if (a >= 1_000_000) return `${signo}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${signo}$${(a / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  return `${signo}$${a.toFixed(0)}`;
};
function valorKpi(k: Kpi): string {
  if (k.valor === null) return "-";
  if (k.formato === "moneda") return pesosExactos(k.valor);
  if (k.formato === "porcentaje") return pct(k.valor, 1);
  return new Intl.NumberFormat("es-MX").format(k.valor);
}
function variacionKpi(k: Kpi): { texto: string; color: string } {
  if (k.variacion === null) return { texto: "sin comparación", color: C.tinta3 };
  const sube = k.variacion > 0;
  const plano = Math.abs(k.variacion) < 0.0005;
  const bueno = !plano && sube === k.subirEsBueno;
  const valor = k.formato === "porcentaje" ? `${(k.variacion * 100).toFixed(1)} pts` : `${(k.variacion * 100).toFixed(1)} %`;
  return {
    texto: `${plano ? "=" : sube ? "+" : ""}${plano ? "" : valor}`,
    color: plano ? C.tinta3 : bueno ? "#0a7d0a" : "#b42f2f",
  };
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Pie({ d }: { d: Dashboard }) {
  return (
    <View style={s.pie} fixed>
      <Text>Finanzas · VioliniStar · {d.periodo.etiqueta}. Indicador administrativo, no contabilidad fiscal.</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function Banda({ titulo, d }: { titulo: string; d: Dashboard }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Svg width={782} height={34} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="banda" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={C.indigo} />
            <Stop offset="60%" stopColor={C.violeta} />
            <Stop offset="100%" stopColor={C.cian} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={782} height={34} rx={8} fill="url(#banda)" />
      </Svg>
      <View style={{ height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
        <Text style={{ color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 13 }}>{titulo}</Text>
        <Text style={{ color: "#ffffff", fontSize: 8.5 }}>{d.periodo.etiqueta} · {d.comparacion.etiqueta}</Text>
      </View>
    </View>
  );
}

function Pastilla({ estado }: { estado: Semaforo }) {
  const e = ESTADO[estado];
  return (
    <Text style={{ backgroundColor: e.fondo, color: e.color, fontFamily: "Helvetica-Bold", fontSize: 6.5, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 6 }}>
      {e.texto}
    </Text>
  );
}

function TarjetaKpi({ k }: { k: Kpi }) {
  const v = variacionKpi(k);
  return (
    <View style={[s.tarjeta, { width: "19%", marginBottom: 8, minHeight: 84 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ fontSize: 6.5, color: C.tinta3, fontFamily: "Helvetica-Bold", width: "55%" }}>{k.titulo.toUpperCase()}</Text>
        <Pastilla estado={k.semaforo} />
      </View>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, marginTop: 6 }}>
        {valorKpi(k)}{k.clave === "equilibrio" && k.valor !== null ? " alumnos" : ""}
      </Text>
      <Text style={{ fontSize: 7, color: v.color, marginTop: 3 }}>{v.texto} <Text style={{ color: C.tinta3 }}>vs periodo comparado</Text></Text>
      {k.detalle && <Text style={{ fontSize: 6.8, color: C.tinta2, marginTop: 2 }}>{k.detalle}</Text>}
      {k.meta && <Text style={{ fontSize: 6.5, color: C.tinta3, marginTop: 1 }}>{k.meta}</Text>}
    </View>
  );
}

// ── Gráficas vectoriales ─────────────────────────────────────────────────────

function Leyenda({ items }: { items: { color: string; nombre: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
      {items.map((i) => (
        <View key={i.nombre} style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: i.color, marginRight: 3 }} />
          <Text style={{ fontSize: 7, color: C.tinta2 }}>{i.nombre}</Text>
        </View>
      ))}
    </View>
  );
}

/** Barras ingresos vs egresos (costo docente + gastos apilados) y línea de resultado, un solo eje en pesos. */
function GraficaMensual({ serie, ancho, alto }: { serie: FilaMes[]; ancho: number; alto: number }) {
  const datos = serie.map((m) => (m.futuro ? { ...m, ingresos: 0, costoDocente: 0, costoProductos: 0, gastos: 0, resultado: 0 } : m));
  const max = Math.max(1, ...datos.map((m) => Math.max(m.ingresos, m.costoDocente + m.costoProductos + m.gastos, m.resultado)));
  const min = Math.min(0, ...datos.map((m) => m.resultado));
  const y = (v: number) => alto - ((v - min) / (max - min)) * alto;
  const banda = ancho / datos.length;
  const barra = Math.min(12, banda * 0.3);
  const puntos = datos.filter((m) => !m.futuro).map((m, i) => `${banda * i + banda / 2},${y(m.resultado)}`).join(" ");
  return (
    <View>
      <Leyenda items={[
        { color: C.ingresos, nombre: "Ingresos" },
        { color: C.costo, nombre: datos.some((m) => m.costoProductos > 0) ? "Costo docente y de productos" : "Costo docente" },
        { color: C.gastos, nombre: "Gastos" }, { color: C.resultado, nombre: "Resultado neto" },
      ]} />
      <Svg width={ancho} height={alto}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Line key={f} x1={0} x2={ancho} y1={y(min + (max - min) * f)} y2={y(min + (max - min) * f)} stroke="#efe8d4" strokeWidth={0.6} />
        ))}
        <Line x1={0} x2={ancho} y1={y(0)} y2={y(0)} stroke={C.linea} strokeWidth={0.8} />
        {datos.map((m, i) => {
          const x = banda * i + banda / 2;
          const yIng = y(m.ingresos);
          const yCosto = y(m.costoDocente + m.costoProductos);
          const yTotal = y(m.costoDocente + m.costoProductos + m.gastos);
          return (
            <G key={m.mes}>
              <Rect x={x - barra - 1} y={yIng} width={barra} height={Math.max(0, y(0) - yIng)} fill={C.ingresos} rx={2} />
              <Rect x={x + 1} y={yCosto} width={barra} height={Math.max(0, y(0) - yCosto)} fill={C.costo} />
              <Rect x={x + 1} y={yTotal} width={barra} height={Math.max(0, yCosto - yTotal - 0.8)} fill={C.gastos} rx={2} />
            </G>
          );
        })}
        {puntos && <Polyline points={puntos} stroke={C.resultado} strokeWidth={1.6} fill="none" />}
        {datos.filter((m) => !m.futuro).map((m, i) => (
          <Circle key={m.mes} cx={banda * i + banda / 2} cy={y(m.resultado)} r={2} fill={C.resultado} />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", width: ancho }}>
        {datos.map((m) => (
          <Text key={m.mes} style={{ width: banda, textAlign: "center", fontSize: 6.5, color: C.tinta3, marginTop: 2 }}>{nombreCortoDeMes(m.mes)}</Text>
        ))}
      </View>
    </View>
  );
}

function arco(cx: number, cy: number, rExt: number, rInt: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(rExt, a0);
  const [x1, y1] = p(rExt, a1);
  const [x2, y2] = p(rInt, a1);
  const [x3, y3] = p(rInt, a0);
  return `M ${x0} ${y0} A ${rExt} ${rExt} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInt} ${rInt} 0 ${grande} 0 ${x3} ${y3} Z`;
}

function Dona({ categorias, tam }: { categorias: GastoCategoria[]; tam: number }) {
  const top = categorias.length > 7
    ? [...categorias.slice(0, 6), {
        id: null, nombre: `Otras (${categorias.length - 6})`, color: "#b8ad94",
        total: categorias.slice(6).reduce((t, c) => t + c.total, 0),
        porcentaje: categorias.slice(6).reduce((t, c) => t + (c.porcentaje ?? 0), 0), subcategorias: [],
      }]
    : categorias;
  const total = top.reduce((t, c) => t + c.total, 0);
  if (total <= 0) return <Text style={{ color: C.tinta3 }}>Sin gastos en el periodo.</Text>;
  let a = 0;
  const separacion = 0.02;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Svg width={tam} height={tam}>
        {top.map((c) => {
          const delta = (c.total / total) * Math.PI * 2;
          const d = arco(tam / 2, tam / 2, tam / 2, tam * 0.29, a + separacion / 2, a + Math.max(delta - separacion / 2, separacion));
          a += delta;
          return <Path key={c.nombre} d={d} fill={c.color} />;
        })}
      </Svg>
      <View style={{ marginLeft: 10, flex: 1 }}>
        {top.map((c) => (
          <View key={c.nombre} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2.5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c.color, marginRight: 4 }} />
            <Text style={{ fontSize: 7, color: C.tinta2, flex: 1 }}>{c.nombre}</Text>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>{pct(c.porcentaje)}</Text>
            <Text style={{ fontSize: 7, color: C.tinta3, width: 58, textAlign: "right" }}>{pesosExactos(c.total)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AreaFlujo({ serie, ancho, alto }: { serie: FilaMes[]; ancho: number; alto: number }) {
  const datos = serie.filter((m) => !m.futuro);
  if (datos.length === 0) return <Text style={{ color: C.tinta3 }}>Sin movimientos.</Text>;
  const vals = datos.map((m) => m.flujoAcumulado);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const rango = max - min || 1;
  const banda = ancho / 12;
  const y = (v: number) => alto - ((v - min) / rango) * alto;
  const pts = datos.map((m, i) => [banda * i + banda / 2, y(m.flujoAcumulado)] as const);
  const linea = pts.map(([x, yy]) => `${x},${yy}`).join(" ");
  const area = `M ${pts[0]![0]} ${y(0)} ${pts.map(([x, yy]) => `L ${x} ${yy}`).join(" ")} L ${pts[pts.length - 1]![0]} ${y(0)} Z`;
  return (
    <View>
      <Svg width={ancho} height={alto}>
        <Line x1={0} x2={ancho} y1={y(0)} y2={y(0)} stroke={C.linea} strokeWidth={0.8} />
        <Path d={area} fill={C.ingresos} fillOpacity={0.15} />
        <Polyline points={linea} stroke={C.ingresos} strokeWidth={1.6} fill="none" />
      </Svg>
      <View style={{ flexDirection: "row", width: ancho }}>
        {serie.map((m) => (
          <Text key={m.mes} style={{ width: banda, textAlign: "center", fontSize: 6.5, color: C.tinta3, marginTop: 2 }}>{nombreCortoDeMes(m.mes)}</Text>
        ))}
      </View>
    </View>
  );
}

function LineaRetencion({ serie, ancho, alto }: { serie: FilaMes[]; ancho: number; alto: number }) {
  const datos = serie.filter((m) => !m.futuro && m.retencion !== null);
  if (datos.length === 0) return <Text style={{ color: C.tinta3 }}>Sin alumnos.</Text>;
  const min = Math.max(0, Math.floor(Math.min(...datos.map((m) => m.retencion!)) * 10) / 10 - 0.1);
  const banda = ancho / 12;
  const y = (v: number) => alto - ((v - min) / (1 - min || 1)) * alto;
  const idx = (mes: string) => serie.findIndex((m) => m.mes === mes);
  const pts = datos.map((m) => `${banda * idx(m.mes) + banda / 2},${y(m.retencion!)}`).join(" ");
  return (
    <View>
      <Svg width={ancho} height={alto}>
        <Line x1={0} x2={ancho} y1={y(1)} y2={y(1)} stroke="#efe8d4" strokeWidth={0.6} />
        <Polyline points={pts} stroke={C.resultado} strokeWidth={1.6} fill="none" />
        {datos.map((m) => <Circle key={m.mes} cx={banda * idx(m.mes) + banda / 2} cy={y(m.retencion!)} r={2} fill={C.resultado} />)}
      </Svg>
      <View style={{ flexDirection: "row", width: ancho }}>
        {serie.map((m) => (
          <Text key={m.mes} style={{ width: banda, textAlign: "center", fontSize: 6.5, color: C.tinta3, marginTop: 2 }}>{nombreCortoDeMes(m.mes)}</Text>
        ))}
      </View>
      <Text style={{ fontSize: 6.5, color: C.tinta3, marginTop: 2 }}>Escala de {pct(min)} a 100 %.</Text>
    </View>
  );
}

function BarrasHorizontales({ filas }: { filas: FilaRentable[] }) {
  const max = Math.max(1, ...filas.map((f) => Math.abs(f.margen)));
  return (
    <View>
      {filas.map((f) => (
        <View key={f.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
          <Text style={{ width: 120, fontSize: 7, color: C.tinta2 }}>{f.posicion}. {f.nombre}</Text>
          <View style={{ flex: 1, height: 8, backgroundColor: "#f6f1e3", borderRadius: 3 }}>
            <View style={{ width: `${(Math.abs(f.margen) / max) * 100}%`, height: 8, borderRadius: 3, backgroundColor: f.margen < 0 ? C.negativo : C.ingresos }} />
          </View>
          <Text style={{ width: 80, textAlign: "right", fontSize: 7, fontFamily: "Helvetica-Bold" }}>{pesosExactos(f.margen)}</Text>
          <Text style={{ width: 34, textAlign: "right", fontSize: 7, color: C.tinta3 }}>{pct(f.margenPct)}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Tablas ───────────────────────────────────────────────────────────────────

function TablaRentabilidad({ filas, titulo }: { filas: FilaRentable[]; titulo: string }) {
  const cols: [string, number, (f: FilaRentable) => string][] = [
    ["#", 18, (f) => String(f.posicion)],
    [titulo, 150, (f) => f.nombre],
    ["Alumnos", 44, (f) => String(f.alumnos)],
    ["Ingresos", 74, (f) => pesosExactos(f.ingresos)],
    ["Horas", 40, (f) => String(f.horas)],
    ["Costo docente", 74, (f) => pesosExactos(f.costoDocente)],
    ["Margen", 74, (f) => pesosExactos(f.margen)],
    ["Margen %", 46, (f) => pct(f.margenPct)],
    ["Ingreso/hora", 62, (f) => (f.ingresoPorHora === null ? "-" : pesosExactos(f.ingresoPorHora))],
  ];
  return (
    <View style={{ borderWidth: 1, borderColor: C.linea, borderRadius: 6 }}>
      <View style={[s.fila, s.encabezadoTabla]}>
        {cols.map(([t, w], i) => <Text key={t} style={[s.celda, { width: w, textAlign: i === 1 ? "left" : "right" }]}>{t}</Text>)}
      </View>
      {filas.map((f) => (
        <View key={f.id} style={[s.fila, { borderTopWidth: 0.5, borderTopColor: C.linea }]} wrap={false}>
          {cols.map(([t, w, v], i) => (
            <Text key={t} style={[s.celda, { width: w, textAlign: i === 1 ? "left" : "right", color: t === "Margen" && f.margen < 0 ? C.negativo : C.tinta }]}>{v(f)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Matriz({ d }: { d: Dashboard }) {
  const m = d.matriz;
  const anchoConcepto = 140;
  const anchoMes = (782 - anchoConcepto - 62) / 12;
  return (
    <View style={{ borderWidth: 1, borderColor: C.linea, borderRadius: 6 }}>
      <View style={[s.fila, s.encabezadoTabla]} fixed>
        <Text style={[s.celda, { width: anchoConcepto, textAlign: "left" }]}>Concepto</Text>
        {m.meses.map((mes) => <Text key={mes} style={[s.celda, { width: anchoMes }]}>{nombreCortoDeMes(mes)}</Text>)}
        <Text style={[s.celda, { width: 62 }]}>Total</Text>
      </View>
      {m.filas.map((f) => (
        <View key={f.id} style={[s.fila, { borderTopWidth: 0.5, borderTopColor: C.linea, alignItems: "center" }]} wrap={false}>
          <View style={{ width: anchoConcepto, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color, marginRight: 4 }} />
            <Text style={{ fontSize: 7 }}>{f.nombre}</Text>
          </View>
          {f.valores.map((v, i) => <Text key={m.meses[i]} style={[s.celda, { width: anchoMes, color: v === 0 ? "#b8ad94" : C.tinta }]}>{v === 0 ? "-" : compacto(v)}</Text>)}
          <Text style={[s.celda, { width: 62, fontFamily: "Helvetica-Bold" }]}>{compacto(f.total)}</Text>
        </View>
      ))}
      <View style={[s.fila, { borderTopWidth: 1, borderTopColor: C.linea, backgroundColor: C.crema }]}>
        <Text style={[s.celda, { width: anchoConcepto, textAlign: "left", fontFamily: "Helvetica-Bold" }]}>Total egresos</Text>
        {m.totalesMes.map((v, i) => <Text key={m.meses[i]} style={[s.celda, { width: anchoMes, fontFamily: "Helvetica-Bold" }]}>{compacto(v)}</Text>)}
        <Text style={[s.celda, { width: 62, fontFamily: "Helvetica-Bold" }]}>{compacto(m.total)}</Text>
      </View>
    </View>
  );
}

// ── Documento ────────────────────────────────────────────────────────────────

export function ReporteFinanzas({ d, generado }: { d: Dashboard; generado: string }) {
  const eq = d.equilibrio;
  return (
    <Document title={`Reporte de Finanzas VioliniStar · ${d.periodo.etiqueta}`} author="Batuta · VioliniStar" language="es-MX">
      {/* ── Portada y KPIs ── */}
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <View style={{ height: 150, marginBottom: 14 }}>
          <Svg width={782} height={150} style={{ position: "absolute", top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="portada" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={C.indigo} />
                <Stop offset="45%" stopColor="#5b3fd6" />
                <Stop offset="75%" stopColor={C.violeta} />
                <Stop offset="100%" stopColor={C.cian} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={782} height={150} rx={14} fill="url(#portada)" />
            <Circle cx={720} cy={18} r={70} fill={C.dorado} fillOpacity={0.18} />
          </Svg>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 22 }}>
            <View style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 8, marginRight: 16 }}>
              <Image src={LOGO_DATA_URI} style={{ width: 62, height: (62 * LOGO_ALTO) / LOGO_ANCHO }} />
            </View>
            <View>
              <Text style={{ color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 24 }}>Finanzas · VioliniStar</Text>
              <Text style={{ color: "#ffffff", fontSize: 12, marginTop: 4 }}>Hoja de cálculo de Finanzas · {d.periodo.etiqueta}</Text>
              <Text style={{ color: "#e0e7ff", fontSize: 8.5, marginTop: 6 }}>
                Comparado {d.comparacion.etiqueta}
                {d.filtrosActivos.length > 0 ? ` · Filtros: ${d.filtrosActivos.map((f) => `${f.dimension} ${f.valor}`).join(", ")}` : " · Toda la academia"}
                {` · Generado el ${generado}`}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.h2}>Indicadores clave</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {d.kpis.map((k) => <TarjetaKpi key={k.clave} k={k} />)}
        </View>

        <View style={{ flexDirection: "row", marginTop: 4 }}>
          <View style={[s.tarjeta, { flex: 1.4, marginRight: 10 }]}>
            <Text style={s.h3}>Observaciones</Text>
            {d.observaciones.map((o) => (
              <View key={o} style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={{ color: "#f27405", marginRight: 4 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 8, color: C.tinta2 }}>{o}</Text>
              </View>
            ))}
          </View>
          <View style={[s.tarjeta, { flex: 1 }]}>
            <Text style={s.h3}>Punto de equilibrio</Text>
            {eq.alumnosMinimos === null ? (
              <Text style={{ fontSize: 8, color: C.tinta2 }}>Con el ingreso y el costo variable actuales por alumno no hay punto de equilibrio.</Text>
            ) : (
              <>
                <Text style={{ fontSize: 9 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 16 }}>{eq.alumnosActuales}</Text> alumnos actuales de{" "}
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{eq.alumnosMinimos}</Text> necesarios
                </Text>
                <View style={{ height: 9, backgroundColor: "#f6f1e3", borderRadius: 5, marginTop: 6 }}>
                  <View style={{ width: `${Math.min(1, eq.avance ?? 0) * 100}%`, height: 9, borderRadius: 5, backgroundColor: C.ingresos }} />
                </View>
                <Text style={{ fontSize: 7.5, color: C.tinta2, marginTop: 5 }}>
                  Gastos fijos de {pesosExactos(eq.gastosFijosMensuales)} al mes; cada alumno deja {pesosExactos(Math.round(eq.contribucionPorAlumno))} después de su costo variable.
                </Text>
              </>
            )}
          </View>
        </View>
        <Pie d={d} />
      </Page>

      {/* ── Gráficas ── */}
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <Banda titulo="Ingresos, egresos y flujo" d={d} />
        <View style={{ flexDirection: "row" }}>
          <View style={[s.tarjeta, { flex: 1.6, marginRight: 10 }]}>
            <Text style={s.h3}>Ingresos vs egresos por mes · {d.periodo.anio}</Text>
            <GraficaMensual serie={d.serie} ancho={440} alto={170} />
          </View>
          <View style={[s.tarjeta, { flex: 1 }]}>
            <Text style={s.h3}>Distribución de gastos por categoría</Text>
            <Dona categorias={d.categorias} tam={110} />
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          <View style={[s.tarjeta, { flex: 1, marginRight: 10 }]}>
            <Text style={s.h3}>Flujo de caja acumulado · {d.periodo.anio}</Text>
            <AreaFlujo serie={d.serie} ancho={350} alto={110} />
          </View>
          <View style={[s.tarjeta, { flex: 1 }]}>
            <Text style={s.h3}>Retención mensual · {d.periodo.anio}</Text>
            <LineaRetencion serie={d.serie} ancho={350} alto={110} />
          </View>
        </View>
        <Pie d={d} />
      </Page>

      {/* ── Matriz mensual ── */}
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <Banda titulo={`Matriz mensual de egresos · ${d.periodo.anio}`} d={d} />
        <Matriz d={d} />
        <Text style={{ fontSize: 7, color: C.tinta3, marginTop: 6 }}>
          Cifras en miles (k). El costo docente sale de las clases impartidas con la tarifa de cada maestro; los demás conceptos, de los gastos capturados.
        </Text>
        <Pie d={d} />
      </Page>

      {/* ── Rentabilidad ── */}
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <Banda titulo="Rentabilidad por programa e instrumento" d={d} />
        <View style={{ flexDirection: "row" }}>
          <View style={[s.tarjeta, { flex: 1, marginRight: 10 }]}>
            <Text style={s.h3}>Margen contributivo por programa</Text>
            {d.programas.length === 0 ? <Text style={{ color: C.tinta3 }}>Sin programas con movimiento.</Text> : <BarrasHorizontales filas={d.programas} />}
          </View>
          <View style={[s.tarjeta, { flex: 1 }]}>
            <Text style={s.h3}>Margen contributivo por instrumento</Text>
            {d.instrumentos.length === 0 ? <Text style={{ color: C.tinta3 }}>Sin instrumentos con movimiento.</Text> : <BarrasHorizontales filas={d.instrumentos} />}
          </View>
        </View>
        <Text style={[s.h3, { marginTop: 10 }]}>Ranking de rentabilidad por programa</Text>
        <TablaRentabilidad filas={d.programas} titulo="Programa" />
        <Text style={[s.h3, { marginTop: 10 }]}>Por instrumento</Text>
        <TablaRentabilidad filas={d.instrumentos} titulo="Instrumento" />

        {d.canales.length > 0 && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.h3}>Costo de adquisición por canal</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {d.canales.map((c) => (
                <View key={c.canal} style={[s.tarjeta, { width: 150, marginRight: 8, marginBottom: 6, padding: 7 }]}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{c.etiqueta}</Text>
                  <Text style={{ fontSize: 7, color: C.tinta2 }}>{c.nuevos} nuevos · {pesosExactos(c.gasto)} en publicidad</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 }}>CAC {c.cac === null ? "-" : pesosExactos(c.cac)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {d.productos.filas.length > 0 && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.h3}>
              Productos · cobrado {pesosExactos(d.productos.ingresos)}, costo {pesosExactos(d.productos.costo)}, margen {pesosExactos(d.productos.margen)} ({pct(d.productos.margenPct)})
            </Text>
            <View style={{ borderWidth: 1, borderColor: C.linea, borderRadius: 6 }}>
              <View style={[s.fila, s.encabezadoTabla]}>
                {["Producto", "Piezas", "Cobrado", "Costo", "Margen", "Margen %"].map((t, i) => (
                  <Text key={t} style={[s.celda, { width: i === 0 ? 220 : 66, textAlign: i === 0 ? "left" : "right" }]}>{t}</Text>
                ))}
              </View>
              {d.productos.filas.map((f) => {
                const sinCosto = f.sinCosto >= f.ingresos && f.ingresos > 0;
                return (
                  <View key={f.id ?? f.nombre} style={[s.fila, { borderTopWidth: 0.5, borderTopColor: C.linea }]} wrap={false}>
                    <Text style={[s.celda, { width: 220, textAlign: "left" }]}>{f.nombre}</Text>
                    <Text style={[s.celda, { width: 66 }]}>{f.unidades}</Text>
                    <Text style={[s.celda, { width: 66 }]}>{pesosExactos(f.ingresos)}</Text>
                    <Text style={[s.celda, { width: 66 }]}>{sinCosto ? "-" : pesosExactos(f.costo)}</Text>
                    <Text style={[s.celda, { width: 66, color: f.margen < 0 ? C.negativo : C.tinta }]}>{sinCosto ? "-" : pesosExactos(f.margen)}</Text>
                    <Text style={[s.celda, { width: 66 }]}>{pct(f.margenPct)}</Text>
                  </View>
                );
              })}
            </View>
            {d.productos.sinCosto > 0 && (
              <Text style={{ fontSize: 7, color: C.tinta3, marginTop: 3 }}>
                {pesosExactos(d.productos.sinCosto)} cobrados de ventas sin costo registrado: no entran al margen.
              </Text>
            )}
          </View>
        )}

        {d.profitFirst && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.h3}>Profit First: real vs objetivo</Text>
            <View style={{ flexDirection: "row" }}>
              {d.profitFirst.map((c) => (
                <View key={c.clave} style={[s.tarjeta, { flex: 1, marginRight: 8, padding: 7 }]}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{c.nombre} ({pct(c.porcentaje)})</Text>
                  <Text style={{ fontSize: 7, color: C.tinta2 }}>Objetivo {pesosExactos(c.objetivo)}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Real {pesosExactos(c.real)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <Pie d={d} />
      </Page>
    </Document>
  );
}

