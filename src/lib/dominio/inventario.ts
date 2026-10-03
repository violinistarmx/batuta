/**
 * Préstamo de instrumentos. Cláusula 9ª.
 *
 * Dos reglas del contrato mandan sobre todo lo demás: los instrumentos de gran
 * formato no salen de las instalaciones, y solo Allegro Virtuoso autoriza
 * llevárselo a casa. Las dos ya viven en el catálogo —`granFormato` en el
 * instrumento, `permitePrestamoACasa` en el programa—, así que aquí no se
 * redefinen: se leen.
 *
 * El préstamo NO mueve dinero. No hay depósito en garantía y un daño no genera
 * cargo automático: queda la evidencia y el estado del ejemplar, y la dirección
 * decide qué cobrar. Cobrarle a una familia por un arco roto sin que nadie lo
 * haya tecleado es exactamente lo que no debe pasar solo.
 */

export type EstadoEjemplar = "disponible" | "prestado" | "en_reparacion" | "baja";
export type Condicion = "nuevo" | "bueno" | "regular" | "dañado";
export type Incidencia = "ninguna" | "dano" | "perdida";

export const NOMBRE_ESTADO: Record<EstadoEjemplar, string> = {
  disponible: "Disponible", prestado: "Prestado",
  en_reparacion: "En reparación", baja: "Dado de baja",
};

export const NOMBRE_CONDICION: Record<Condicion, string> = {
  nuevo: "Nuevo", bueno: "Bueno", regular: "Regular", dañado: "Dañado",
};

export type SolicitudDePrestamo = {
  /** Piano y violonchelo: no salen de las instalaciones (cláusula 9ª). */
  granFormato: boolean;
  /** Solo Allegro Virtuoso y sus variantes familiares lo autorizan (cláusula 9ª). */
  programaAutoriza: boolean;
  estadoEjemplar: EstadoEjemplar;
  condicionEjemplar: Condicion;
  /** El préstamo se ancla al período: sin período abierto no hay a qué anclarlo. */
  tienePeriodoAbierto: boolean;
  inscripcionActiva: boolean;
  /** Ya tiene uno de este mismo instrumento sin devolver. */
  yaTienePrestadoEsteInstrumento: boolean;
};

/**
 * Por qué NO se puede prestar, o null si sí.
 *
 * Devuelve el motivo en el idioma del usuario porque es lo que se lee en pantalla.
 * El orden de las comprobaciones es el de la gravedad: primero lo que el contrato
 * prohíbe, luego lo que el estado del inventario impide, y al final lo evitable.
 */
export function motivoParaRechazarPrestamo(s: SolicitudDePrestamo): string | null {
  if (s.granFormato) {
    return "Los instrumentos de gran formato no salen de las instalaciones (cláusula 9ª).";
  }
  if (!s.programaAutoriza) {
    return "Solo Allegro Virtuoso autoriza llevarse el instrumento a casa (cláusula 9ª).";
  }
  if (!s.inscripcionActiva) {
    return "La inscripción no está activa.";
  }
  if (!s.tienePeriodoAbierto) {
    return "Sin período abierto no hay a qué anclar el préstamo: renueva primero.";
  }
  if (s.estadoEjemplar === "prestado") {
    return "Ese ejemplar ya está prestado.";
  }
  if (s.estadoEjemplar === "en_reparacion") {
    return "Ese ejemplar está en reparación.";
  }
  if (s.estadoEjemplar === "baja") {
    return "Ese ejemplar está dado de baja.";
  }
  if (s.condicionEjemplar === "dañado") {
    return "Ese ejemplar está dañado: repáralo antes de prestarlo.";
  }
  if (s.yaTienePrestadoEsteInstrumento) {
    return "Este alumno ya tiene prestado un instrumento de ese tipo.";
  }
  return null;
}

/**
 * En qué estado queda el ejemplar al volver.
 *
 * Una pérdida lo da de baja: el ejemplar no existe para prestarlo otra vez y
 * dejarlo «disponible» lo pondría en la lista de lo que se puede entregar mañana.
 * Un daño lo manda a reparación aunque quien lo recibió haya marcado «bueno»: la
 * incidencia pesa más que la impresión del momento.
 */
export function estadoTrasDevolucion(
  incidencia: Incidencia,
  condicionRegreso: Condicion,
): EstadoEjemplar {
  if (incidencia === "perdida") return "baja";
  if (incidencia === "dano") return "en_reparacion";
  return condicionRegreso === "dañado" ? "en_reparacion" : "disponible";
}

/** Una incidencia sin nota no le sirve a quien tiene que decidir qué cobrar. */
export function motivoParaRechazarDevolucion(
  incidencia: Incidencia,
  nota: string | null,
): string | null {
  if (incidencia !== "ninguna" && (!nota || nota.trim() === "")) {
    return "Describe qué pasó: sin eso, la dirección no puede decidir qué cobrar.";
  }
  return null;
}

/** Días entre dos fechas civiles. Positivo si `hasta` es posterior. */
export function diasEntre(desde: string, hasta: string): number {
  const civil = (f: string) => {
    const [y = 0, m = 1, d = 1] = f.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((civil(hasta) - civil(desde)) / 86_400_000);
}

export type EstadoDevolucion = "vigente" | "por_vencer" | "vencido" | "sin_periodo";

/**
 * Si el instrumento debería estar de vuelta.
 *
 * El préstamo dura lo que dura el período. Cuando el período cierra sin renovar,
 * el instrumento está en casa de alguien que ya no toma clases, y esa es la única
 * situación que de verdad urge.
 */
export function estadoDeDevolucion(
  terminaEl: string | null,
  hoy: string,
  diasDeAviso = 5,
): EstadoDevolucion {
  if (!terminaEl) return "sin_periodo";
  const restan = diasEntre(hoy, terminaEl);
  if (restan < 0) return "vencido";
  if (restan <= diasDeAviso) return "por_vencer";
  return "vigente";
}

/** Folio del ejemplar: INV-0001. */
export function formatearCodigoInventario(consecutivo: number): string {
  return `INV-${String(consecutivo).padStart(4, "0")}`;
}

export type ResumenInventario = {
  total: number;
  disponibles: number;
  prestados: number;
  enReparacion: number;
  deBaja: number;
};

export function resumir(
  ejemplares: { estado: EstadoEjemplar }[],
): ResumenInventario {
  const r: ResumenInventario = {
    total: ejemplares.length, disponibles: 0, prestados: 0, enReparacion: 0, deBaja: 0,
  };
  for (const e of ejemplares) {
    if (e.estado === "disponible") r.disponibles++;
    else if (e.estado === "prestado") r.prestados++;
    else if (e.estado === "en_reparacion") r.enReparacion++;
    else r.deBaja++;
  }
  return r;
}
