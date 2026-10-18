/**
 * Arma el dashboard de finanzas a partir de los hechos. Función pura: el mismo
 * resultado alimenta la pantalla y el reporte PDF, y se prueba sin base de datos.
 *
 * Reglas de lectura:
 * - Ingresos: pagos reales por fecha de pago. Nada se cuenta como cobrado sin pago.
 * - Costo docente: clases impartidas por fecha de clase, con la regla de la nómina
 *   (si la clase ya tiene partida, manda su importe). Es el costo del estado de
 *   resultados; la nómina pagada se usa solo para el flujo de caja.
 * - Gastos: por fecha del gasto. Con filtro de instrumento o maestro no se puede
 *   atribuir ningún gasto, y con filtro de sede o programa solo cuentan los gastos
 *   asignados a esa sede o ese programa: los generales quedan fuera.
 * - Productos: ingreso = dinero real cobrado; costo = el del cargo, congelado al venderlo, en
 *   la proporción en que se saldó. Entran al ingreso total y su costo a los egresos, pero NO a
 *   la base del costo docente ni del punto de equilibrio (no son por alumno). El filtro
 *   «Línea» muestra todo, solo clases o solo productos; un filtro de programa, instrumento o
 *   maestro deja fuera los productos (no se pueden atribuir).
 */

import { pesosExactos } from "../formato.ts";
import { importeDocenteCentavos } from "../dominio/nomina.ts";
import {
  limitesDeMes, mesAnterior, mesesDelAnio, mismoMesAnioAnterior, nombreCortoDeMes, nombreDeMes,
  ultimosMesesHasta,
} from "./fechas.ts";
import {
  cac as calcularCac, costoPorAlumno, margenBruto, margenNeto, porcentajeCobranza, proporcion,
  puntoEquilibrio, rentabilidad, retencion, semaforo, variacion, type Semaforo,
} from "./indicadores.ts";
import { observaciones, type Corte } from "./observaciones.ts";
import { repartoProfitFirst } from "./profit-first.ts";
import type {
  Dashboard, Dimensiones, FilaCanal, FilaInstrumento, FilaMatriz, FilaMes, FilaProducto, FilaRentable,
  Filtros, GastoCategoria, HechoGasto, HechoInscripcion, Hechos, Kpi, OpcionesDashboard, Periodo,
  ResumenProductos,
} from "./tipos";

export const COLOR_COSTO_DOCENTE = "#7c3aed";
export const COLOR_COSTO_PRODUCTOS = "#0d9488";

export const CANALES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  recomendacion: "Recomendación",
  whatsapp: "WhatsApp",
  google: "Google",
  paso_por_la_calle: "Pasó por la calle",
  evento: "Evento",
  otro: "Otro",
  sin_dato: "Sin dato",
  sin_canal: "Publicidad sin canal",
};

// ── Filtros ──────────────────────────────────────────────────────────────────

const DIMENSIONES = ["programaId", "instrumentoId", "sedeId", "docenteId"] as const;

function coincide(d: Dimensiones, f: Filtros, ignorar?: keyof Dimensiones): boolean {
  return DIMENSIONES.every((k) => k === ignorar || f[k] === null || d[k] === f[k]);
}

function coincideGasto(g: HechoGasto, f: Filtros, ignorarCategoria = false): boolean {
  if (f.linea === "productos") return false;
  if (f.instrumentoId !== null || f.docenteId !== null) return false;
  if (f.sedeId !== null && g.sedeId !== f.sedeId) return false;
  if (f.programaId !== null && g.programaId !== f.programaId) return false;
  if (!ignorarCategoria && f.categoriaId !== null && g.categoriaId !== f.categoriaId) return false;
  return true;
}

// ── Medidas de dinero ────────────────────────────────────────────────────────

type Medidas = {
  /** Total cobrado: clases más productos, según el filtro. */
  ingresos: number;
  ingresosClases: number;
  ingresosProductos: number;
  /** Costo de los productos cobrados. */
  costoProductos: number;
  /** Cobrado de productos sin costo registrado. */
  productosSinCosto: number;
  costoDocente: number;
  horas: number;
  nominaPagada: number;
  gastos: number;
  gastosFijos: number;
  gastosVariables: number;
  publicidad: number;
  facturado: number;
  saldado: number;
};

function medir(h: Hechos, meses: string[], f: Filtros, op: OpcionesDashboard): Medidas {
  const en = new Set(meses);
  const publicidadIds = new Set(h.catalogos.categorias.filter((c) => c.clave === "publicidad").map((c) => c.id));
  const m: Medidas = {
    ingresos: 0, ingresosClases: 0, ingresosProductos: 0, costoProductos: 0, productosSinCosto: 0,
    costoDocente: 0, horas: 0, nominaPagada: 0, gastos: 0, gastosFijos: 0,
    gastosVariables: 0, publicidad: 0, facturado: 0, saldado: 0,
  };
  const conClases = f.linea !== "productos";
  const conProductos = f.linea !== "clases"
    && f.programaId === null && f.instrumentoId === null && f.docenteId === null;

  if (conClases) {
    for (const x of h.ingresos) if (en.has(x.mes) && coincide(x, f)) m.ingresosClases += x.centavos;
  }

  if (conProductos) {
    for (const p of h.productos) {
      if (!en.has(p.mes) || (f.sedeId !== null && p.sedeId !== f.sedeId)) continue;
      m.ingresosProductos += p.ingreso;
      m.costoProductos += p.costo;
      m.productosSinCosto += p.sinCosto;
    }
  }

  for (const c of h.clases) {
    if (!conClases || !en.has(c.mes) || !coincide(c, f)) continue;
    m.costoDocente += c.importePartida
      ?? importeDocenteCentavos(c.minutos, c.estado, op.nomina, c.tarifaDocente ?? c.tarifaPrograma);
    // Horas impartidas: el maestro estuvo frente al horario (asistió o el alumno faltó sin avisar).
    if (c.estado === "asistio" || c.estado === "falta") m.horas += c.minutos / 60;
  }

  if (conClases) for (const n of h.nomina) if (en.has(n.mes) && coincide(n, f)) m.nominaPagada += n.centavos;

  for (const g of h.gastos) {
    if (!en.has(g.mes) || !coincideGasto(g, f)) continue;
    m.gastos += g.centavos;
    if (g.tipo === "fijo") m.gastosFijos += g.centavos; else m.gastosVariables += g.centavos;
    if (g.categoriaId !== null && publicidadIds.has(g.categoriaId)) m.publicidad += g.centavos;
  }

  for (const c of h.cargos) {
    if (!en.has(c.mes) || !(c.producto ? conProductos : conClases) || !coincide(c, f)) continue;
    m.facturado += c.facturado;
    m.saldado += c.saldado;
  }

  m.ingresosClases = Math.round(m.ingresosClases);
  m.ingresosProductos = Math.round(m.ingresosProductos);
  m.costoProductos = Math.round(m.costoProductos);
  m.productosSinCosto = Math.round(m.productosSinCosto);
  m.ingresos = m.ingresosClases + m.ingresosProductos;
  return m;
}

// ── Alumnos ──────────────────────────────────────────────────────────────────

type Alumnos = {
  activos: number;
  iniciaron: number;
  continuan: number;
  altas: number;
  bajas: number;
  nuevos: number;
  nuevosPorCanal: Map<string, number>;
};

function activosEn(insc: HechoInscripcion[], fecha: string): Set<number> {
  const s = new Set<number>();
  for (const i of insc) {
    if (i.fechaInicio <= fecha && (i.fechaFin === null || i.fechaFin >= fecha)) s.add(i.alumnoId);
  }
  return s;
}

function contarAlumnos(
  h: Hechos,
  inicio: string,
  fin: string,
  f: Filtros,
  primeraInscripcion: Map<number, string>,
): Alumnos {
  const insc = h.inscripciones.filter((i) => coincide(i, f));
  const alInicio = activosEn(insc, inicio);
  const alFin = activosEn(insc, fin);
  let continuan = 0;
  for (const a of alInicio) if (alFin.has(a)) continuan++;
  let altas = 0;
  for (const a of alFin) if (!alInicio.has(a)) altas++;

  // Nuevo = su primera inscripción en la academia (de cualquier programa) cae en el
  // periodo, y tiene alguna inscripción que coincide con los filtros.
  const nuevos = new Set<number>();
  const canalDe = new Map<number, string>();
  for (const i of insc) {
    const primera = primeraInscripcion.get(i.alumnoId);
    if (primera !== undefined && primera >= inicio && primera <= fin) {
      nuevos.add(i.alumnoId);
      canalDe.set(i.alumnoId, i.origen ?? "sin_dato");
    }
  }
  const nuevosPorCanal = new Map<string, number>();
  for (const canal of canalDe.values()) nuevosPorCanal.set(canal, (nuevosPorCanal.get(canal) ?? 0) + 1);

  return {
    activos: alFin.size,
    iniciaron: alInicio.size,
    continuan,
    altas,
    bajas: alInicio.size - continuan,
    nuevos: nuevos.size,
    nuevosPorCanal,
  };
}

// ── Periodos ─────────────────────────────────────────────────────────────────

function mesesDe(p: Periodo): string[] {
  return p.modo === "mes" ? [p.mes] : mesesDelAnio(p.anio);
}

function anioDe(p: Periodo): number {
  return p.modo === "mes" ? Number(p.mes.slice(0, 4)) : p.anio;
}

function mesesComparados(p: Periodo, c: OpcionesDashboard["comparacion"]): string[] {
  if (p.modo === "anio") return mesesDelAnio(p.anio - 1);
  return [c === "anterior" ? mesAnterior(p.mes) : mismoMesAnioAnterior(p.mes)];
}

function etiquetaDe(meses: string[], modo: Periodo["modo"]): string {
  const mes = meses[0]!;
  return modo === "anio" ? `Año ${mes.slice(0, 4)}` : `${nombreDeMes(mes)} ${mes.slice(0, 4)}`;
}

/** Del primer día del primer mes al último día del último, sin pasar de hoy. */
function rango(meses: string[], hoy: string): [string, string] {
  const inicio = limitesDeMes(meses[0]!)[0];
  const fin = limitesDeMes(meses[meses.length - 1]!)[1];
  return [inicio, fin < hoy ? fin : hoy];
}

function mesesTranscurridos(meses: string[], hoy: string): number {
  return Math.max(1, meses.filter((m) => m <= hoy.slice(0, 7)).length);
}

// ── Corte: todos los indicadores de un conjunto de meses ─────────────────────

type ValoresCorte = {
  med: Medidas;
  alumnos: Alumnos;
  porCobrar: number;
  cobranza: number | null;
  costoPct: number | null;
  margenBruto: number | null;
  margenNeto: number | null;
  egresos: number;
  resultado: number;
  flujo: number;
  retencion: number | null;
  cac: number | null;
  costoPorAlumno: number | null;
  equilibrio: Dashboard["equilibrio"];
};

function calcularCorte(
  h: Hechos, meses: string[], f: Filtros, op: OpcionesDashboard, primera: Map<number, string>,
): ValoresCorte {
  const med = medir(h, meses, f, op);
  const [inicio, fin] = rango(meses, op.hoy);
  const alumnos = inicio > op.hoy
    ? { activos: 0, iniciaron: 0, continuan: 0, altas: 0, bajas: 0, nuevos: 0, nuevosPorCanal: new Map() }
    : contarAlumnos(h, inicio, fin, f, primera);
  const egresos = med.costoDocente + med.costoProductos + med.gastos;
  const n = mesesTranscurridos(meses, op.hoy);
  const a = alumnos.activos;
  // El punto de equilibrio es por alumno: solo cuentan los ingresos de clases.
  const equilibrio = puntoEquilibrio(
    med.gastosFijos / n,
    a === 0 ? 0 : med.ingresosClases / n / a,
    a === 0 ? 0 : (med.costoDocente + med.gastosVariables) / n / a,
    a,
  );
  return {
    med,
    alumnos,
    porCobrar: med.facturado - med.saldado,
    cobranza: porcentajeCobranza(med.saldado, med.facturado),
    // El costo docente se mide contra lo que cobran las clases, no contra las ventas de productos.
    costoPct: proporcion(med.costoDocente, med.ingresosClases),
    margenBruto: margenBruto(med.ingresos, med.costoDocente + med.costoProductos),
    margenNeto: margenNeto(med.ingresos, egresos),
    egresos,
    resultado: med.ingresos - egresos,
    flujo: med.ingresos - med.nominaPagada - med.costoProductos - med.gastos,
    retencion: retencion(alumnos.iniciaron, alumnos.continuan),
    cac: calcularCac(med.publicidad, alumnos.nuevos),
    costoPorAlumno: costoPorAlumno(egresos, a),
    equilibrio: { ...equilibrio, alumnosActuales: a, gastosFijosMensuales: Math.round(med.gastosFijos / n) },
  };
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

/** Semáforo por tendencia, para indicadores sin meta: subir 0 o más es verde. */
function porTendencia(v: number | null): Semaforo {
  if (v === null) return "sin_dato";
  if (v >= 0) return "verde";
  return v >= -0.1 ? "ambar" : "rojo";
}

function kpi(
  clave: string, titulo: string, formato: Kpi["formato"], valor: number | null, anterior: number | null,
  subirEsBueno: boolean, sem: Semaforo, meta: string | null, detalle: string | null,
): Kpi {
  const variacionKpi = valor === null || anterior === null
    ? null
    : formato === "porcentaje" ? valor - anterior : variacion(valor, anterior);
  return { clave, titulo, valor, formato, anterior, variacion: variacionKpi, subirEsBueno, semaforo: sem, meta, detalle };
}

function armarKpis(
  a: ValoresCorte, b: ValoresCorte, op: OpcionesDashboard, flujoAcumuladoAnio: number,
): Kpi[] {
  const m = op.metas;
  const t = m.tolerancia;
  const varIngresos = variacion(a.med.ingresos, b.med.ingresos);
  const varCostoAlumno = a.costoPorAlumno === null || b.costoPorAlumno === null
    ? null : variacion(a.costoPorAlumno, b.costoPorAlumno);
  const eq = a.equilibrio;

  return [
    kpi("ingresos", "Ingresos cobrados", "moneda", a.med.ingresos, b.med.ingresos, true,
      porTendencia(varIngresos), null,
      a.med.ingresosProductos > 0
        ? `Clases ${pesosExactos(a.med.ingresosClases)} · productos ${pesosExactos(a.med.ingresosProductos)}`
        : "Pagos recibidos en el periodo"),
    kpi("por_cobrar", "Por cobrar", "moneda", a.porCobrar, b.porCobrar, false,
      semaforo(a.cobranza, m.cobranzaMin, "minimo", t), `Cobranza > ${pct(m.cobranzaMin)}`,
      `Cobranza ${pct(a.cobranza)} de lo facturado`),
    kpi("costo_docente", "Costo docente", "moneda", a.med.costoDocente, b.med.costoDocente, false,
      semaforo(a.costoPct, m.costoDocenteMax, "maximo", t), `Meta < ${pct(m.costoDocenteMax)}`,
      `${pct(a.costoPct)} de los ingresos · ${Math.round(a.med.horas)} h impartidas`),
    kpi("margen_bruto", "Margen bruto", "porcentaje", a.margenBruto, b.margenBruto, true,
      semaforo(a.margenBruto, m.margenBrutoMin, "minimo", t), `Meta > ${pct(m.margenBrutoMin)}`,
      a.med.costoProductos > 0 ? "Ingresos menos costo docente y de productos" : "Ingresos menos costo docente"),
    kpi("margen_neto", "Margen operativo neto", "porcentaje", a.margenNeto, b.margenNeto, true,
      semaforo(a.margenNeto, m.margenNetoMin, "minimo", t), `Meta > ${pct(m.margenNetoMin)}`,
      `Resultado ${pesosExactos(a.resultado)}`),
    kpi("flujo", "Flujo de caja", "moneda", a.flujo, b.flujo, true,
      a.med.ingresos === 0 && a.med.nominaPagada === 0 && a.med.gastos === 0 && a.med.costoProductos === 0
        ? "sin_dato" : a.flujo >= 0 ? "verde" : "rojo",
      null, `Acumulado del año ${pesosExactos(flujoAcumuladoAnio)}`),
    kpi("alumnos", "Alumnos activos", "numero", a.alumnos.activos, b.alumnos.activos, true,
      semaforo(a.retencion, m.retencionMin, "minimo", t), `Retención > ${pct(m.retencionMin)}`,
      `Retención ${pct(a.retencion)} · ${a.alumnos.altas} altas, ${a.alumnos.bajas} bajas`),
    kpi("cac", "Costo de adquisición (CAC)", "moneda", a.cac, b.cac, false,
      semaforo(a.cac, m.cacMaxCentavos, "maximo", t), `Meta < ${pesosExactos(m.cacMaxCentavos)}`,
      `${a.alumnos.nuevos} alumno${a.alumnos.nuevos === 1 ? "" : "s"} nuevo${a.alumnos.nuevos === 1 ? "" : "s"} · ` +
        `${pesosExactos(a.med.publicidad)} en publicidad`),
    kpi("costo_alumno", "Costo operativo por alumno", "moneda", a.costoPorAlumno, b.costoPorAlumno, false,
      porTendencia(varCostoAlumno === null ? null : -varCostoAlumno), null,
      "Costo docente y gastos / alumnos activos"),
    kpi("equilibrio", "Punto de equilibrio", "numero", eq.alumnosMinimos, b.equilibrio.alumnosMinimos, false,
      eq.avance === null ? "sin_dato" : eq.avance >= 1 ? "verde" : eq.avance >= 0.9 ? "ambar" : "rojo",
      null,
      eq.alumnosMinimos === null
        ? "Cada alumno cuesta lo mismo o más de lo que aporta"
        : `${eq.alumnosActuales} alumnos actuales de ${eq.alumnosMinimos} necesarios`),
  ];
}

// ── Rentabilidad por dimensión ───────────────────────────────────────────────

function porDimension(
  h: Hechos, meses: string[], op: OpcionesDashboard, primera: Map<number, string>,
  dim: "programaId" | "instrumentoId", catalogo: { id: number; nombre: string }[],
): FilaRentable[] {
  const [inicio, fin] = rango(meses, op.hoy);
  const filas = catalogo.map((c) => {
    const f = { ...op.filtros, [dim]: c.id };
    const med = medir(h, meses, f, op);
    const alumnos = inicio > op.hoy ? 0 : contarAlumnos(h, inicio, fin, f, primera).activos;
    return {
      id: c.id, nombre: c.nombre, alumnos,
      ingresos: med.ingresos, costoDocente: med.costoDocente, horas: Math.round(med.horas * 10) / 10,
    };
  }).filter((x) => x.ingresos !== 0 || x.costoDocente !== 0 || x.alumnos !== 0);
  return rentabilidad(filas);
}

// ── Gastos por categoría y matriz ────────────────────────────────────────────

function gastosPorCategoria(h: Hechos, meses: string[], f: Filtros): GastoCategoria[] {
  const en = new Set(meses);
  const porCat = new Map<number | null, { total: number; sub: Map<string, number> }>();
  for (const g of h.gastos) {
    if (!en.has(g.mes) || !coincideGasto(g, f, true)) continue;
    const e = porCat.get(g.categoriaId) ?? { total: 0, sub: new Map() };
    e.total += g.centavos;
    const s = g.subcategoria?.trim() || "General";
    e.sub.set(s, (e.sub.get(s) ?? 0) + g.centavos);
    porCat.set(g.categoriaId, e);
  }
  const total = [...porCat.values()].reduce((s, e) => s + e.total, 0);
  return [...porCat.entries()].map(([id, e]) => {
    const cat = h.catalogos.categorias.find((c) => c.id === id);
    return {
      id,
      nombre: cat?.nombre ?? "Sin categoría",
      color: cat?.color ?? "#94a3b8",
      total: e.total,
      porcentaje: proporcion(e.total, total),
      subcategorias: [...e.sub.entries()]
        .map(([nombre, t]) => ({ nombre, total: t }))
        .sort((a, b) => b.total - a.total),
    };
  }).sort((a, b) => b.total - a.total);
}

function armarMatriz(h: Hechos, anio: number, op: OpcionesDashboard): Dashboard["matriz"] {
  const meses = mesesDelAnio(anio);
  const f = op.filtros;
  const costo = meses.map((m) => medir(h, [m], { ...f, categoriaId: null }, op).costoDocente);
  const filas: FilaMatriz[] = [{
    id: "costo_docente", nombre: "Costo docente (clases impartidas)", color: COLOR_COSTO_DOCENTE,
    valores: costo, total: costo.reduce((s, v) => s + v, 0), calculada: true,
  }];

  const costoProd = meses.map((m) => medir(h, [m], { ...f, categoriaId: null }, op).costoProductos);
  if (costoProd.some((v) => v !== 0)) {
    filas.push({
      id: "costo_productos", nombre: "Costo de productos vendidos", color: COLOR_COSTO_PRODUCTOS,
      valores: costoProd, total: costoProd.reduce((s, v) => s + v, 0), calculada: true,
    });
  }

  const idx = new Map(meses.map((m, i) => [m, i]));
  const porCat = new Map<number | null, number[]>();
  for (const g of h.gastos) {
    const i = idx.get(g.mes);
    if (i === undefined || !coincideGasto(g, f, true)) continue;
    const v = porCat.get(g.categoriaId) ?? meses.map(() => 0);
    v[i]! += g.centavos;
    porCat.set(g.categoriaId, v);
  }
  const orden = [...h.catalogos.categorias.map((c) => c.id as number | null), null];
  for (const id of orden) {
    const v = porCat.get(id);
    if (!v) continue;
    const cat = h.catalogos.categorias.find((c) => c.id === id);
    filas.push({
      id: `cat-${id ?? "sin"}`, nombre: cat?.nombre ?? "Sin categoría", color: cat?.color ?? "#94a3b8",
      valores: v, total: v.reduce((s, x) => s + x, 0), calculada: false,
    });
  }
  const totalesMes = meses.map((_, i) => filas.reduce((s, fila) => s + fila.valores[i]!, 0));
  return { meses, filas, totalesMes, total: totalesMes.reduce((s, v) => s + v, 0) };
}

// ── CAC por canal ────────────────────────────────────────────────────────────

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

function canalDeSubcategoria(sub: string | null): string {
  if (!sub) return "sin_canal";
  const n = normalizar(sub);
  return n in CANALES && n !== "sin_dato" && n !== "sin_canal" ? n : "sin_canal";
}

function cacPorCanal(h: Hechos, meses: string[], f: Filtros, alumnos: Alumnos): FilaCanal[] {
  const en = new Set(meses);
  const publicidad = new Set(h.catalogos.categorias.filter((c) => c.clave === "publicidad").map((c) => c.id));
  const gasto = new Map<string, number>();
  for (const g of h.gastos) {
    if (!en.has(g.mes) || g.categoriaId === null || !publicidad.has(g.categoriaId)) continue;
    if (!coincideGasto(g, f, true)) continue;
    const canal = canalDeSubcategoria(g.subcategoria);
    gasto.set(canal, (gasto.get(canal) ?? 0) + g.centavos);
  }
  const canales = new Set([...gasto.keys(), ...alumnos.nuevosPorCanal.keys()]);
  return [...canales].map((canal) => {
    const nuevos = alumnos.nuevosPorCanal.get(canal) ?? 0;
    const g = gasto.get(canal) ?? 0;
    return { canal, etiqueta: CANALES[canal] ?? canal, nuevos, gasto: g, cac: calcularCac(g, nuevos) };
  }).sort((a, b) => b.nuevos - a.nuevos || b.gasto - a.gasto);
}

// ── Productos ────────────────────────────────────────────────────────────────

/**
 * Lo vendido por producto en el periodo, con su margen. El margen solo cuenta lo cobrado de
 * ventas con costo registrado: lo que se cobró sin costo se avisa aparte (`sinCosto`), porque
 * tratarlo como ganancia pura inflaría el margen.
 */
function resumenProductos(h: Hechos, meses: string[], f: Filtros): ResumenProductos {
  const en = new Set(meses);
  const visible = f.linea !== "clases" && f.programaId === null && f.instrumentoId === null && f.docenteId === null;
  const porClave = new Map<string, FilaProducto>();

  if (visible) {
    for (const p of h.productos) {
      if (!en.has(p.mes) || (f.sedeId !== null && p.sedeId !== f.sedeId)) continue;
      const clave = p.productoId !== null ? `id:${p.productoId}` : `libre:${p.nombre}`;
      const fila = porClave.get(clave) ?? {
        id: p.productoId, nombre: p.nombre, unidades: 0, ingresos: 0, costo: 0, margen: 0, margenPct: null, sinCosto: 0,
      };
      fila.unidades += p.unidades;
      fila.ingresos += p.ingreso;
      fila.costo += p.costo;
      fila.sinCosto += p.sinCosto;
      porClave.set(clave, fila);
    }
  }

  const filas = [...porClave.values()].map((x) => {
    const conCosto = x.ingresos - x.sinCosto;
    const margen = conCosto - x.costo;
    return {
      ...x,
      unidades: Math.round(x.unidades * 10) / 10,
      ingresos: Math.round(x.ingresos), costo: Math.round(x.costo), sinCosto: Math.round(x.sinCosto),
      margen: Math.round(margen), margenPct: proporcion(margen, conCosto),
    };
  }).sort((a, b) => b.margen - a.margen || b.ingresos - a.ingresos);

  const ingresos = filas.reduce((s, x) => s + x.ingresos, 0);
  const costo = filas.reduce((s, x) => s + x.costo, 0);
  const sinCosto = filas.reduce((s, x) => s + x.sinCosto, 0);
  const margen = ingresos - sinCosto - costo;
  return {
    ingresos, costo, margen, margenPct: proporcion(margen, ingresos - sinCosto),
    unidades: Math.round(filas.reduce((s, x) => s + x.unidades, 0) * 10) / 10,
    sinCosto, filas,
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function armarDashboard(h: Hechos, op: OpcionesDashboard): Dashboard {
  const meses = mesesDe(op.periodo);
  const anio = anioDe(op.periodo);
  const comparados = mesesComparados(op.periodo, op.comparacion);
  const f = op.filtros;

  const primera = new Map<number, string>();
  for (const i of h.inscripciones) {
    const p = primera.get(i.alumnoId);
    if (p === undefined || i.fechaInicio < p) primera.set(i.alumnoId, i.fechaInicio);
  }

  const actual = calcularCorte(h, meses, f, op, primera);
  const anterior = calcularCorte(h, comparados, f, op, primera);

  // Serie de los doce meses del año del periodo.
  const mesHoy = op.hoy.slice(0, 7);
  let acumulado = 0;
  const serie: FilaMes[] = mesesDelAnio(anio).map((mes) => {
    const futuro = mes > mesHoy;
    const c = calcularCorte(h, [mes], f, op, primera);
    acumulado += futuro ? 0 : c.flujo;
    return {
      mes, etiqueta: nombreCortoDeMes(mes), futuro,
      ingresos: c.med.ingresos, ingresosProductos: c.med.ingresosProductos,
      costoDocente: c.med.costoDocente, costoProductos: c.med.costoProductos, gastos: c.med.gastos,
      egresos: c.egresos, resultado: c.resultado, margenNeto: c.margenNeto,
      recibido: c.med.ingresos, pagado: c.med.nominaPagada + c.med.costoProductos + c.med.gastos,
      flujo: c.flujo, flujoAcumulado: acumulado,
      activos: c.alumnos.activos, retencion: c.retencion,
      altas: c.alumnos.altas, bajas: c.alumnos.bajas, nuevos: c.alumnos.nuevos,
    };
  });
  const ultimoMes = meses[meses.length - 1]! < mesHoy ? meses[meses.length - 1]! : mesHoy;
  const flujoAnio = serie.find((s) => s.mes === ultimoMes)?.flujoAcumulado
    ?? serie[serie.length - 1]?.flujoAcumulado ?? 0;

  const programas = porDimension(h, meses, op, primera, "programaId", h.catalogos.programas);
  const instrumentosBase = porDimension(h, meses, op, primera, "instrumentoId", h.catalogos.instrumentos);
  const ventana = ultimosMesesHasta(ultimoMes, 6);
  const instrumentos: FilaInstrumento[] = instrumentosBase.map((fila) => ({
    ...fila,
    tendencia: ventana.map((mes) => {
      const med = medir(h, [mes], { ...f, instrumentoId: fila.id }, op);
      return { mes, etiqueta: nombreCortoDeMes(mes), ingresos: med.ingresos, margen: med.ingresos - med.costoDocente };
    }),
  }));

  const productos = resumenProductos(h, meses, f);
  const etiquetaPeriodo = etiquetaDe(meses, op.periodo.modo);
  const etiquetaComparada = op.periodo.modo === "anio"
    ? String(anio - 1)
    : `${nombreDeMes(comparados[0]!).toLowerCase()} ${comparados[0]!.slice(0, 4)}`;

  const corte = (v: ValoresCorte, etiqueta: string): Corte => ({
    etiqueta,
    ingresos: v.med.ingresos,
    costoDocentePct: v.costoPct,
    margenNeto: v.margenNeto,
    cobranza: v.cobranza,
    retencion: v.retencion,
    cac: v.cac,
    alumnosActivos: v.alumnos.activos,
    alumnosMinimos: v.equilibrio.alumnosMinimos,
  });

  const nombres = (lista: { id: number; nombre: string }[], id: number | null) =>
    lista.find((x) => x.id === id)?.nombre ?? String(id);
  const filtrosActivos: Dashboard["filtrosActivos"] = [];
  if (f.linea !== "todo") filtrosActivos.push({ dimension: "Línea", valor: f.linea === "clases" ? "Solo clases" : "Solo productos" });
  if (f.programaId !== null) filtrosActivos.push({ dimension: "Programa", valor: nombres(h.catalogos.programas, f.programaId) });
  if (f.instrumentoId !== null) filtrosActivos.push({ dimension: "Instrumento", valor: nombres(h.catalogos.instrumentos, f.instrumentoId) });
  if (f.sedeId !== null) filtrosActivos.push({ dimension: "Sede", valor: nombres(h.catalogos.sedes, f.sedeId) });
  if (f.docenteId !== null) filtrosActivos.push({ dimension: "Maestro", valor: nombres(h.catalogos.docentes, f.docenteId) });
  if (f.categoriaId !== null) filtrosActivos.push({ dimension: "Categoría", valor: nombres(h.catalogos.categorias, f.categoriaId) });

  return {
    periodo: { etiqueta: etiquetaPeriodo, anio, meses, modo: op.periodo.modo },
    comparacion: { etiqueta: `vs ${etiquetaComparada}` },
    filtrosActivos,
    kpis: armarKpis(actual, anterior, op, flujoAnio),
    equilibrio: actual.equilibrio,
    serie,
    programas,
    instrumentos,
    categorias: gastosPorCategoria(h, meses, f),
    matriz: armarMatriz(h, anio, op),
    canales: cacPorCanal(h, meses, f, actual.alumnos),
    productos,
    profitFirst: op.profitFirst.activo
      ? repartoProfitFirst(actual.med.ingresos, actual.egresos, op.profitFirst.porcentajes)
      : null,
    observaciones: [
      ...observaciones(
        corte(actual, etiquetaPeriodo.toLowerCase()),
        corte(anterior, etiquetaComparada),
        op.metas,
        programas.map((p) => ({ nombre: p.nombre, margen: p.margen, margenPct: p.margenPct })),
      ),
      ...(productos.sinCosto > 0
        ? [`Hay ${pesosExactos(productos.sinCosto)} cobrados por productos sin costo registrado: su margen no se conoce.`]
        : []),
    ],
    catalogos: h.catalogos,
    sinDatos: actual.med.ingresos === 0 && actual.med.costoDocente === 0 && actual.med.gastos === 0
      && actual.med.costoProductos === 0 && actual.alumnos.activos === 0,
  };
}
