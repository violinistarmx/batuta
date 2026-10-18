/**
 * Margen de los productos. Puro y en centavos.
 *
 * El costo es información de dirección: estas funciones solo calculan, no deciden quién
 * lo ve (eso lo hace el permiso `productos.gestionar` en la capa de datos).
 */

export type Margen = { margenCentavos: number; margenPct: number | null };

/** Precio 600, costo 399 → margen 201 (33.5 % del precio). */
export function margenDe(precioCentavos: number, costoCentavos: number): Margen {
  const margenCentavos = precioCentavos - costoCentavos;
  return {
    margenCentavos,
    margenPct: precioCentavos > 0 ? margenCentavos / precioCentavos : null,
  };
}

/**
 * Costo que se reconoce en el periodo: el costo del cargo en la misma proporción en que
 * se saldó. Si se saldó la mitad en octubre, la mitad del costo es de octubre; así el
 * margen de un abono no sale inflado ni negativo.
 *
 * `aplicadoCentavos` es lo aplicado al cargo, cobrado MÁS condonado: una condonación
 * salda el cargo sin que entre dinero, así que el producto salió completo y su costo se
 * reconoce completo (la condonación se come el margen, no el costo).
 */
export function costoReconocido(costoCentavos: number, montoCargoCentavos: number, aplicadoCentavos: number): number {
  if (montoCargoCentavos <= 0 || costoCentavos <= 0 || aplicadoCentavos <= 0) return 0;
  return Math.round(costoCentavos * Math.min(1, aplicadoCentavos / montoCargoCentavos));
}
