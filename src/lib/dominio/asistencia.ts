/**
 * Efecto de registrar —o corregir— la asistencia de una clase.
 *
 * El problema que resuelve: el índice único impide que una clase debite dos veces,
 * que es la garantía contra el doble consumo. Pero una corrección legítima
 * («marqué asistió y en realidad avisó con dos días») tendría que mover el saldo
 * en sentido contrario, y bloquearla dejaría el expediente mal para siempre.
 *
 * La salida es distinguir dos cosas que se veían iguales:
 *   - el CONSUMO por asistencia, que ocurre una sola vez por clase
 *   - el AJUSTE por corrección, que es explícito y queda marcado como tal
 *
 * El libro mayor sigue siendo append-only: una corrección agrega un movimiento
 * compensatorio, nunca borra ni reescribe el anterior.
 */

// La extensión .ts es obligatoria: Node solo borra los tipos, no resuelve rutas
// como lo haría un empaquetador, y `efectoEnCreditos` es un valor, no un tipo.
import { efectoEnCreditos, type EstadoClase, type MotivoCredito } from "./creditos.ts";

export type MovimientoAsistencia = {
  delta: number;
  motivo: MotivoCredito;
  nota: string;
};

const NOMBRE: Record<EstadoClase, string> = {
  programada: "programada",
  asistio: "asistió",
  falta: "falta sin aviso",
  falta_justificada: "falta justificada",
  cancelada: "cancelada por la academia",
  reprogramada: "reprogramada",
};

/**
 * Qué movimiento generar al pasar de un estado a otro.
 *
 * Devuelve null cuando el saldo no cambia: marcar «asistió» y corregir después a
 * «falta sin aviso» consume un crédito en ambos casos, así que el saldo ya es
 * correcto y agregar un movimiento de cero solo ensuciaría el libro. El cambio de
 * estado sí queda en bitácora.
 *
 * @param creditosAConsumir - Cuántos créditos consume esta clase (1 por defecto, 2
 *   para clases de 2 horas). Se aplica solo a los estados que consumen créditos
 *   («asistio» y «falta»); el resto siempre queda en cero.
 */
export function movimientoPorCambio(
  anterior: EstadoClase,
  nuevo: EstadoClase,
  creditosAConsumir = 1,
): MovimientoAsistencia | null {
  const deltaAnterior = efectoEnCreditos(anterior, creditosAConsumir)?.delta ?? 0;
  const efectoNuevo = efectoEnCreditos(nuevo, creditosAConsumir);
  const deltaNuevo = efectoNuevo?.delta ?? 0;
  const diferencia = deltaNuevo - deltaAnterior;

  if (diferencia === 0) return null;

  // Primer registro sobre una clase programada: es consumo, no corrección.
  if (anterior === "programada" && efectoNuevo) {
    return { delta: efectoNuevo.delta, motivo: efectoNuevo.motivo, nota: `${NOMBRE[nuevo]}${creditosAConsumir > 1 ? ` (${creditosAConsumir} créditos)` : ""}` };
  }

  // Cualquier otra transición es una corrección de algo ya registrado.
  return {
    delta: diferencia,
    motivo: "ajuste_manual",
    nota: `Corrección: de ${NOMBRE[anterior]} a ${NOMBRE[nuevo]}`,
  };
}

/** Estados que un usuario puede fijar a mano. `reprogramada` la pone el flujo de posposición. */
export const ESTADOS_REGISTRABLES = [
  "asistio", "falta", "falta_justificada", "cancelada",
] as const satisfies readonly EstadoClase[];

export function etiquetaDeEstado(estado: EstadoClase): string {
  return NOMBRE[estado];
}
