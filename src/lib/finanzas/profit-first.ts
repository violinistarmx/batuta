/**
 * Profit First: reparte el ingreso del mes en cuentas con porcentajes fijos.
 *
 * El objetivo de cada cuenta es ingreso × porcentaje. Lo real solo se conoce para
 * Gastos operativos (lo que de verdad se gastó); lo que queda después de gastar
 * se reparte entre Ganancia, Sueldo e Impuestos en la misma proporción que sus
 * objetivos. Así se ve de inmediato si los gastos se comieron lo que debía ir a
 * ganancia o a impuestos.
 */

export type PorcentajesProfitFirst = {
  ganancia: number;
  sueldo: number;
  impuestos: number;
  operacion: number;
};

export type CuentaProfitFirst = {
  clave: keyof PorcentajesProfitFirst;
  nombre: string;
  porcentaje: number;
  objetivo: number;
  real: number;
};

const NOMBRES: Record<keyof PorcentajesProfitFirst, string> = {
  ganancia: "Ganancia",
  sueldo: "Sueldo del dueño",
  impuestos: "Impuestos",
  operacion: "Gastos operativos",
};

/** La suma de porcentajes debe ser 1 (100 %). Tolera redondeo de captura. */
export function porcentajesValidos(p: PorcentajesProfitFirst): boolean {
  const suma = p.ganancia + p.sueldo + p.impuestos + p.operacion;
  return Object.values(p).every((v) => v >= 0) && Math.abs(suma - 1) < 0.001;
}

export function repartoProfitFirst(
  ingreso: number,
  gastosOperativosReales: number,
  p: PorcentajesProfitFirst,
): CuentaProfitFirst[] {
  const disponible = Math.max(0, ingreso - gastosOperativosReales);
  const resto = p.ganancia + p.sueldo + p.impuestos;

  const real = (pct: number) => (resto === 0 ? 0 : Math.round(disponible * (pct / resto)));

  return (["ganancia", "sueldo", "impuestos", "operacion"] as const).map((clave) => ({
    clave,
    nombre: NOMBRES[clave],
    porcentaje: p[clave],
    objetivo: Math.round(ingreso * p[clave]),
    real: clave === "operacion" ? gastosOperativosReales : real(p[clave]),
  }));
}
