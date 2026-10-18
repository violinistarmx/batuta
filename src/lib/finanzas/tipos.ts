/**
 * Tipos del dashboard de finanzas: los hechos que salen de la base, las opciones
 * del usuario y el resultado que consumen el dashboard y el PDF.
 */

import type { EstadoClase } from "../dominio/creditos";
import type { ParametrosNomina } from "../dominio/nomina";
import type { Metas } from "./observaciones";
import type { CuentaProfitFirst, PorcentajesProfitFirst } from "./profit-first";
import type { PuntoEquilibrio, Semaforo } from "./indicadores";

// ── Hechos ────────────────────────────────────────────────────────────────────

/** Dimensiones por las que se puede filtrar. NULL = no aplica o no se sabe. */
export type Dimensiones = {
  programaId: number | null;
  instrumentoId: number | null;
  docenteId: number | null;
  sedeId: number | null;
};

export type HechoIngreso = Dimensiones & { mes: string; centavos: number };

export type HechoClase = Dimensiones & {
  mes: string;
  estado: EstadoClase;
  minutos: number;
  tarifaDocente: number | null;
  tarifaPrograma: number | null;
  importePartida: number | null;
};

export type HechoNomina = Dimensiones & { mes: string; centavos: number };

export type HechoGasto = {
  mes: string;
  categoriaId: number | null;
  subcategoria: string | null;
  tipo: "fijo" | "variable";
  sedeId: number | null;
  programaId: number | null;
  centavos: number;
};

export type HechoCargo = Dimensiones & { mes: string; facturado: number; saldado: number };

export type HechoInscripcion = Dimensiones & {
  id: number;
  alumnoId: number;
  fechaInicio: string;
  fechaFin: string | null;
  origen: string | null;
};

export type ElementoCatalogo = { id: number; nombre: string };
export type CategoriaGasto = ElementoCatalogo & { color: string; clave: string | null };

export type Catalogos = {
  programas: ElementoCatalogo[];
  instrumentos: ElementoCatalogo[];
  sedes: ElementoCatalogo[];
  docentes: ElementoCatalogo[];
  categorias: CategoriaGasto[];
};

export type Hechos = {
  ingresos: HechoIngreso[];
  clases: HechoClase[];
  nomina: HechoNomina[];
  gastos: HechoGasto[];
  cargos: HechoCargo[];
  inscripciones: HechoInscripcion[];
  catalogos: Catalogos;
};

// ── Opciones ──────────────────────────────────────────────────────────────────

export type Filtros = {
  programaId: number | null;
  instrumentoId: number | null;
  sedeId: number | null;
  docenteId: number | null;
  /** Solo afecta gastos: lo fija el clic en una rebanada o en la matriz. */
  categoriaId: number | null;
};

export const SIN_FILTROS: Filtros = {
  programaId: null, instrumentoId: null, sedeId: null, docenteId: null, categoriaId: null,
};

export type Periodo = { modo: "mes"; mes: string } | { modo: "anio"; anio: number };

/** Contra qué se compara: mes anterior o mismo mes del año pasado. En modo año, el año anterior. */
export type Comparacion = "anterior" | "anio_pasado";

export type OpcionesDashboard = {
  periodo: Periodo;
  comparacion: Comparacion;
  filtros: Filtros;
  /** Hoy en México, YYYY-MM-DD. Los meses futuros no cuentan como meses con datos. */
  hoy: string;
  nomina: ParametrosNomina;
  metas: Metas;
  profitFirst: { activo: boolean; porcentajes: PorcentajesProfitFirst };
};

// ── Resultado ─────────────────────────────────────────────────────────────────

export type Formato = "moneda" | "porcentaje" | "numero";

export type Kpi = {
  clave: string;
  titulo: string;
  valor: number | null;
  formato: Formato;
  anterior: number | null;
  /** Cambio relativo (moneda/número) o en puntos (porcentaje). */
  variacion: number | null;
  /** true si subir es bueno; define el color de la flecha de variación. */
  subirEsBueno: boolean;
  semaforo: Semaforo;
  /** "Meta < 45 %", "Meta > 20 %"… o null si el indicador no tiene meta. */
  meta: string | null;
  /** Línea secundaria: "% de cobranza 92 %", "Acumulado $12,340.00"… */
  detalle: string | null;
};

export type FilaMes = {
  mes: string;
  etiqueta: string;
  /** Mes posterior a hoy: se dibuja vacío, no en cero. */
  futuro: boolean;
  ingresos: number;
  costoDocente: number;
  gastos: number;
  /** Costo docente + gastos: todo lo que costó operar el mes. */
  egresos: number;
  resultado: number;
  margenNeto: number | null;
  /** Caja: recibido − (nómina pagada + gastos). */
  recibido: number;
  pagado: number;
  flujo: number;
  flujoAcumulado: number;
  activos: number;
  retencion: number | null;
  altas: number;
  bajas: number;
  nuevos: number;
};

export type FilaRentable = {
  id: number;
  nombre: string;
  alumnos: number;
  ingresos: number;
  costoDocente: number;
  horas: number;
  margen: number;
  margenPct: number | null;
  ingresoPorHora: number | null;
  posicion: number;
};

export type FilaInstrumento = FilaRentable & {
  tendencia: { mes: string; etiqueta: string; ingresos: number; margen: number }[];
};

export type GastoCategoria = {
  id: number | null;
  nombre: string;
  color: string;
  total: number;
  porcentaje: number | null;
  subcategorias: { nombre: string; total: number }[];
};

export type FilaMatriz = {
  id: string;
  nombre: string;
  color: string;
  /** Una por mes del año, en el orden de `Matriz.meses`. */
  valores: number[];
  total: number;
  /** Fila calculada (costo docente), no editable desde gastos. */
  calculada: boolean;
};

export type Matriz = {
  meses: string[];
  filas: FilaMatriz[];
  totalesMes: number[];
  total: number;
};

export type FilaCanal = {
  canal: string;
  etiqueta: string;
  nuevos: number;
  gasto: number;
  cac: number | null;
};

export type Dashboard = {
  periodo: { etiqueta: string; anio: number; meses: string[]; modo: Periodo["modo"] };
  comparacion: { etiqueta: string };
  filtrosActivos: { dimension: string; valor: string }[];
  kpis: Kpi[];
  equilibrio: PuntoEquilibrio & { alumnosActuales: number; gastosFijosMensuales: number };
  serie: FilaMes[];
  programas: FilaRentable[];
  instrumentos: FilaInstrumento[];
  categorias: GastoCategoria[];
  matriz: Matriz;
  canales: FilaCanal[];
  profitFirst: CuentaProfitFirst[] | null;
  observaciones: string[];
  catalogos: Catalogos;
  sinDatos: boolean;
};
