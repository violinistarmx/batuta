/**
 * Plantillas de mensajes y su renderizado.
 *
 * El modo de fallar que esto existe para impedir es concreto: que a una mamá le
 * llegue «Hola {{tutor}}, la clase de {{alumno}} es mañana». Un mensaje con un
 * hueco sin llenar no es un mensaje incompleto, es un mensaje que no se puede
 * mandar, y la diferencia tiene que ser un error y no un criterio.
 *
 * Por eso el renderizado devuelve los huecos que quedaron en vez de dejarlos
 * pasar, y la capa de datos se niega a guardar un borrador con huecos.
 */

/** `{{ alumno }}` con o sin espacios; nombres con letras, números, punto y guion bajo. */
const HUECO = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

export type Renderizado = {
  texto: string;
  /** Variables que la plantilla pedía y nadie proporcionó. */
  faltantes: string[];
};

/**
 * Sustituye los huecos por sus valores.
 *
 * Un valor vacío cuenta como faltante: «Hola , te recordamos…» delata el sistema
 * igual que el hueco sin llenar, y ninguna de las dos cosas debe llegar a un tutor.
 */
export function renderizar(plantilla: string, datos: Record<string, string | null | undefined>): Renderizado {
  const faltantes = new Set<string>();

  const texto = plantilla.replace(HUECO, (_, clave: string) => {
    const valor = datos[clave];
    if (valor === undefined || valor === null || String(valor).trim() === "") {
      faltantes.add(clave);
      return `{{${clave}}}`;
    }
    return String(valor);
  });

  return { texto, faltantes: [...faltantes].sort() };
}

/** Variables que una plantilla necesita, en orden de aparición y sin repetir. */
export function variablesDe(plantilla: string): string[] {
  const vistas = new Set<string>();
  for (const m of plantilla.matchAll(HUECO)) {
    const clave = m[1];
    if (clave) vistas.add(clave);
  }
  return [...vistas];
}

/**
 * Por qué este texto NO se puede mandar, o null si sí.
 *
 * Se comprueba sobre el texto YA renderizado, no sobre la plantilla: lo que se
 * aprueba es lo que va a salir, no la receta con la que se hizo.
 */
export function motivoParaNoEnviar(texto: string, destinatarioTelefono: string | null): string | null {
  const huecos = variablesDe(texto);
  if (huecos.length > 0) {
    return `Faltan datos sin llenar: ${huecos.map((h) => `{{${h}}}`).join(", ")}.`;
  }
  if (texto.trim() === "") return "El mensaje está vacío.";
  if (!destinatarioTelefono || destinatarioTelefono.trim() === "") {
    return "No hay teléfono a dónde mandarlo.";
  }
  return null;
}

export type EstadoMensaje = "borrador" | "aprobado" | "rechazado" | "enviado" | "cancelado";

/**
 * Transiciones del mensaje.
 *
 * La única regla que de verdad importa: a «enviado» solo se llega desde
 * «aprobado». Todo el módulo existe para eso.
 */
export function transicionValida(desde: EstadoMensaje, hacia: EstadoMensaje): boolean {
  switch (desde) {
    case "borrador":
      return hacia === "aprobado" || hacia === "rechazado" || hacia === "cancelado";
    case "rechazado":
      // Se corrige y vuelve a la cola; no salta directo a aprobado.
      return hacia === "borrador" || hacia === "cancelado";
    case "aprobado":
      return hacia === "enviado" || hacia === "cancelado";
    case "enviado":
    case "cancelado":
      return false;
  }
}

export function motivoParaRechazarTransicion(
  desde: EstadoMensaje,
  hacia: EstadoMensaje,
): string | null {
  if (transicionValida(desde, hacia)) return null;
  if (hacia === "enviado") {
    return desde === "enviado"
      ? "Ese mensaje ya se mandó."
      : "Nada se manda sin aprobación previa.";
  }
  if (desde === "enviado") return "Un mensaje ya enviado no se puede deshacer.";
  if (desde === "cancelado") return "Ese mensaje está cancelado.";
  return "Ese cambio no es válido.";
}

/**
 * Normaliza un teléfono mexicano a formato de enlace de WhatsApp.
 *
 * Diez dígitos se asumen nacionales y se les antepone 52; un número que ya trae
 * lada internacional se respeta. Devuelve null cuando no hay suficientes dígitos
 * para ser un teléfono, en vez de fabricar un enlace roto.
 */
export function aWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null;
  const d = telefono.replace(/\D/g, "");
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith("52")) return d;
  if (d.length === 13 && d.startsWith("521")) return `52${d.slice(3)}`;
  if (d.length > 10 && d.length <= 15) return d;
  return null;
}
