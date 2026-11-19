/**
 * Piezas del comprobante de pago que no dependen de la base de datos: formato de fechas y
 * horas, qué contacto se imprime y cómo se leen las clases que cubre el pago.
 */

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** «2026-11-21» → «21 nov 2026». Si no es una fecha civil, se devuelve tal cual. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}`;
}

/** «2026-11-20 al 2026-12-19» → «20 nov 2026 al 19 dic 2026». Lo que no cuadra, intacto. */
export function periodoLegible(texto: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}) al (\d{4}-\d{2}-\d{2})$/.exec(texto.trim());
  return m ? `${fechaCorta(m[1]!)} al ${fechaCorta(m[2]!)}` : texto;
}

/** «13:05» → «1:05 pm». */
export function horaCorta(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/**
 * Una línea de la lista de clases del comprobante: «Sábado 21 de noviembre 11:00 am a 1:00 pm».
 * Recibe la fecha civil y las horas ya vistas desde la academia («HH:MM»).
 */
export function lineaDeClase(fecha: string, desde: string, hasta: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return `${fecha} ${horaCorta(desde)} a ${horaCorta(hasta)}`;
  // Mediodía UTC: el día de la semana no se corre por la zona horaria del servidor.
  const dia = DIAS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay()]!;
  const nombre = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${nombre} ${Number(m[3])} de ${MESES[Number(m[2]) - 1]} ${horaCorta(desde)} a ${horaCorta(hasta)}`;
}

/** Las líneas de un texto de clases: sin vacías y sin espacios sobrantes. */
export function lineasDeClases(texto: string | null | undefined): string[] {
  return (texto ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

type Persona = { nombre: string; telefono: string | null; direccion: string | null };
type Tutor = Persona & { whatsapp: string | null; esResponsablePago: boolean };

/**
 * Los datos de contacto que salen en el comprobante. Un alumno adulto va con los suyos; si es
 * menor, el comprobante es para quien paga: el teléfono y la dirección son los del tutor
 * responsable (si no tiene dirección propia, la del alumno, que es el mismo domicilio casi
 * siempre). Sin tutor registrado se usan los del alumno. Sin fecha de nacimiento se trata
 * como menor, igual que en los recordatorios.
 */
export function contactoDelComprobante(
  alumno: Persona,
  tutores: readonly Tutor[],
  esAdulto: boolean,
): { direccion: string | null; telefono: string | null; tutor: string | null } {
  const tutor = esAdulto ? undefined : (tutores.find((t) => t.esResponsablePago) ?? tutores[0]);
  if (!tutor) return { direccion: alumno.direccion, telefono: alumno.telefono, tutor: null };
  return {
    direccion: tutor.direccion ?? alumno.direccion,
    telefono: tutor.whatsapp ?? tutor.telefono ?? alumno.telefono,
    tutor: tutor.nombre,
  };
}

/**
 * Lo que dice el renglón «descripción» del comprobante. Si quien cobra escribió algo, eso. Si
 * no, pero enlistó clases, la frase de la plantilla. Si no hay nada, nada.
 */
export function descripcionDelComprobante(descripcion: string | null, clases: readonly string[]): string | null {
  if (descripcion?.trim()) return descripcion.trim();
  return clases.length > 0 ? "Clases programadas en las siguientes fechas y horarios:" : null;
}

/**
 * El mensaje de WhatsApp que acompaña al comprobante. Una liga de wa.me no puede adjuntar el
 * archivo (el chat se abre con el texto escrito); el PDF se adjunta después, desde el chat.
 * Para un tutor se nombra al alumno; para un adulto, el comprobante es suyo.
 */
export function textoComprobanteWhatsApp(d: {
  saludo: string;
  alumno: string;
  paraTutor: boolean;
  folio: string;
  total: string;
}): string {
  const deQuien = d.paraTutor ? ` de ${d.alumno}` : "";
  return [
    `Hola, ${d.saludo} 😊`,
    `Le compartimos el comprobante de pago ${d.folio} por ${d.total}${deQuien}.`,
    "",
    "¡Muchas gracias por su confianza! Quedamos atentos. 🎶✨",
    "— Academia de Música VioliniStar",
  ].join("\n");
}
