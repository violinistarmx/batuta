/**
 * A dónde volver tras iniciar sesión. Solo se acepta la ruta de un vale de entrega:
 * una lista cerrada, no «cualquier ruta del mismo sitio», porque un enlace con
 * `?siguiente=` es lo que un correo de phishing le pondría a la pantalla de acceso.
 */
const RUTA_DE_VALE = /^\/vales\/[A-Za-z0-9_-]{16,64}$/;

export function destinoSeguro(valor: unknown): string | null {
  return typeof valor === "string" && RUTA_DE_VALE.test(valor) ? valor : null;
}
