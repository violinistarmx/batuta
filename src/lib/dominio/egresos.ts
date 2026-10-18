/**
 * Concepto que aparece en cada egreso de nómina, por programa.
 *
 * Un pago a docente puede cubrir clases de varios programas: el concepto se arma
 * por programa para que cada egreso sea atribuible. Los números son el orden de la
 * clase dentro de ese corte y ese programa.
 */
export function conceptoEgresoNomina(docente: string, programa: string, numeros: number[]): string {
  return `Pago a ${docente} por clase número ${numeros.join(", ")} de ${programa}`;
}
