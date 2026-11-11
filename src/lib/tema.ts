/**
 * Temas visuales de Batuta. Son una preferencia de cada persona en su navegador (una cookie), no
 * una regla de la academia: cada quien ve la app como le acomoda sin cambiársela a nadie más.
 */

export type Tema = "claro" | "cristal";

export const COOKIE_TEMA = "batuta_tema";

export const TEMAS: { valor: Tema; nombre: string; descripcion: string; fondo: string }[] = [
  { valor: "claro", nombre: "Claro", descripcion: "Paisaje de día, tarjetas blancas.", fondo: "escena" },
  { valor: "cristal", nombre: "Liquid Glass", descripcion: "Ciudad al atardecer, tarjetas de vidrio.", fondo: "cristal" },
];

/** Lo que llegue (cookie, formulario) se convierte en un tema válido; cualquier otra cosa es «claro». */
export function temaValido(valor: unknown): Tema {
  return valor === "cristal" ? "cristal" : "claro";
}

/** Nombre base de los archivos de fondo en public/fondo/ para un tema. */
export function fondoDeTema(tema: Tema): string {
  return TEMAS.find((t) => t.valor === tema)?.fondo ?? "escena";
}
