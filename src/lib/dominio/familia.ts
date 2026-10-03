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
  if (!s.compartenTutor) {
    return "Para compartir un plan familiar los alumnos deben tener un tutor en común.";
  }
  if (cupoRestante(s.alumnosIncluidos, s.cubiertasActuales) === 0) {
    return `Ese plan ya cubre a sus ${s.alumnosIncluidos} alumnos.`;
  }
  return null;
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
