/**
 * Recitales: quién toca, en qué orden y quién compró boleto.
 *
 * El flujo tiene dos manos a propósito. El maestro propone —es quien sabe qué
 * alumno tiene una pieza lista— y la dirección confirma. El bloqueo por adeudo se
 * aplica al CONFIRMAR, no al proponer, porque el maestro no ve finanzas: rechazarle
 * una propuesta por una deuda que no puede consultar le daría un error imposible de
 * entender y de resolver. La dirección, que sí ve el adeudo, es quien decide.
 */

export type EstadoRecital = "planeado" | "abierto" | "programa_cerrado" | "realizado" | "cancelado";
export type EstadoParticipacion = "propuesta" | "confirmada" | "rechazada" | "cancelada";

export const NOMBRE_RECITAL: Record<EstadoRecital, string> = {
  planeado: "En preparación",
  abierto: "Recibiendo propuestas",
  programa_cerrado: "Programa cerrado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export const NOMBRE_PARTICIPACION: Record<EstadoParticipacion, string> = {
  propuesta: "Propuesta", confirmada: "Confirmada",
  rechazada: "Rechazada", cancelada: "Cancelada",
};

/** Etapas en las que el recital todavía admite cambios en el programa. */
export function admiteCambios(estado: EstadoRecital): boolean {
  return estado === "planeado" || estado === "abierto";
}

export type SolicitudDeParticipacion = {
  estadoRecital: EstadoRecital;
  inscripcionActiva: boolean;
  yaParticipaConEstaPieza: boolean;
};

/**
 * Por qué NO se puede proponer a este alumno, o null si sí.
 *
 * Aquí no se mira el adeudo: quien propone es el maestro y no tiene acceso a esa
 * información. El filtro de dinero vive en `motivoParaRechazarConfirmacion`.
 */
export function motivoParaRechazarPropuesta(s: SolicitudDeParticipacion): string | null {
  if (s.estadoRecital === "cancelado") return "Ese recital está cancelado.";
  if (s.estadoRecital === "realizado") return "Ese recital ya se realizó.";
  if (s.estadoRecital === "programa_cerrado") {
    return "El programa ya se cerró: para agregar a alguien hay que reabrirlo.";
  }
  if (!s.inscripcionActiva) return "La inscripción del alumno no está activa.";
  if (s.yaParticipaConEstaPieza) return "Ese alumno ya está propuesto con esa pieza.";
  return null;
}

export type SolicitudDeConfirmacion = {
  estadoParticipacion: EstadoParticipacion;
  estadoRecital: EstadoRecital;
  /** Lo vencido, no lo que está por vencer: un cargo que aún no vence no es deuda. */
  adeudoVencidoCentavos: number;
};

/**
 * Por qué NO se puede confirmar, o null si sí.
 *
 * El requisito de estar al corriente se comprueba sobre lo VENCIDO. Un cargo cuyo
 * plazo todavía no llega no es un adeudo, y bloquear por él dejaría fuera a quien
 * acaba de renovar el mismo día del recital.
 */
export function motivoParaRechazarConfirmacion(s: SolicitudDeConfirmacion): string | null {
  if (s.estadoRecital === "cancelado") return "Ese recital está cancelado.";
  if (s.estadoParticipacion === "cancelada") return "Esa participación está cancelada.";
  if (s.estadoParticipacion === "confirmada") return "Ya estaba confirmada.";
  if (s.adeudoVencidoCentavos > 0) {
    return "No se puede confirmar con mensualidades vencidas: hay que ponerse al corriente.";
  }
  return null;
}

/** Un rechazo sin motivo no le dice al maestro qué corregir. */
export function motivoParaRechazarRechazo(motivo: string | null): string | null {
  if (!motivo || motivo.trim() === "") {
    return "Escribe por qué se rechaza: el maestro necesita saber qué corregir.";
  }
  return null;
}

export type Numero = {
  participacionId: number;
  orden: number | null;
  duracionMinutos: number | null;
};

/**
 * Comprueba que el orden del programa sea utilizable.
 *
 * Dos alumnos en el mismo lugar es un programa que no se puede leer en voz alta, y
 * un hueco delata que alguien se quedó fuera al reordenar. Se revisa antes de
 * cerrar el programa, que es cuando el documento se imprime y ya no se corrige.
 */
export function problemasDelOrden(numeros: Numero[]): string[] {
  const problemas: string[] = [];
  const conOrden = numeros.filter((n) => n.orden !== null);

  if (conOrden.length !== numeros.length) {
    const faltan = numeros.length - conOrden.length;
    problemas.push(`${faltan} participación(es) sin lugar asignado en el programa.`);
  }

  const vistos = new Map<number, number>();
  for (const n of conOrden) vistos.set(n.orden!, (vistos.get(n.orden!) ?? 0) + 1);

  const repetidos = [...vistos.entries()].filter(([, veces]) => veces > 1).map(([o]) => o);
  if (repetidos.length > 0) {
    problemas.push(`Hay dos o más en el mismo lugar: ${repetidos.sort((a, b) => a - b).join(", ")}.`);
  }

  for (let i = 1; i <= conOrden.length; i++) {
    if (!vistos.has(i)) {
      problemas.push(`Falta el lugar ${i}: el programa tiene un hueco.`);
      break;
    }
  }

  return problemas;
}

/** Minutos que dura el programa, sumando lo que se conoce. */
export function duracionDelPrograma(numeros: Numero[]): { minutos: number; sinDato: number } {
  let minutos = 0;
  let sinDato = 0;
  for (const n of numeros) {
    if (n.duracionMinutos === null) sinDato++;
    else minutos += n.duracionMinutos;
  }
  return { minutos, sinDato };
}

// ------------------------------------------------------------- taquilla ---

/**
 * Lo que cuesta un grupo de boletos.
 *
 * Multiplicar en centavos y una sola vez: calcularlo en pesos y redondear después
 * es como se cuelan los descuadres de un peso que nadie sabe explicar.
 */
export function totalDeVenta(cantidad: number, precioUnitarioCentavos: number): number {
  return cantidad * precioUnitarioCentavos;
}

export type Aforo = {
  capacidad: number | null;
  vendidos: number;
};

/** Lugares que quedan, o null cuando la sede no tiene aforo declarado. */
export function lugaresDisponibles(a: Aforo): number | null {
  if (a.capacidad === null) return null;
  return Math.max(0, a.capacidad - a.vendidos);
}

export function motivoParaRechazarVenta(
  cantidad: number,
  a: Aforo,
  estadoRecital: EstadoRecital,
): string | null {
  if (estadoRecital === "cancelado") return "Ese recital está cancelado.";
  if (estadoRecital === "realizado") return "Ese recital ya se realizó.";
  if (!Number.isInteger(cantidad) || cantidad <= 0) return "La cantidad debe ser al menos 1.";

  const libres = lugaresDisponibles(a);
  if (libres !== null && cantidad > libres) {
    return libres === 0
      ? "No quedan lugares: el aforo está completo."
      : `Solo quedan ${libres} lugar(es) y se piden ${cantidad}.`;
  }
  return null;
}

/** Folio de boleto: REC-3-0001, con el recital dentro para no confundir taquillas. */
export function formatearFolioBoleto(recitalId: number, consecutivo: number): string {
  return `REC-${recitalId}-${String(consecutivo).padStart(4, "0")}`;
}
