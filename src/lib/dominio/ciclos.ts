/**
 * Periodos de un contrato. Funciones puras sobre fechas civiles (YYYY-MM-DD).
 *
 * Cláusula 3ª: el pago se hace al inicio de la primera clase de cada período
 * mensual, así que el ciclo corre desde la fecha de alta del alumno, no del 1 al
 * 30. Con eso, "4 clases contratadas" significa cuatro exactas y desaparecen los
 * prorrateos y los meses de cinco semanas.
 */

export type Periodo = { iniciaEl: string; terminaEl: string };

function partes(fecha: string): [number, number, number] {
  const [a, m, d] = fecha.split("-").map(Number);
  if (!a || !m || !d) throw new Error(`Fecha inválida: ${fecha}`);
  return [a, m, d];
}

function comoTexto(a: number, m: number, d: number): string {
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Días que tiene un mes, con años bisiestos. */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Suma meses recortando al último día cuando el destino no existe.
 *
 * Sin el recorte, el 31 de enero más un mes da "31 de febrero", que el objeto
 * Date convierte alegremente en 2 o 3 de marzo — y el período del alumno se
 * correría dos días cada vez que cae en un mes largo.
 */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = partes(fecha);
  const total = (a * 12 + (m - 1)) + meses;
  const anioDestino = Math.floor(total / 12);
  const mesDestino = (total % 12) + 1;
  const dia = Math.min(d, diasDelMes(anioDestino, mesDestino));
  return comoTexto(anioDestino, mesDestino, dia);
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = partes(fecha);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return comoTexto(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * El período que arranca en `inicio`.
 *
 * Termina el día anterior al mismo día del mes siguiente: del 18 de septiembre al
 * 17 de octubre. Así dos períodos consecutivos no comparten ningún día.
 */
export function periodoMensual(inicio: string): Periodo {
  return { iniciaEl: inicio, terminaEl: sumarDias(sumarMeses(inicio, 1), -1) };
}

export function estaDentro(fecha: string, p: Periodo): boolean {
  return fecha >= p.iniciaEl && fecha <= p.terminaEl;
}

/** Días que faltan para que cierre el período. Negativo si ya cerró. */
export function diasRestantes(p: Periodo, hoy: string): number {
  const [a1, m1, d1] = partes(hoy);
  const [a2, m2, d2] = partes(p.terminaEl);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}
