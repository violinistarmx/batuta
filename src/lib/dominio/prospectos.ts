/**
 * Reglas del embudo comercial.
 *
 * Un prospecto no se pierde por falta de interés: se pierde porque nadie volvió a
 * escribirle. Casi todo lo de aquí existe para que el sistema sepa a quién hay que
 * buscar hoy y deje de ser una lista que se mira de vez en cuando.
 */

export const ETAPAS = [
  "nuevo", "contactado", "clase_muestra", "en_negociacion", "convertido", "perdido",
] as const;

export type Etapa = (typeof ETAPAS)[number];

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  clase_muestra: "Clase muestra",
  en_negociacion: "En negociación",
  convertido: "Convertido",
  perdido: "Perdido",
};

/** Etapas que siguen vivas: son las que se trabajan. */
export const ABIERTAS: Etapa[] = ["nuevo", "contactado", "clase_muestra", "en_negociacion"];

export function estaAbierto(estado: Etapa): boolean {
  return ABIERTAS.includes(estado);
}

/**
 * Qué transiciones tienen sentido.
 *
 * No se permite saltar de «nuevo» a «convertido»: convertir a alguien con quien
 * nadie habló significa que el registro de contacto se perdió, y el embudo deja de
 * medir nada. Retroceder sí se permite —un prospecto que se enfría vuelve a
 * «contactado»— porque la realidad no avanza en línea recta.
 */
export function transicionValida(desde: Etapa, hacia: Etapa): boolean {
  if (desde === hacia) return true;
  if (desde === "convertido") return false; // Un alumno no vuelve a ser prospecto.
  if (hacia === "perdido") return true; // «convertido» ya salió arriba.
  if (hacia === "nuevo") return false; // Nadie vuelve a ser desconocido.
  if (hacia === "convertido") return desde !== "nuevo" && desde !== "perdido";
  return true;
}

export function motivoParaRechazarTransicion(desde: Etapa, hacia: Etapa): string | null {
  if (transicionValida(desde, hacia)) return null;
  if (desde === "convertido") return "Ya es alumno: su expediente es el que se edita.";
  if (hacia === "nuevo") return "Un prospecto ya contactado no vuelve a ser nuevo.";
  if (hacia === "convertido" && desde === "nuevo") {
    return "Registra al menos un contacto antes de convertirlo: si no, el embudo no mide nada.";
  }
  if (hacia === "convertido" && desde === "perdido") {
    return "Reactívalo primero: un prospecto perdido no se convierte de golpe.";
  }
  return "Ese cambio de etapa no es válido.";
}

/** Días entre dos fechas civiles. Positivo si `hasta` es posterior. */
export function diasEntre(desde: string, hasta: string): number {
  const civil = (f: string) => {
    const [y = 0, m = 1, d = 1] = f.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((civil(hasta) - civil(desde)) / 86_400_000);
}

export type EstadoDeSeguimiento = "vencido" | "hoy" | "programado" | "sin_agendar";

/**
 * Cómo está el próximo contacto.
 *
 * «Sin agendar» es un estado de primera clase, no un hueco: un prospecto abierto al
 * que nadie le puso fecha es exactamente el que se va a enfriar, y merece salir en
 * la lista igual que uno vencido.
 */
export function estadoDeSeguimiento(
  proximoSeguimientoEl: string | null,
  hoy: string,
): EstadoDeSeguimiento {
  if (!proximoSeguimientoEl) return "sin_agendar";
  const dias = diasEntre(proximoSeguimientoEl, hoy);
  if (dias > 0) return "vencido";
  if (dias === 0) return "hoy";
  return "programado";
}

export type Embudo = Record<Etapa, number>;

export function embudoVacio(): Embudo {
  return {
    nuevo: 0, contactado: 0, clase_muestra: 0,
    en_negociacion: 0, convertido: 0, perdido: 0,
  };
}

/**
 * Tasa de conversión sobre los prospectos CERRADOS.
 *
 * Contar los abiertos en el denominador castiga a quien acaba de recibir diez
 * mensajes: todavía no son un fracaso, solo no son un resultado. Devuelve null
 * cuando no hay nada cerrado, en vez de un cero que se leería como "no vendemos".
 */
export function tasaConversion(e: Embudo): number | null {
  const cerrados = e.convertido + e.perdido;
  if (cerrados === 0) return null;
  return (e.convertido / cerrados) * 100;
}

/** Cuántos siguen en juego. */
export function abiertosEn(e: Embudo): number {
  return ABIERTAS.reduce((s, k) => s + e[k], 0);
}

export type Prospecto = {
  estado: Etapa;
  proximoSeguimientoEl: string | null;
  claseMuestraEl: string | null;
  claseMuestraAsistio: boolean | null;
  ultimoContactoEl: string | null;
};

/**
 * La siguiente acción concreta, en el idioma de quien la va a hacer.
 *
 * Devuelve texto y no un código porque es lo que se lee en pantalla: mantener dos
 * versiones —una aquí y otra en la interfaz— garantiza que se separen.
 */
export function siguienteAccion(p: Prospecto, hoy: string): string {
  if (p.estado === "convertido") return "Ya es alumno.";
  if (p.estado === "perdido") return "Cerrado. Reactívalo si vuelve a escribir.";

  if (p.estado === "clase_muestra" && p.claseMuestraEl) {
    const dias = diasEntre(p.claseMuestraEl, hoy);
    if (dias < 0) return `Clase muestra el ${p.claseMuestraEl}: confirma un día antes.`;
    if (dias === 0) return "Clase muestra hoy.";
    if (p.claseMuestraAsistio === null) return "Registra si asistió a la clase muestra.";
    return p.claseMuestraAsistio
      ? "Asistió a la muestra: ofrece la inscripción."
      : "No llegó a la muestra: pregunta si quiere reagendar.";
  }

  const seg = estadoDeSeguimiento(p.proximoSeguimientoEl, hoy);
  if (seg === "vencido") {
    const dias = diasEntre(p.proximoSeguimientoEl ?? hoy, hoy);
    return `Seguimiento atrasado ${dias} día${dias === 1 ? "" : "s"}: escríbele hoy.`;
  }
  if (seg === "hoy") return "Toca escribirle hoy.";
  if (seg === "programado") return `Siguiente contacto el ${p.proximoSeguimientoEl}.`;

  return p.estado === "nuevo"
    ? "Sin contactar todavía: escríbele y agenda el siguiente paso."
    : "Sin próximo contacto agendado: ponle fecha o se enfría.";
}

export type FilaOrigen = { origen: string; total: number; convertidos: number };

/**
 * Ordena los orígenes por cuántos alumnos dieron, no por cuántos mensajes trajeron.
 *
 * Un canal con cien mensajes y dos inscripciones es peor que uno con diez y cinco,
 * y ordenar por volumen haría gastar el presupuesto exactamente al revés.
 */
export function ordenarOrigenes(filas: FilaOrigen[]): (FilaOrigen & { tasa: number | null })[] {
  return filas
    .map((f) => ({ ...f, tasa: f.total === 0 ? null : (f.convertidos / f.total) * 100 }))
    .sort((a, b) => b.convertidos - a.convertidos || (b.tasa ?? -1) - (a.tasa ?? -1));
}
