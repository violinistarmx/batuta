/**
 * Mensajes de WhatsApp que la academia envía a tutores y alumnos.
 *
 * Los textos son de la dirección: cada variante conserva la voz aprobada y solo
 * se rellenan los datos del sistema (fecha, horario, nombre). Hay cuatro variantes
 * por tipo para que dos recordatorios seguidos no suenen idénticos.
 *
 * La variante se elige con el id del registro, no con azar: al recargar la página
 * el mismo recordatorio trae siempre el mismo texto, pero registros distintos
 * rotan entre las cuatro.
 *
 * Funciones puras, sin base de datos: se pueden usar desde componentes de servidor.
 */

const NUMERO_VARIANTES = 4;

export function variantePara(id: number): number {
  return Math.abs(Math.trunc(id)) % NUMERO_VARIANTES;
}

/**
 * Normaliza un teléfono mexicano a formato wa.me (52 + 10 dígitos, o 521 + 10 para
 * celulares). Devuelve null si el número no se puede reconocer: es preferible no
 * mostrar el botón que mandar un mensaje a un número equivocado.
 */
export function numeroWhatsApp(crudo: string | null | undefined): string | null {
  if (!crudo) return null;
  const digitos = crudo.replace(/\D/g, "");
  if (digitos.length === 10) return `52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos;
  if (digitos.length === 13 && digitos.startsWith("521")) return digitos;
  return null;
}

export function enlaceWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

type TutorContacto = {
  nombre: string;
  telefono: string | null;
  whatsapp: string | null;
  esResponsablePago: boolean;
};

/**
 * A quién escribirle: primero el tutor responsable de pago (su WhatsApp, o su
 * teléfono si no tiene WhatsApp distinto); si no hay tutor, el teléfono del alumno.
 */
export function destinatarioWhatsApp(
  tutores: readonly TutorContacto[],
  alumno: { nombre: string; telefono: string | null },
): { numero: string; primerNombre: string } | null {
  const tutor = tutores.find((t) => t.esResponsablePago) ?? tutores[0];
  const numero = tutor
    ? numeroWhatsApp(tutor.whatsapp ?? tutor.telefono)
    : numeroWhatsApp(alumno.telefono);
  if (!numero) return null;
  const nombre = tutor ? tutor.nombre : alumno.nombre;
  return { numero, primerNombre: nombre.split(" ")[0] ?? nombre };
}

// ------------------------------------------------------------- clase ---------

export type DatosRecordatorioClase = {
  /** id de la clase: decide la variante. */
  id: number;
  /** Fecha legible, p. ej. «viernes, 16 de octubre de 2026». */
  fecha: string;
  /** Horario legible, p. ej. «16:00 a 17:00 hrs». */
  horario: string;
};

export function textoRecordatorioClase(d: DatosRecordatorioClase): string {
  const { fecha: F, horario: H } = d;
  const variantes = [
    [
      "Hola 👋",
      "",
      "Te recordamos que tenemos tu clase programada:",
      "",
      `📅 Fecha: ${F}`,
      `⏰ Horario: ${H}`,
      "",
      "Por favor confirma tu asistencia para organizar nuestro cronograma.",
      "Tu presencia es importante para mantener la continuidad de tu aprendizaje.",
      "",
      "¡Esperamos confirmación! ✓",
    ],
    [
      "¡Hola!",
      "",
      "Tenemos todo listo para tu clase. Solo queremos confirmar que nos acompañes en:",
      "",
      `📅 Fecha: ${F}`,
      `⏰ Horario: ${H}`,
      "",
      "Si por alguna razón no puedes asistir, avísanos con anticipación para poder reagendar. ¡Nos encanta verte progresar! 💪",
      "",
      "Por favor, confirma aquí ✓",
    ],
    [
      "¡Hola! 🎵",
      "",
      "¡Nos vemos en clase! Aquí van los detalles:",
      "",
      `📅 Fecha: ${F}`,
      `⏰ Horario: ${H}`,
      "",
      "¿Listo para continuar con tu progreso musical? Si algo cambia en tu agenda, cuéntanos rápido para ajustarlo. ¡No queremos que te pierdas de la diversión! 🚀",
      "",
      "Confirma que sí vienes 👇",
    ],
    [
      "Hola,",
      "",
      "Confirma tu asistencia a esta clase:",
      "",
      `📅 Fecha: ${F}`,
      `⏰ Horario: ${H}`,
      "",
      "Si no puedes asistir, avísanos cuanto antes. De lo contrario, asumiremos que vendrás.",
      "",
      "✓ Confirmo",
      "✗ No puedo asistir",
    ],
  ];
  return variantes[variantePara(d.id)]!.join("\n");
}

// ------------------------------------------------------------ renovación ----

export type DatosRecordatorioRenovacion = {
  /** id del alumno: decide la variante. */
  id: number;
  /** Nombre completo del alumno: la primera variante lo menciona. */
  alumno: string;
};

export function textoRecordatorioRenovacion(d: DatosRecordatorioRenovacion): string {
  const variantes = [
    [
      "Hola 👋",
      "",
      `Es un honor compartirte que hemos concluido exitosamente esta mensualidad con grandes y significativos avances en el progreso musical de ${d.alumno} ✨`,
      "",
      "Para continuar este camino de crecimiento y consolidar lo aprendido, te esperamos en tu próxima clase donde podremos brindarte una retroalimentación detallada de los avances alcanzados.",
      "",
      "Recuerda que la continuidad es clave en el aprendizaje musical. ¿Ya confirmaste tu renovación para el próximo período? 📅",
      "",
      "¡Te esperamos! 🎵",
    ],
    [
      "¡Hola!",
      "",
      "Queremos decirte que estamos muy contentos con tu dedicación. Hemos visto grandes y significativos avances durante esta mensualidad, y eso es resultado de tu compromiso y esfuerzo. 💪",
      "",
      "Cada paso cuenta y queremos que lo veas reflejado.",
      "",
      "Para continuar este bonito proceso juntos, te esperamos confirmando tu renovación de programa ¡Seguimos adelante! 🌟",
    ],
    [
      "¡Felicidades! 🎉",
      "",
      "Concluimos esta mensualidad con unos avances INCREÍBLES.",
      "¡Has hecho un trabajo extraordinario! 🚀✨",
      "",
      "Esta próxima clase es el momento perfecto para revisar juntos TODO lo que has logrado y trazar los siguientes retos.",
      "La retroalimentación que compartiremos te sorprenderá.",
      "",
      "El arte no se detiene y tú tampoco 🎵",
      "¿Listo para tu próxima renovación?",
      "¡Esperamos confirmarte en nuestras clases! 💪",
    ],
    [
      "¡Hola! 🎻",
      "",
      "Llegamos al final de esta mensualidad y la verdad es que estamos muy orgullosos de ti, los avances que hemos visto son grandes y significativos, de verdad.",
      "",
      "En tu próxima clase queremos sentarnos contigo para platicarte en detalle todos los progresos que hemos notado. Sabemos que una buena retroalimentación es lo que nos motiva a seguir.",
      "",
      "Sabemos que renovar es comprometerse, pero también sabemos que estás listo para el siguiente nivel. ¿Confirmamos tu programa para la próxima etapa? 🌟",
    ],
  ];
  return variantes[variantePara(d.id)]!.join("\n");
}
