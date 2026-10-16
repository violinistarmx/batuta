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

// ------------------------------------------------------- formato de fecha ---

/** «15:00» → «3:00 p. m.». Recibe la hora civil que ya devuelve `horaCivil`. */
export function horaParaRecordatorio(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const periodo = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

/** Fecha sin año, en hora de México: «sábado 17 de octubre». */
export function fechaParaRecordatorio(instante: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City",
  }).format(instante).replace(",", "");
}

// ------------------------------------------------------------- clase ---------

export type DatosRecordatorioClase = {
  /** id de la clase: decide la variante. */
  id: number;
  /** Primer nombre del alumno, como aparece en el saludo. */
  alumno: string;
  /** Instrumento en minúsculas: «violín», «piano». */
  instrumento: string;
  /** Fecha ya formateada: «sábado 17 de octubre». */
  fecha: string;
  /** Horas ya formateadas: «3:00 p. m.» y «5:00 p. m.». */
  horaInicio: string;
  horaFin: string;
};

export function textoRecordatorioClase(d: DatosRecordatorioClase): string {
  const N = d.alumno;
  const I = d.instrumento;
  const F = d.fecha;
  const H1 = d.horaInicio;
  const H2 = d.horaFin;
  const variantes = [
    [
      `Hola, ${N} 😊✨`,
      "Esperamos que se encuentre muy bien. Le escribimos para recordarle que " +
        `${N} tiene programada su clase de ${I} el ${F}, de ${H1} a ${H2}`,
      "",
      "Lo esperamos con mucho gusto en VioliniStar 🤩",
      "",
      "En caso de que por algún motivo no pueda asistir, le agradeceríamos mucho que nos lo notificara con anticipación. 🙏🏻",
      "",
      "¡Muchas gracias! Quedamos atentos. 🎶✨",
    ],
    [
      `¡Hola, ${N}! 👋✨`,
      "Esperamos que tenga un excelente día. Le recordamos que su clase de " +
        `${I} está programada para el ${F}, de ${H1} a ${H2}`,
      "",
      `Será un gusto recibir a ${N} en VioliniStar 🤩`,
      "",
      "Si surge algún imprevisto y no puede asistir, por favor avísenos con tiempo para poder reagendar. 🙏🏻",
      "",
      "¡Gracias por su confianza! Quedamos atentos. 🎶✨",
    ],
    [
      `Buen día, ${N} 🎶`,
      `Le compartimos un recordatorio de la clase de ${I} de ${N}: será el ${F}, de ${H1} a ${H2} 📅`,
      "",
      "Nos encantará tenerle en clase en VioliniStar 🤩",
      "",
      "Si por alguna razón no le es posible asistir, le agradeceríamos avisarnos con anticipación. 🙏🏻",
      "",
      "¡Muchas gracias por su atención! Quedamos muy atentos. ✨",
    ],
    [
      `Hola, ${N} 👋😊`,
      "Esperamos que se encuentre muy bien. Pasamos a recordarle que " +
        `${N} tiene clase de ${I} el ${F}, de ${H1} a ${H2}`,
      "",
      "Lo esperamos con gusto en VioliniStar 🎵🤩",
      "Si no puede asistir, le pedimos que nos lo notifique con la mayor anticipación posible 🙏🏻",
      "",
      "¡Muchas gracias! Quedamos atentos 🎶✨",
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
