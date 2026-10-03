/**
 * Presentación de dinero y fechas.
 *
 * México eliminó el horario de verano en octubre de 2022, así que hoy la zona es
 * UTC-6 fijo. Eso hace tentador escribir el desplazamiento a mano, y es justo lo
 * que no debe hacerse: congelaría una decisión legislativa dentro del código.
 * Siempre el identificador IANA.
 */

export const ZONA = "America/Mexico_City";

/** Los importes viven en centavos. $750.00 se guarda como 75000. */
export function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100);
}

/**
 * Igual, pero siempre con centavos.
 *
 * En un tablero «$750» se lee más rápido; en un documento que se entrega al
 * tutor, un importe sin centavos se ve incompleto y admite discusión sobre lo
 * que realmente se pagó. Los recibos usan esta forma.
 */
export function pesosExactos(centavos: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}

export function fechaLarga(d: Date = new Date()): string {
  const f = new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  return f.charAt(0).toUpperCase() + f.slice(1);
}

/** «20 de septiembre de 2026». Para tablas, donde el día de la semana estorba. */
export function fechaMedia(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA, day: "numeric", month: "long", year: "numeric",
  }).format(d);
}

export function hora(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

export function saludo(d: Date = new Date()): string {
  const h = Number(
    new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, hour: "2-digit", hour12: false }).format(d),
  );
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

/**
 * La edad se calcula, nunca se almacena. `nacimiento` es una fecha civil
 * YYYY-MM-DD, no un instante: guardarla como marca de tiempo adelanta cumpleaños.
 */
export function edad(nacimiento: string, hoy: Date = new Date()): number {
  const hoyMx = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(hoy);
  const [ay, am, ad] = nacimiento.split("-").map(Number);
  const [hy, hm, hd] = hoyMx.split("-").map(Number);
  if (!ay || !am || !ad || !hy || !hm || !hd) return 0;
  let años = hy - ay;
  if (hm < am || (hm === am && hd < ad)) años--;
  return años;
}

export function esMenorDeEdad(nacimiento: string | null, hoy: Date = new Date()): boolean {
  if (!nacimiento) return false;
  return edad(nacimiento, hoy) < 18;
}
