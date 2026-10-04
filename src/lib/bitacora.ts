import "server-only";

import { db } from "@/db";
import { bitacora } from "@/db/schema/index";

/**
 * Bitácora de auditoría. Append-only: no se actualiza ni se borra nunca.
 *
 * Responde preguntas que en papel no tienen respuesta: quién cambió la asistencia
 * de esa clase, quién abrió el expediente de salud de un menor, quién autorizó la
 * posposición fuera de plazo.
 */

export type Accion =
  | "sesion.iniciar" | "sesion.cerrar" | "sesion.rechazada" | "sesion.revocar"
  | "usuario.crear" | "usuario.editar" | "usuario.desactivar"
  | "alumno.crear" | "alumno.editar" | "alumno.eliminar" | "alumno.consultar_qr"
  | "salud.leer" | "salud.editar"
  | "inscripcion.crear" | "inscripcion.cambiar_programa" | "inscripcion.baja"
  | "ciclo.renovar" | "ciclo.cerrar"
  | "clase.crear" | "clase.asistencia" | "clase.reprogramar" | "clase.autorizar_excepcion"
  | "clase.corregir"
  | "pago.registrar" | "pago.modificar" | "cargo.generar"
  | "nomina.calcular" | "nomina.pagar"
  | "recibo.emitir" | "recibo.imprimir"
  | "documento.subir" | "documento.descargar" | "documento.eliminar"
  | "prospecto.crear" | "prospecto.seguimiento" | "prospecto.etapa" | "prospecto.convertir"
  | "mensaje.redactar" | "mensaje.aprobar" | "mensaje.rechazar" | "mensaje.enviar"
  | "inventario.alta" | "inventario.prestar" | "inventario.devolver"
  | "recital.crear" | "recital.estado" | "recital.proponer"
  | "recital.confirmar" | "recital.rechazar" | "recital.vender"
  | "permisos.modificar" | "configuracion.modificar"
  | "respaldo.crear" | "respaldo.restaurar";

export type EntradaBitacora = {
  usuarioId: number | null;
  accion: Accion;
  entidad: string;
  entidadId?: number | null;
  /** Solo los campos que cambiaron, como { campo: [antes, después] }. */
  cambios?: Record<string, unknown> | null;
  ip?: string | null;
};

export function registrar(e: EntradaBitacora): void {
  db.insert(bitacora).values({
    usuarioId: e.usuarioId,
    accion: e.accion,
    entidad: e.entidad,
    entidadId: e.entidadId ?? null,
    cambios: e.cambios ? JSON.stringify(e.cambios) : null,
    ip: e.ip ?? null,
  }).run();
}

/**
 * Calcula el diferencial entre dos versiones de un registro.
 *
 * Guardar el objeto entero en cada edición llena la bitácora de ruido y hace
 * imposible ver qué cambió de verdad. Aquí solo quedan los campos que se movieron.
 */
export function diferencia<T extends Record<string, unknown>>(
  antes: T,
  despues: Partial<T>,
  omitir: readonly string[] = ["hashPassword", "qrToken"],
): Record<string, [unknown, unknown]> | null {
  const cambios: Record<string, [unknown, unknown]> = {};
  for (const [clave, valorNuevo] of Object.entries(despues)) {
    if (omitir.includes(clave)) continue;
    const valorViejo = antes[clave];
    if (valorViejo !== valorNuevo) cambios[clave] = [valorViejo, valorNuevo];
  }
  return Object.keys(cambios).length > 0 ? cambios : null;
}
