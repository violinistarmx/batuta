/**
 * Reglas del fondo animado, compartidas por la escena (components/fondo-escena.tsx) y su
 * botón en el encabezado (components/control-fondo.tsx). Solo corre en el navegador.
 */

export const LLAVE_FONDO = "batuta:fondo-pausado";
export const EVENTO_FONDO = "batuta:fondo";

/**
 * El video solo se reproduce en pantallas de tableta o más grandes, sin «reducir movimiento» y
 * sin modo de ahorro de datos. En el celular se queda la imagen fija: ahorra datos y batería, y
 * no hace falta un botón de pausa que tape el contenido.
 */
export function fondoAnimadoPermitido(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.innerWidth < 768) return false;
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return conexion?.saveData !== true;
}

/** Lo que eligió esta persona la última vez. El almacenamiento puede fallar: entonces, en marcha. */
export function fondoPausadoGuardado(): boolean {
  try { return localStorage.getItem(LLAVE_FONDO) === "1"; } catch { return false; }
}

/** Guarda la elección y avisa a la escena y al botón para que se pongan de acuerdo. */
export function cambiarFondoPausado(pausado: boolean): void {
  try { localStorage.setItem(LLAVE_FONDO, pausado ? "1" : "0"); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new CustomEvent<boolean>(EVENTO_FONDO, { detail: pausado }));
}
