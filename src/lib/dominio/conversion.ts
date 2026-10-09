/**
 * Reglas sobre el texto que sale de convertir un documento a Markdown.
 *
 * Funciones puras, sin procesos ni sistema de archivos. El proceso que ejecuta
 * markitdown vive en `lib/markitdown.ts`; aquí están las decisiones que cuentan
 * tokens: qué se quita del texto (basura que no aporta significado) y cuánto se
 * deja pasar por documento (un tope que el llamador puede ajustar).
 */

/** Tope por documento. Unos 10 000 tokens: sobra para una planeación o un contrato. */
export const MAX_CARACTERES = 40_000;

/** Imagen embebida como data URI: base64 que cuesta tokens y no dice nada. */
const IMAGEN_DATA_URI = /!\[([^\]]*)\]\(data:[^)]*\)/g;

/**
 * Quita lo que infla el texto sin aportar contenido.
 *
 * - Imágenes embebidas se sustituyen por una etiqueta con su texto alternativo.
 * - Se normalizan saltos de línea de Windows y se quitan espacios al final de línea.
 * - Tres o más saltos seguidos quedan en uno de párrafo.
 */
export function compactarMarkdown(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(IMAGEN_DATA_URI, (_, alt: string) => (alt.trim() ? `[imagen: ${alt.trim()}]` : "[imagen]"))
    .split("\n")
    .map((linea) => linea.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type TextoLimitado = { texto: string; truncado: boolean; omitidos: number };

/**
 * Deja pasar como máximo `maximo` caracteres.
 *
 * Si hay que cortar, corta en el último párrafo completo que quepa (siempre que
 * eso no tire más de la mitad del tope) y avisa cuántos caracteres quedaron fuera.
 * Así el modelo sabe que el documento está incompleto y no lo toma por entero.
 */
export function limitarMarkdown(texto: string, maximo: number): TextoLimitado {
  if (!Number.isInteger(maximo) || maximo < 1) {
    throw new Error("El tope de caracteres debe ser un entero positivo.");
  }
  if (texto.length <= maximo) return { texto, truncado: false, omitidos: 0 };

  const parrafo = texto.lastIndexOf("\n\n", maximo);
  const corte = parrafo > maximo / 2 ? parrafo : maximo;
  const omitidos = texto.length - corte;
  const cabeza = texto.slice(0, corte).trimEnd();

  return {
    texto: `${cabeza}\n\n[… documento truncado: ${omitidos} caracteres omitidos]`,
    truncado: true,
    omitidos,
  };
}
