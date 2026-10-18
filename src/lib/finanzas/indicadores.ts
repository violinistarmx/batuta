/**
 * Indicadores financieros de la academia. Funciones puras: reciben números ya
 * consultados y devuelven el indicador. Nada aquí lee la base ni la hora.
 *
 * Convención: las proporciones van de 0 a 1 (0.45 = 45 %). Cuando el denominador es
 * cero el indicador no existe y se devuelve `null`: mostrar 0 % diría que el negocio
 * va mal cuando simplemente no hubo movimiento.
 */

import { importeDocenteCentavos, type ParametrosNomina } from "../dominio/nomina.ts";
import type { EstadoClase } from "../dominio/creditos";

/** a / b, o null cuando b es cero. */
export function proporcion(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}

/** Margen bruto = (ingresos − costos directos) / ingresos. Costo directo = docente. */
export function margenBruto(ingresos: number, costosDirectos: number): number | null {
  return proporcion(ingresos - costosDirectos, ingresos);
}

/** Margen operativo neto = (ingresos − todos los gastos) / ingresos. */
export function margenNeto(ingresos: number, gastosTotales: number): number | null {
  return proporcion(ingresos - gastosTotales, ingresos);
}

/** % de cobranza = cobrado / facturado. */
export function porcentajeCobranza(cobrado: number, facturado: number): number | null {
  return proporcion(cobrado, facturado);
}

/**
 * Retención = alumnos que terminan el mes / alumnos que lo iniciaron.
 *
 * `continuan` son los que estaban activos al iniciar el mes y siguen activos al
 * cerrarlo. Los que entraron a mitad de mes no cuentan: inflarían la retención.
 */
export function retencion(iniciaron: number, continuan: number): number | null {
  return proporcion(Math.min(continuan, iniciaron), iniciaron);
}

/** CAC = gasto en publicidad / alumnos nuevos. Sin alumnos nuevos, no hay CAC. */
export function cac(gastoPublicidad: number, alumnosNuevos: number): number | null {
  return alumnosNuevos === 0 ? null : Math.round(gastoPublicidad / alumnosNuevos);
}

/** Costo operativo por alumno = gastos totales / alumnos activos. */
export function costoPorAlumno(gastosTotales: number, alumnosActivos: number): number | null {
  return alumnosActivos === 0 ? null : Math.round(gastosTotales / alumnosActivos);
}

export type PuntoEquilibrio = {
  /** Alumnos mínimos para cubrir los gastos fijos; null si cada alumno no aporta. */
  alumnosMinimos: number | null;
  /** Lo que deja cada alumno después de su costo variable. */
  contribucionPorAlumno: number;
  /** Alumnos actuales / mínimos, para la barra de progreso (puede pasar de 1). */
  avance: number | null;
};

/**
 * Punto de equilibrio en alumnos = gastos fijos / (ingreso promedio por alumno −
 * costo variable por alumno), redondeado hacia arriba: medio alumno no paga la renta.
 */
export function puntoEquilibrio(
  gastosFijos: number,
  ingresoPromedioPorAlumno: number,
  costoVariablePorAlumno: number,
  alumnosActuales: number,
): PuntoEquilibrio {
  const contribucion = ingresoPromedioPorAlumno - costoVariablePorAlumno;
  if (contribucion <= 0) {
    return { alumnosMinimos: null, contribucionPorAlumno: contribucion, avance: null };
  }
  const minimos = gastosFijos <= 0 ? 0 : Math.ceil(gastosFijos / contribucion);
  return {
    alumnosMinimos: minimos,
    contribucionPorAlumno: contribucion,
    avance: minimos === 0 ? null : alumnosActuales / minimos,
  };
}

export type ClaseImpartida = {
  minutos: number;
  estado: EstadoClase;
  /** Tarifa del maestro vigente ese día; null usa la del programa o la general. */
  tarifaHoraCentavos: number | null;
  /** Si la clase ya tiene partida de nómina, manda su importe (puede estar ajustado). */
  importePartidaCentavos?: number | null;
};

/**
 * Costo docente = horas realmente impartidas × tarifa del maestro, con la misma
 * regla que la nómina. Family Duet y Allegro Virtuoso Familiar cuentan sus minutos
 * reales (dos horas = dos horas), no créditos.
 */
export function costoDocente(clases: ClaseImpartida[], p: ParametrosNomina): number {
  return clases.reduce((suma, c) => suma + (
    c.importePartidaCentavos ?? importeDocenteCentavos(c.minutos, c.estado, p, c.tarifaHoraCentavos)
  ), 0);
}

/** Variación relativa contra el periodo anterior. null si antes era cero. */
export function variacion(actual: number, anterior: number): number | null {
  return anterior === 0 ? null : (actual - anterior) / Math.abs(anterior);
}

export type Semaforo = "verde" | "ambar" | "rojo" | "sin_dato";

/**
 * Semáforo contra una meta.
 *
 * - `minimo`: más es mejor (margen, cobranza, retención). Verde desde la meta; ámbar
 *   hasta `tolerancia` por debajo de ella; rojo más abajo.
 * - `maximo`: menos es mejor (costo docente, CAC). Verde hasta la meta; ámbar hasta
 *   `tolerancia` por encima; rojo más arriba.
 *
 * La tolerancia es relativa a la meta: 0.10 con meta 0.45 deja ámbar entre 0.45 y 0.495.
 */
export function semaforo(
  valor: number | null,
  meta: number,
  tipo: "minimo" | "maximo",
  tolerancia: number,
): Semaforo {
  if (valor === null || !Number.isFinite(valor)) return "sin_dato";
  const holgura = Math.abs(meta) * tolerancia;
  if (tipo === "minimo") {
    if (valor >= meta) return "verde";
    return valor >= meta - holgura ? "ambar" : "rojo";
  }
  if (valor <= meta) return "verde";
  return valor <= meta + holgura ? "ambar" : "rojo";
}

/** Flujo de caja acumulado: cada mes suma lo recibido menos lo pagado. */
export function flujoAcumulado(meses: { recibido: number; pagado: number }[]): number[] {
  let acumulado = 0;
  return meses.map((m) => (acumulado += m.recibido - m.pagado));
}

export type FilaRentabilidad = {
  nombre: string;
  ingresos: number;
  costoDocente: number;
  horas: number;
};

export type Rentabilidad<T> = T & {
  margen: number;
  margenPct: number | null;
  ingresoPorHora: number | null;
  posicion: number;
};

/**
 * Margen contributivo y ranking. Ordena por margen en pesos: un programa con 90 %
 * de margen sobre $500 aporta menos que uno con 40 % sobre $20,000.
 */
export function rentabilidad<T extends FilaRentabilidad>(filas: T[]): Rentabilidad<T>[] {
  return filas
    .map((f) => ({
      ...f,
      margen: f.ingresos - f.costoDocente,
      margenPct: proporcion(f.ingresos - f.costoDocente, f.ingresos),
      ingresoPorHora: f.horas === 0 ? null : Math.round(f.ingresos / f.horas),
      posicion: 0,
    }))
    .sort((a, b) => b.margen - a.margen || a.nombre.localeCompare(b.nombre, "es"))
    .map((f, i) => ({ ...f, posicion: i + 1 }));
}
