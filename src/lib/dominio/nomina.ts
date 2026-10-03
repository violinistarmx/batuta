/**
 * Calculo del pago docente. Funciones puras.
 *
 * Regla confirmada por la direccion: $120 por clase de una hora, $240 por clase de
 * dos horas -- el importe sigue a la duracion. Los maestros no se contratan por
 * horario, asisten a su clase correspondiente.
 */

import type { EstadoClase } from "./creditos";

export type ParametrosNomina = {
  /** Tarifa base en centavos por hora impartida. 12000 = $120.00 */
  tarifaHoraCentavos: number;
  /**
   * Factor cuando el alumno falta sin avisar. El maestro reservo el horario y se
   * presento, asi que cobra una parte. Confirmado en 0.75 por la direccion.
   */
  factorFaltaSinAviso: number;
};

/**
 * Cuanto genera una clase para el docente.
 *
 * El importe se redondea al centavo mas cercano. Con tarifas de $120/hora y clases
 * de 60 o 120 minutos no hay fracciones, pero una clase de 45 minutos al 75 % si
 * las produce y no queremos medio centavo colgando.
 */
export function importeDocenteCentavos(
  minutos: number,
  estado: EstadoClase,
  p: ParametrosNomina,
  tarifaHoraDelDocente?: number | null,
): number {
  const tarifa = tarifaHoraDelDocente ?? p.tarifaHoraCentavos;
  const completo = (minutos / 60) * tarifa;

  switch (estado) {
    case "asistio":
      return Math.round(completo);

    case "falta":
    case "falta_justificada":
      // El maestro reservo el horario y se presento.
      return Math.round(completo * p.factorFaltaSinAviso);

    case "cancelada":
    case "reprogramada":
    case "programada":
      // Clase no impartida: no genera pago. La recuperacion lo generara al darse.
      return 0;
  }
}

/**
 * Si una clase debe generar partida de nomina.
 *
 * Existe ademas un indice unico sobre nomina_partidas(clase_id): una clase genera
 * una partida o ninguna, nunca dos. La secuencia "clase reprogramada -> clase de
 * recuperacion impartida" paga exactamente una vez aunque el flujo la haya tocado
 * varias veces, y esa garantia la impone la base de datos, no este archivo.
 */
export function generaPartida(estado: EstadoClase): boolean {
  return estado === "asistio" || estado === "falta" || estado === "falta_justificada";
}

/** Margen de un programa en el ciclo, para exponerlo en el tablero. */
export function margenDelCiclo(
  precioCentavos: number,
  costoDocenteCentavos: number,
): { margenCentavos: number; margenPorcentaje: number } {
  const margenCentavos = precioCentavos - costoDocenteCentavos;
  const margenPorcentaje = precioCentavos === 0 ? 0 : (margenCentavos / precioCentavos) * 100;
  return { margenCentavos, margenPorcentaje };
}
