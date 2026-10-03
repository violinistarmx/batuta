/**
 * Reglas del saldo de clases. Funciones puras: sin base de datos, sin interfaz.
 *
 * Fuente: Clausula Cuarta del contrato VioliniStar 2025 y las decisiones de
 * direccion documentadas en el analisis previo.
 */

export type EstadoClase =
  | "programada"
  | "asistio"
  | "falta"
  | "falta_justificada"
  | "cancelada"
  | "reprogramada";

export type MotivoCredito =
  | "emision_ciclo"
  | "clase_tomada"
  | "falta_sin_aviso"
  | "expiracion_ciclo"
  | "cancelada_por_academia"
  | "credito_cortesia"
  | "ajuste_manual";

export type MovimientoCredito = { delta: number; motivo: MotivoCredito };

export type ParametrosCiclo = {
  /** Clausula 4a: minimo de horas de aviso para poder posponer. */
  horasAvisoPosposicion: number;
  /** Clausula 4a: tope de posposiciones por periodo. */
  maxPosposicionesPorCiclo: number;
};

/**
 * Que le hace al saldo el desenlace de una clase.
 *
 * Devuelve null cuando no hay movimiento: una clase pospuesta a tiempo NO genera
 * fila en el libro mayor. Si generara una fila con delta 0, el libro se llenaria
 * de ruido y el saldo seguiria siendo el mismo.
 */
export function efectoEnCreditos(estado: EstadoClase): MovimientoCredito | null {
  switch (estado) {
    case "asistio":
      return { delta: -1, motivo: "clase_tomada" };
    case "falta":
      // Clausula 4a: sin aviso o con menos de 24 h, la clase se considera consumida.
      return { delta: -1, motivo: "falta_sin_aviso" };
    case "falta_justificada":
    case "reprogramada":
      // El alumno aviso a tiempo, o el director autorizo la excepcion.
      return null;
    case "cancelada":
      // Fuerza mayor de la academia: se reprograma sin afectacion al alumno.
      return null;
    case "programada":
      return null;
  }
}

export type EvaluacionPosposicion =
  | { permitido: true; requiereAutorizacion: false }
  | { permitido: true; requiereAutorizacion: true; razon: string }
  | { permitido: false; razon: string };

/**
 * Si una clase puede posponerse sin consumirse.
 *
 * Dos condiciones independientes, y las dos vienen del contrato: el aviso llego con
 * suficiente anticipacion, y el ciclo no agoto su tope de posposiciones. Cuando
 * falla solo la primera, el director puede autorizar la excepcion dejando motivo.
 * Cuando falla el tope, no hay excepcion: la clausula es tajante.
 */
export function evaluarPosposicion(
  horasAnticipacion: number,
  posposicionesUsadas: number,
  p: ParametrosCiclo,
): EvaluacionPosposicion {
  if (posposicionesUsadas >= p.maxPosposicionesPorCiclo) {
    return {
      permitido: false,
      razon:
        `El periodo ya usó sus ${p.maxPosposicionesPorCiclo} posposiciones (cláusula cuarta). ` +
        `La clase se considera consumida.`,
    };
  }

  if (horasAnticipacion < p.horasAvisoPosposicion) {
    return {
      permitido: true,
      requiereAutorizacion: true,
      razon:
        `El aviso llegó con ${horasAnticipacion} h de anticipación y se requieren ` +
        `${p.horasAvisoPosposicion} h. Solo el director puede autorizarlo, con motivo.`,
    };
  }

  return { permitido: true, requiereAutorizacion: false };
}

/** Horas completas entre el aviso y el inicio de la clase. Negativo si ya empezó. */
export function horasDeAnticipacion(avisoEn: Date, claseIniciaEn: Date): number {
  const ms = claseIniciaEn.getTime() - avisoEn.getTime();
  return Math.floor(ms / 3_600_000);
}

/** El saldo es la suma del libro mayor. Nunca un contador guardado. */
export function saldoDeCreditos(movimientos: readonly { delta: number }[]): number {
  return movimientos.reduce((suma, m) => suma + m.delta, 0);
}

/**
 * Clausula 4a: las clases no tomadas no se acumulan para el siguiente mes.
 *
 * Al cerrar el ciclo se emite un movimiento que lleva el saldo a cero. No se borra
 * nada: la traza queda intacta y el tutor puede ver exactamente que expiro y cuando.
 */
export function movimientoDeCierre(saldoActual: number): MovimientoCredito | null {
  if (saldoActual <= 0) return null;
  return { delta: -saldoActual, motivo: "expiracion_ciclo" };
}
