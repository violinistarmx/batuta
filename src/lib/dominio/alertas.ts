/**
 * Qué merece la atención del director hoy.
 *
 * Una alerta solo sirve si se puede actuar sobre ella y si desaparece al actuar.
 * Por eso aquí no hay avisos de «tienes 12 alumnos»: eso es un indicador, no una
 * alerta. Todo lo que entra a esta lista tiene un destino al que ir y una acción
 * que la apaga.
 *
 * El orden importa tanto como el contenido. Una pantalla con veinte avisos del
 * mismo color es una pantalla que nadie lee: la urgencia se reparte en tres
 * niveles y la lista se ordena por ellos, no por cuándo se detectó.
 */

export type Severidad = "urgente" | "pronto" | "informativa";

export const PESO: Record<Severidad, number> = {
  urgente: 0, pronto: 1, informativa: 2,
};

export type Alerta = {
  clase: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  href: string;
  /** Para desempatar dentro de una misma severidad: días vencidos, pesos, etc. */
  peso: number;
};

/**
 * Días entre dos fechas civiles. Positivo si `hasta` es posterior.
 *
 * `Date.UTC` cuenta los meses desde cero, así que el mes va con su −1: pasarlo
 * directo corre cada fecha un mes y las diferencias dejan de tener sentido en
 * cuanto cruzan fin de mes.
 */
export function diasEntre(desde: string, hasta: string): number {
  const civil = (f: string) => {
    const [y = 0, m = 1, d = 1] = f.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((civil(hasta) - civil(desde)) / 86_400_000);
}

/**
 * Un adeudo es urgente desde que vence, no después de una cortesía.
 *
 * La cláusula 3ª fija el pago al inicio del período: al día siguiente ya hay
 * retraso, y esconderlo unos días solo retrasa la llamada.
 */
export function severidadDeAdeudo(venceEl: string, hoy: string): Severidad {
  const dias = diasEntre(venceEl, hoy);
  if (dias > 0) return "urgente";
  if (dias >= -3) return "pronto";
  return "informativa";
}

/** Un período que se acaba sin renovar deja al alumno sin clases el lunes. */
export function severidadDePeriodo(terminaEl: string, hoy: string): Severidad {
  const restan = diasEntre(hoy, terminaEl);
  if (restan <= 0) return "urgente";
  if (restan <= 5) return "pronto";
  return "informativa";
}

/**
 * Una clase que ya pasó y sigue «programada» no se registró.
 *
 * Es la alerta más valiosa del sistema: sin ella el saldo del alumno miente, la
 * nómina del maestro falta y nadie se entera hasta que alguien reclama. Se da un
 * día de gracia porque registrar la clase de la tarde a la mañana siguiente es
 * la operación normal de la academia, no un descuido.
 */
export function severidadDeAsistencia(diasDesdeLaClase: number): Severidad | null {
  if (diasDesdeLaClase < 1) return null;
  if (diasDesdeLaClase >= 3) return "urgente";
  return "pronto";
}

/** Cláusula 10ª: la credencial se entrega a los 7 días del alta. */
export function severidadDeCredencial(emitirEl: string, hoy: string): Severidad | null {
  const dias = diasEntre(emitirEl, hoy);
  if (dias < 0) return null;
  return dias >= 7 ? "urgente" : "pronto";
}

/**
 * Ordena la bandeja: primero lo urgente, y dentro de cada nivel lo más grave.
 *
 * El desempate es por `peso` descendente —más días vencidos, más pesos, más
 * tiempo sin registrar— para que lo peor de cada grupo quede arriba.
 */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort((a, b) =>
    PESO[a.severidad] - PESO[b.severidad] || b.peso - a.peso || a.titulo.localeCompare(b.titulo),
  );
}

export function contarPorSeveridad(alertas: Alerta[]): Record<Severidad, number> {
  const c: Record<Severidad, number> = { urgente: 0, pronto: 0, informativa: 0 };
  for (const a of alertas) c[a.severidad]++;
  return c;
}
