/**
 * Aritmética de fechas civiles para finanzas. Funciones puras sobre cadenas
 * `YYYY-MM-DD` y `YYYY-MM`, sin `Date` local ni zona del servidor.
 */

const dos = (n: number) => String(n).padStart(2, "0");

function aCivil(d: Date): string {
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

/** "2026-10-01" → "2026-09-30". */
export function diaAnterior(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return aCivil(new Date(Date.UTC(a!, m! - 1, d! - 1)));
}

/** "2026-01" → "2025-12". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 2, 1));
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}`;
}

/** "2026-10" → "2025-10". */
export function mismoMesAnioAnterior(mes: string): string {
  const [a, m] = mes.split("-");
  return `${Number(a) - 1}-${m}`;
}

/** Primer y último día de un mes: "2026-02" → ["2026-02-01", "2026-02-28"]. */
export function limitesDeMes(mes: string): [string, string] {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a!, m!, 0)).getUTCDate();
  return [`${mes}-01`, `${mes}-${dos(ultimo)}`];
}

/** Los doce meses de un año: 2026 → ["2026-01", …, "2026-12"]. */
export function mesesDelAnio(anio: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${anio}-${dos(i + 1)}`);
}

/** Los últimos `n` meses hasta `mes` inclusive, en orden cronológico. */
export function ultimosMesesHasta(mes: string, n: number): string[] {
  const salida = [mes];
  while (salida.length < n) salida.unshift(mesAnterior(salida[0]!));
  return salida;
}

const NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** "2026-10" → "Octubre". */
export function nombreDeMes(mes: string): string {
  return NOMBRES[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/** "2026-10" → "Oct". */
export function nombreCortoDeMes(mes: string): string {
  return nombreDeMes(mes).slice(0, 3);
}
