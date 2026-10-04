/**
 * Aritmética de meses civiles. Funciones puras, sin base de datos ni zona horaria
 * del servidor.
 *
 * Se trabaja con cadenas `YYYY-MM` y `YYYY-MM-DD` en vez de `Date` a propósito: el
 * resto del sistema ya guarda las fechas civiles como texto —justamente para que un
 * cumpleaños no se corra un día— y convertir a `Date` aquí reintroduciría ese riesgo
 * por el camino largo.
 */

/** El mes al que pertenece una fecha civil: "2026-10-04" → "2026-10". */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Último día civil de un mes: "2026-02" → "2026-02-29" en año bisiesto. */
export function finDeMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  // El día 0 del mes siguiente es el último del actual, y Date resuelve bisiestos.
  const ultimo = new Date(Date.UTC(anio!, m!, 0)).getUTCDate();
  return `${mes}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * Los últimos N meses hasta el de `hasta`, inclusive y en orden cronológico.
 *
 * Doce meses terminando en octubre son noviembre del año anterior a octubre de
 * este, no enero a diciembre.
 */
export function ultimosMeses(hasta: string, cuantos: number): string[] {
  const [anio, m] = mesDe(hasta).split("-").map(Number);
  const meses: string[] = [];

  for (let i = cuantos - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anio!, m! - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return meses;
}

const NOMBRES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Etiqueta corta para el eje: "2026-10" → "oct". Con año si es enero. */
export function etiquetaDeMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const nombre = NOMBRES[(m! - 1) % 12] ?? mes;
  return m === 1 ? `${nombre} ${String(anio).slice(2)}` : nombre;
}
