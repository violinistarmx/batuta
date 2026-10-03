/**
 * Conversión entre la hora local de la academia y un instante real.
 *
 * El servidor corre en UTC. Interpretar «2026-09-21 16:00» con el reloj del
 * servidor pondría la clase seis horas antes de lo que el director escribió, y
 * nadie se daría cuenta hasta que alguien llegara a un cubículo vacío.
 *
 * México eliminó el horario de verano en 2022, así que hoy el desfase es fijo,
 * pero se calcula con el identificador IANA de todas formas: escribir −6 a mano
 * congelaría una decisión legislativa dentro del código.
 */

export const ZONA = "America/Mexico_City";

const FORMATO = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

/** Los componentes de fecha y hora de un instante, vistos desde la academia. */
function partesEnZona(instante: Date): Record<string, number> {
  const partes: Record<string, number> = {};
  for (const p of FORMATO.formatToParts(instante)) {
    if (p.type !== "literal") partes[p.type] = Number(p.value);
  }
  return partes;
}

/**
 * Convierte una fecha y hora civiles de la academia al instante que les
 * corresponde.
 *
 * El método: se toma la lectura como si fuera UTC, se mira qué hora marcaría ese
 * instante en México, y la diferencia entre ambas es el desfase que hay que
 * corregir. No hace falta saber cuál es.
 */
export function instanteEnMexico(fecha: string, horaTexto: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Fecha inválida: ${fecha}`);
  if (!/^\d{2}:\d{2}$/.test(horaTexto)) throw new Error(`Hora inválida: ${horaTexto}`);

  const tentativo = new Date(`${fecha}T${horaTexto}:00Z`);
  if (Number.isNaN(tentativo.getTime())) throw new Error(`Fecha u hora inválida: ${fecha} ${horaTexto}`);

  const p = partesEnZona(tentativo);
  const comoLoVeMexico = Date.UTC(
    p.year!, (p.month! - 1), p.day!, p.hour! % 24, p.minute!, p.second!,
  );

  return new Date(tentativo.getTime() + (tentativo.getTime() - comoLoVeMexico));
}

/** La fecha civil de hoy en la academia, YYYY-MM-DD. */
export function hoyEnMexico(ahora: Date = new Date()): string {
  const p = partesEnZona(ahora);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** La fecha civil de un instante, vista desde la academia. */
export function fechaCivil(instante: Date): string {
  return hoyEnMexico(instante);
}

/** La hora civil de un instante (HH:MM), vista desde la academia. */
export function horaCivil(instante: Date): string {
  const p = partesEnZona(instante);
  return `${String(p.hour! % 24).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * El primer instante de un día civil mexicano, y el último.
 *
 * Filtrar la bitácora «del 1 al 15» comparando contra `2026-09-01T00:00Z` deja
 * fuera las seis primeras horas del día en la academia —toda la madrugada del
 * día 1— y mete de más las del día 16. En una auditoría eso no es un detalle de
 * presentación: es un renglón que no aparece cuando se le busca.
 */
export function inicioDelDiaEnMexico(fecha: string): Date {
  return instanteEnMexico(fecha, "00:00");
}

export function finDelDiaEnMexico(fecha: string): Date {
  return new Date(instanteEnMexico(fecha, "00:00").getTime() + 24 * 60 * 60 * 1000 - 1);
}
