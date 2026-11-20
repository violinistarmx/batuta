/**
 * Planes familiares.
 *
 * Un Family Duet cuesta $1,450 y cubre a dos hermanos. Cada uno recibe sus cuatro
 * clases individuales: son ocho clases al mes y ocho horas de maestro. Lo que se
 * comparte es el precio, no el horario ni el saldo.
 *
 * De ahí la forma del modelo: una inscripción por alumno —cada quien con su maestro,
 * su período y su libro mayor— y una sola de ellas, la titular, carga el precio. Las
 * demás abren su ciclo en cero y apuntan a ella. Cobrar $1,450 en cada expediente
 * duplicaría el adeudo de la familia; dividirlo en $725 obligaría a explicar dos
 * recibos por un pago que el tutor hace una vez.
 */

export type PlanFamiliar = {
  /** Cuántos alumnos cubre el precio: 1 individual, 2 o 3 familiar. */
  alumnosIncluidos: number;
};

export function esPlanFamiliar(p: PlanFamiliar): boolean {
  return p.alumnosIncluidos > 1;
}

/** Lugares que quedan libres en un plan, contando al titular. */
export function cupoRestante(alumnosIncluidos: number, cubiertasActuales: number): number {
  return Math.max(0, alumnosIncluidos - 1 - cubiertasActuales);
}

/**
 * Lo que toca a cada alumno, solo para mostrarlo.
 *
 * Nunca se cobra así: el cargo es uno y por el total. Sirve para que el tutor pueda
 * comparar el plan familiar contra dos inscripciones sueltas.
 */
export function precioPorAlumnoCentavos(precioCentavos: number, alumnosIncluidos: number): number {
  if (alumnosIncluidos < 1) return precioCentavos;
  return Math.round(precioCentavos / alumnosIncluidos);
}

/** Ahorro frente a contratar el plan individual equivalente, en centavos. */
export function ahorroFamiliarCentavos(
  precioFamiliar: number,
  precioIndividual: number,
  alumnosIncluidos: number,
): number {
  return precioIndividual * alumnosIncluidos - precioFamiliar;
}

export type SolicitudDeCobertura = {
  programaIdTitular: number;
  programaIdNuevo: number;
  alumnosIncluidos: number;
  cubiertasActuales: number;
  /** El titular no puede estar, a su vez, cubierto por otro: la cadena se corta en uno. */
  titularYaEstaCubierto: boolean;
  titularActivo: boolean;
  /** Al menos un tutor en común. Sin esto cualquiera se cuelga de un plan ajeno. */
  compartenTutor: boolean;
  /**
   * Quien inscribe confirmó expresamente que son familia (p. ej. abuela y nieta: la
   * abuela es adulta y no tiene tutor). Sustituye al tutor en común y queda en bitácora.
   */
  familiaConfirmada?: boolean;
  mismoAlumno: boolean;
};

/**
 * Por qué NO puede sumarse esta inscripción al plan familiar, o null si sí puede.
 *
 * Devuelve el motivo en el idioma del usuario porque es lo que se muestra en
 * pantalla: un booleano obligaría a reconstruir la explicación en la interfaz y
 * las dos versiones se separarían con el tiempo.
 */
export function motivoParaRechazarCobertura(s: SolicitudDeCobertura): string | null {
  if (s.alumnosIncluidos <= 1) {
    return "Ese programa es individual: no cubre a más de un alumno.";
  }
  if (s.programaIdTitular !== s.programaIdNuevo) {
    return "El plan familiar solo cubre alumnos del mismo programa.";
  }
  if (s.titularYaEstaCubierto) {
    return "Esa inscripción ya está cubierta por otra: elige la titular del plan.";
  }
  if (!s.titularActivo) {
    return "El plan familiar al que intentas sumarlo ya no está activo.";
  }
  if (s.mismoAlumno) {
    return "Un alumno no puede ocupar dos lugares del mismo plan familiar.";
  }
  if (!s.compartenTutor && !s.familiaConfirmada) {
    return "Para compartir un plan familiar los alumnos deben tener un tutor en común.";
  }
  if (cupoRestante(s.alumnosIncluidos, s.cubiertasActuales) === 0) {
    return `Ese plan ya cubre a sus ${s.alumnosIncluidos} alumnos.`;
  }
  return null;
}

export type SolicitudDeCambioDePlan = {
  esTitular: boolean;
  titularActivo: boolean;
  /** Alumnos con inscripción activa en el plan, el titular incluido. */
  miembros: number;
  actual: { programaId: number; clases: number; minutos: number; alumnosIncluidos: number };
  nuevo: { programaId: number; clases: number; minutos: number; alumnosIncluidos: number; activo: boolean };
  /** El cargo del período vigente ya recibió algún pago. */
  pagosAplicados: boolean;
};

/**
 * Por qué NO puede cambiarse el plan familiar a otro programa, o null si sí puede.
 *
 * El caso típico: se inscribió un Duet de 2 y la familia suma un tercero, así que pasa al
 * Duet de 3. Se exige que el programa nuevo dé las mismas clases por alumno (si no, habría que
 * rehacer los créditos del período) y que no haya dinero ya cobrado contra el precio anterior.
 */
export function motivoParaRechazarCambioDePlan(s: SolicitudDeCambioDePlan): string | null {
  if (!s.esTitular) return "El plan se cambia desde la inscripción titular.";
  if (s.actual.alumnosIncluidos <= 1) return "Esa inscripción no es de un plan familiar.";
  if (!s.titularActivo) return "El plan ya no está activo.";
  if (s.nuevo.alumnosIncluidos <= 1) return "Elige un programa familiar.";
  if (!s.nuevo.activo) return "Ese programa ya no se ofrece.";
  if (s.nuevo.programaId === s.actual.programaId) return "El plan ya está en ese programa.";
  if (s.nuevo.alumnosIncluidos < s.miembros) {
    return `Ese programa cubre ${s.nuevo.alumnosIncluidos} alumnos y el plan ya tiene ${s.miembros}.`;
  }
  if (s.nuevo.clases !== s.actual.clases || s.nuevo.minutos !== s.actual.minutos) {
    return "Ese programa da otras clases por alumno: cambiarlo a mitad de período obligaría a rehacer " +
      "los créditos. Hazlo al renovar.";
  }
  if (s.pagosAplicados) {
    return "El período vigente ya tiene pagos aplicados. Anula el pago y cambia el plan, o el " +
      "importe cobrado dejaría de coincidir con el precio.";
  }
  return null;
}

/**
 * Por qué NO puede abrirse un plan familiar con este titular, o null si puede.
 *
 * El titular es quien paga: un adulto. Un menor no puede serlo, así que si el alumno
 * que abre el plan es menor (o no consta su fecha de nacimiento) debe indicarse el
 * adulto responsable del pago. Un alumno adulto es su propio titular.
 */
export function motivoParaRechazarTitular(s: {
  alumnoEsAdulto: boolean;
  hayResponsableAdulto: boolean;
}): string | null {
  if (s.alumnoEsAdulto || s.hayResponsableAdulto) return null;
  return "El titular de un plan familiar es el adulto que paga: un menor no puede serlo. " +
    "Elige el tutor responsable del pago (o registra la fecha de nacimiento si el alumno es mayor de edad).";
}

/**
 * Lo que se le cobra al abrir el ciclo de esta inscripción.
 *
 * Cero para las cubiertas: su mensualidad ya viene en el cargo del titular. No es
 * una cortesía ni un descuento, es el mismo dinero contado una vez.
 */
export function precioDelCicloCentavos(
  precioDelPrograma: number,
  estaCubierta: boolean,
): number {
  return estaCubierta ? 0 : precioDelPrograma;
}
