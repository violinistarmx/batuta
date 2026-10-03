/**
 * Reglas de administración de cuentas.
 *
 * Todo lo que hay aquí protege de una sola cosa: que la academia se quede sin
 * quien pueda entrar a administrarla. Es el error que no tiene arreglo desde la
 * propia aplicación — después hace falta una terminal y alguien que sepa usarla.
 */

export type Rol = "director" | "docente" | "asistente";

export const NOMBRE_ROL: Record<Rol, string> = {
  director: "Director", docente: "Maestro", asistente: "Asistente",
};

export type CuentaResumen = {
  id: number;
  rol: Rol;
  activo: boolean;
};

/**
 * Por qué NO se puede desactivar esta cuenta, o null si sí.
 *
 * Dos guardias. La primera es evitar que alguien se cierre la puerta desde
 * dentro; la segunda, que no quede ningún director activo, que es peor porque no
 * lo nota quien lo provoca: lo descubre el siguiente que intenta entrar.
 */
export function motivoParaNoDesactivar(
  objetivo: CuentaResumen,
  actorId: number,
  todas: CuentaResumen[],
): string | null {
  if (!objetivo.activo) return "Esa cuenta ya está desactivada.";
  if (objetivo.id === actorId) {
    return "No puedes desactivar tu propia cuenta: te quedarías fuera del sistema.";
  }
  if (objetivo.rol === "director") {
    const otros = todas.filter(
      (c) => c.rol === "director" && c.activo && c.id !== objetivo.id,
    );
    if (otros.length === 0) {
      return "Es el único director activo: desactivarlo dejaría a la academia sin quien la administre.";
    }
  }
  return null;
}

/** La misma guardia al cambiar de rol: degradar al último director lo deja igual. */
export function motivoParaNoCambiarRol(
  objetivo: CuentaResumen,
  rolNuevo: Rol,
  actorId: number,
  todas: CuentaResumen[],
): string | null {
  if (objetivo.rol === rolNuevo) return null;
  if (objetivo.id === actorId && objetivo.rol === "director") {
    return "No puedes quitarte a ti mismo el rol de director.";
  }
  if (objetivo.rol === "director") {
    const otros = todas.filter(
      (c) => c.rol === "director" && c.activo && c.id !== objetivo.id,
    );
    if (otros.length === 0) {
      return "Es el único director activo: cambiarle el rol dejaría a la academia sin quien la administre.";
    }
  }
  return null;
}

/**
 * Si la cuenta todavía usa la contraseña que generó el sistema.
 *
 * Esa contraseña viajó por WhatsApp o en un papel, así que mientras no se cambie
 * el acceso desemboca en la pantalla de cambio.
 */
export function debeCambiarPassword(passwordCambiadaEn: Date | null): boolean {
  return passwordCambiadaEn === null;
}

/** Problemas de un cambio de contraseña, antes de tocar nada. */
export function problemasDelCambio(
  actual: string,
  nueva: string,
  repetida: string,
  fuerza: { valida: boolean; problemas: string[] },
): string[] {
  const problemas: string[] = [];
  if (actual.trim() === "") problemas.push("Escribe tu contraseña actual.");
  if (nueva !== repetida) problemas.push("Las dos contraseñas nuevas no coinciden.");
  if (nueva === actual) problemas.push("La contraseña nueva tiene que ser distinta de la actual.");
  problemas.push(...fuerza.problemas);
  return problemas;
}

/** Correo válido y normalizado. Los correos se guardan en minúsculas. */
export function normalizarCorreo(correo: string): string | null {
  const c = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return null;
  return c;
}
