/**
 * Reglas de vigencia de una sesión. Función pura, sin base de datos.
 *
 * Están aquí y no dentro de la consulta porque son exactamente el tipo de lógica
 * que se rompe en silencio: un signo invertido en la comparación deja sesiones
 * abiertas para siempre y nadie se entera hasta que alguien entra con el equipo
 * de otro.
 */

/** Cierre por inactividad: 30 minutos sin tocar el sistema. */
export const INACTIVIDAD_MS = 30 * 60 * 1000;
/** Cierre absoluto: 12 horas desde el inicio, aunque haya actividad continua. */
export const ABSOLUTO_MS = 12 * 60 * 60 * 1000;
/** Solo se escribe la última actividad si pasó más de un minuto. */
export const THROTTLE_ACTIVIDAD_MS = 60 * 1000;

export type EstadoSesion =
  | { vigente: true; refrescarActividad: boolean }
  | { vigente: false; motivo: "expirada" | "inactividad" | "usuario_inactivo" | "revocada" };

export type DatosSesion = {
  expiraEn: Date;
  ultimaActividadEn: Date;
  revocadaEn: Date | null;
  usuarioActivo: boolean;
};

export function evaluarVigencia(s: DatosSesion, ahora: Date = new Date()): EstadoSesion {
  const t = ahora.getTime();

  if (s.revocadaEn) return { vigente: false, motivo: "revocada" };

  // El cierre absoluto va primero: manda aunque el usuario esté activo.
  if (s.expiraEn.getTime() <= t) return { vigente: false, motivo: "expirada" };

  if (t - s.ultimaActividadEn.getTime() > INACTIVIDAD_MS) {
    return { vigente: false, motivo: "inactividad" };
  }

  // Un usuario desactivado pierde el acceso de inmediato, sin esperar a que su
  // sesión caduque sola.
  if (!s.usuarioActivo) return { vigente: false, motivo: "usuario_inactivo" };

  return {
    vigente: true,
    refrescarActividad: t - s.ultimaActividadEn.getTime() > THROTTLE_ACTIVIDAD_MS,
  };
}
