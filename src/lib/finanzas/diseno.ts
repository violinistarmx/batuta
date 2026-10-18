/**
 * Diseño personalizable del dashboard: qué gráficas se ven, dónde, de qué tamaño,
 * de qué tipo y con qué paleta. Puro: valida lo que llega del navegador o de la
 * base antes de usarlo, para que un JSON roto nunca deje el dashboard en blanco.
 */

export type IdWidget =
  | "kpis" | "equilibrio" | "observaciones" | "mensual" | "categorias" | "treemap"
  | "programas" | "flujo" | "retencion" | "cac" | "instrumentos" | "matriz" | "profit_first";

export type TipoGrafica = "barras" | "lineas" | "area" | "dona" | "tabla" | "treemap";

export type DefinicionWidget = {
  id: IdWidget;
  titulo: string;
  /** Tipos que tienen sentido para estos datos; el primero es el de omisión. */
  tipos: TipoGrafica[];
  /** Tamaño mínimo en la cuadrícula de 12 columnas. */
  minW: number;
  minH: number;
};

export const WIDGETS: DefinicionWidget[] = [
  { id: "kpis", titulo: "Indicadores clave", tipos: [], minW: 6, minH: 10 },
  { id: "mensual", titulo: "Ingresos vs egresos por mes", tipos: ["barras", "lineas", "area"], minW: 4, minH: 6 },
  { id: "equilibrio", titulo: "Punto de equilibrio", tipos: [], minW: 3, minH: 3 },
  { id: "observaciones", titulo: "Observaciones", tipos: [], minW: 3, minH: 4 },
  { id: "categorias", titulo: "Gastos por categoría", tipos: ["dona", "barras"], minW: 3, minH: 6 },
  { id: "treemap", titulo: "Mapa de gastos", tipos: ["treemap", "barras"], minW: 3, minH: 6 },
  { id: "programas", titulo: "Margen por programa", tipos: ["barras", "tabla"], minW: 3, minH: 6 },
  { id: "flujo", titulo: "Flujo de caja acumulado", tipos: ["area", "lineas", "barras"], minW: 4, minH: 5 },
  { id: "retencion", titulo: "Retención mensual", tipos: ["lineas", "barras"], minW: 4, minH: 5 },
  { id: "cac", titulo: "Costo de adquisición por canal", tipos: ["barras", "tabla"], minW: 4, minH: 5 },
  { id: "instrumentos", titulo: "Margen por instrumento (6 meses)", tipos: ["lineas", "barras", "tabla"], minW: 4, minH: 5 },
  { id: "matriz", titulo: "Matriz mensual de egresos", tipos: [], minW: 6, minH: 10 },
  { id: "profit_first", titulo: "Profit First", tipos: ["barras", "tabla"], minW: 4, minH: 5 },
];

export type Paleta = {
  id: string;
  nombre: string;
  /** [principal/ingresos, costo docente, gastos, resultado]. Validadas contra daltonismo. */
  series: [string, string, string, string];
};

/**
 * Validadas con el validador de la guía de visualización en el orden en que quedan
 * juntas en las gráficas. No agregar una sin volver a correrlo.
 */
export const PALETAS: Paleta[] = [
  { id: "violinistar", nombre: "VioliniStar", series: ["#2a78d6", "#1baf7a", "#eb6834", "#6250d6"] },
  { id: "profunda", nombre: "Profunda (más contraste)", series: ["#184f95", "#199e70", "#d95926", "#6250d6"] },
  { id: "violeta", nombre: "Violeta", series: ["#6250d6", "#1baf7a", "#eb6834", "#2a78d6"] },
];

export type Posicion = { i: IdWidget; x: number; y: number; w: number; h: number };

export type Diseno = {
  version: 1;
  posiciones: Posicion[];
  /** Tipo elegido por widget; si falta o no es válido, el de omisión. */
  tipos: Partial<Record<IdWidget, TipoGrafica>>;
  paleta: string;
};

const COLUMNAS = 12;

export const DISENO_INICIAL: Diseno = {
  version: 1,
  paleta: "violinistar",
  tipos: {},
  posiciones: [
    { i: "kpis", x: 0, y: 0, w: 12, h: 12 },
    { i: "mensual", x: 0, y: 12, w: 8, h: 9 },
    { i: "equilibrio", x: 8, y: 12, w: 4, h: 4 },
    { i: "observaciones", x: 8, y: 16, w: 4, h: 5 },
    { i: "categorias", x: 0, y: 21, w: 4, h: 8 },
    { i: "treemap", x: 4, y: 21, w: 4, h: 8 },
    { i: "programas", x: 8, y: 21, w: 4, h: 8 },
    { i: "flujo", x: 0, y: 29, w: 6, h: 7 },
    { i: "retencion", x: 6, y: 29, w: 6, h: 7 },
    { i: "cac", x: 0, y: 36, w: 6, h: 7 },
    { i: "instrumentos", x: 6, y: 36, w: 6, h: 7 },
    { i: "matriz", x: 0, y: 43, w: 12, h: 12 },
    { i: "profit_first", x: 0, y: 55, w: 12, h: 6 },
  ],
};

const definicion = (id: string) => WIDGETS.find((w) => w.id === id);
const entero = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

/**
 * Convierte lo que venga (JSON de la base o del navegador) en un diseño válido.
 * Lo inválido se descarta; si no queda ningún widget, se vuelve al inicial.
 */
export function validarDiseno(crudo: unknown): Diseno {
  if (typeof crudo !== "object" || crudo === null) return DISENO_INICIAL;
  const c = crudo as Record<string, unknown>;

  const vistas = new Set<string>();
  const posiciones: Posicion[] = [];
  for (const p of Array.isArray(c.posiciones) ? c.posiciones : []) {
    if (typeof p !== "object" || p === null) continue;
    const q = p as Record<string, unknown>;
    const def = typeof q.i === "string" ? definicion(q.i) : undefined;
    if (!def || vistas.has(def.id)) continue;
    const w = entero(q.w, def.minW, COLUMNAS);
    // Una altura menor a la mínima (diseños guardados antes de subirla) se sube, no se descarta:
    // descartar quitaría el widget entero del dashboard.
    const hCruda = entero(q.h, 1, 40);
    const h = hCruda === null ? null : Math.max(hCruda, def.minH);
    const x = entero(q.x, 0, COLUMNAS - 1);
    const y = entero(q.y, 0, 500);
    if (w === null || h === null || x === null || y === null) continue;
    vistas.add(def.id);
    posiciones.push({ i: def.id, x: Math.min(x, COLUMNAS - w), y, w, h });
  }
  if (posiciones.length === 0) return DISENO_INICIAL;

  const tipos: Diseno["tipos"] = {};
  if (typeof c.tipos === "object" && c.tipos !== null) {
    for (const [id, t] of Object.entries(c.tipos as Record<string, unknown>)) {
      const def = definicion(id);
      if (def && typeof t === "string" && def.tipos.includes(t as TipoGrafica)) tipos[def.id] = t as TipoGrafica;
    }
  }

  const paleta = typeof c.paleta === "string" && PALETAS.some((p) => p.id === c.paleta) ? c.paleta : "violinistar";
  return { version: 1, posiciones, tipos, paleta };
}

/** Lee el JSON guardado sin lanzar nunca. */
export function leerDiseno(json: string | null | undefined): Diseno {
  if (!json) return DISENO_INICIAL;
  try {
    return validarDiseno(JSON.parse(json));
  } catch {
    return DISENO_INICIAL;
  }
}

/** Tipo efectivo de un widget. */
export function tipoDe(d: Diseno, id: IdWidget): TipoGrafica | null {
  const def = definicion(id);
  if (!def || def.tipos.length === 0) return null;
  return d.tipos[id] ?? def.tipos[0]!;
}

export function paletaDe(d: Diseno): Paleta {
  return PALETAS.find((p) => p.id === d.paleta) ?? PALETAS[0]!;
}

/** Agrega un widget oculto al final de la cuadrícula, con su tamaño de omisión. */
export function agregarWidget(d: Diseno, id: IdWidget): Diseno {
  if (d.posiciones.some((p) => p.i === id)) return d;
  const base = DISENO_INICIAL.posiciones.find((p) => p.i === id);
  const def = definicion(id);
  if (!def) return d;
  const fondo = d.posiciones.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  return {
    ...d,
    posiciones: [...d.posiciones, { i: id, x: 0, y: fondo, w: base?.w ?? 6, h: base?.h ?? def.minH }],
  };
}

export function quitarWidget(d: Diseno, id: IdWidget): Diseno {
  const posiciones = d.posiciones.filter((p) => p.i !== id);
  return posiciones.length === 0 ? d : { ...d, posiciones };
}

/** Widgets que no están en el diseño: el catálogo de «Agregar gráfica». */
export function ocultos(d: Diseno): DefinicionWidget[] {
  return WIDGETS.filter((w) => !d.posiciones.some((p) => p.i === w.id));
}
