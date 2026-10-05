/**
 * Descartar un alumno — distinto de darlo de baja.
 *
 * "Dar de baja" (cláusula 12ª) termina un contrato que existió: conserva el
 * expediente, las clases tomadas y los pagos, y solo detiene el cobro y la
 * ocupación del cubículo. Sirve para un alumno real que se va.
 *
 * "Descartar" es para el error de captura: un alumno que nunca debió existir
 * —de prueba, duplicado, con los datos de otra persona— y que no dejó rastro
 * real en la academia. Por eso exige que no haya dinero de por medio ni clase
 * efectivamente impartida: en cuanto existe un pago, una asistencia o un
 * préstamo, ese rastro es justo lo que "dar de baja" existe para conservar, y
 * borrarlo sería falsificar el expediente, no corregirlo.
 */

export type SituacionDescarte = {
  pagosRegistrados: number;
  clasesConAsistenciaOFalta: number;
  prestamosRegistrados: number;
  participacionesEnRecitales: number;
};

export function motivoParaNoDescartar(s: SituacionDescarte): string | null {
  if (s.pagosRegistrados > 0) {
    return "Este alumno tiene pagos registrados. Para corregirlo usa \"Dar de baja\": "
      + "el expediente financiero no se puede borrar, solo cerrar.";
  }
  if (s.clasesConAsistenciaOFalta > 0) {
    return "Este alumno ya tiene clases con asistencia o falta registrada. "
      + "Eso es actividad real: usa \"Dar de baja\" en vez de descartarlo.";
  }
  if (s.prestamosRegistrados > 0) {
    return "Este alumno tiene préstamos de instrumentos registrados. "
      + "Resuelve o devuelve el préstamo, o usa \"Dar de baja\".";
  }
  if (s.participacionesEnRecitales > 0) {
    return "Este alumno aparece en la planeación de un recital. "
      + "Quita esa participación antes de descartarlo, o usa \"Dar de baja\".";
  }
  return null;
}
