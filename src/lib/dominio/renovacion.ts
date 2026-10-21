/**
 * Cuándo un alumno tiene que renovar su programa.
 *
 * Se mide con las clases restantes del período: el libro de créditos, no la agenda. Cuando
 * quedan pocas, dirección y administración deben saberlo a tiempo para avisar a la familia.
 * El umbral es un ajuste de dirección (`renovacion_aviso_clases`), no una regla escrita aquí.
 */

export type NivelRenovacion = "pronto" | "ahora";

export type SituacionRenovacion = { nivel: NivelRenovacion; restantes: number };

/**
 * - Sin clases restantes: hay que renovar ya.
 * - Entre 1 y el umbral: próxima renovación, avisar a la familia.
 * - Más que el umbral: nada que hacer todavía.
 */
export function situacionRenovacion(restantes: number, umbral: number): SituacionRenovacion | null {
  if (restantes <= 0) return { nivel: "ahora", restantes: 0 };
  if (restantes <= umbral) return { nivel: "pronto", restantes };
  return null;
}
