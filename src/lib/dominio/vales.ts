/**
 * Reglas del vale de entrega de un producto. Puro: sin base de datos ni sesión, para
 * que cada regla se pruebe sola y la pantalla y la acción de servidor lleguen a la
 * misma respuesta.
 */

export type EstadoVale = "pendiente" | "entregado";

/** VE-2026-000123: prefijo, año y consecutivo de seis cifras. */
export function formatearCodigoVale(anio: number, consecutivo: number): string {
  return `VE-${anio}-${String(consecutivo).padStart(6, "0")}`;
}

export type CargoDelVale = {
  cancelado: boolean;
  montoCentavos: number;
  /** Lo aplicado a ese cargo por pagos y condonaciones. */
  aplicadoCentavos: number;
};

export type MotivoBloqueo = "ya_entregado" | "cargo_cancelado" | "sin_pagar" | "pago_parcial";

export type DecisionEntrega =
  | { permitida: true }
  | {
      permitida: false;
      motivo: MotivoBloqueo;
      /** El director puede autorizarla con un motivo. Solo si lo que falta es el pago. */
      excepcionPosible: boolean;
      mensaje: string;
    };

/**
 * ¿Se puede entregar ahora?
 *
 * - Ya entregado: nunca. No hay excepción: entregar dos veces es entregar de más.
 * - Cargo cancelado: nunca. Si se reactiva, el vale vuelve a poder entregarse.
 * - Sin pagar o con pago parcial: no, salvo excepción del director.
 */
export function evaluarEntrega(estado: EstadoVale, cargo: CargoDelVale): DecisionEntrega {
  if (estado === "entregado") {
    return { permitida: false, motivo: "ya_entregado", excepcionPosible: false, mensaje: "Este vale ya se entregó." };
  }
  if (cargo.cancelado) {
    return {
      permitida: false, motivo: "cargo_cancelado", excepcionPosible: false,
      mensaje: "El cargo está cancelado: no se entrega el producto.",
    };
  }
  if (cargo.aplicadoCentavos >= cargo.montoCentavos) return { permitida: true };
  if (cargo.aplicadoCentavos <= 0) {
    return {
      permitida: false, motivo: "sin_pagar", excepcionPosible: true,
      mensaje: "El cargo no tiene ningún pago registrado.",
    };
  }
  return {
    permitida: false, motivo: "pago_parcial", excepcionPosible: true,
    mensaje: "El cargo tiene un pago parcial: falta saldarlo.",
  };
}

export type IntentoEntrega = {
  estado: EstadoVale;
  cargo: CargoDelVale;
  /** Quien confirma en pantalla puede autorizar excepciones (director). */
  puedeAutorizarExcepcion: boolean;
  /** Motivo que escribió el director; solo cuenta si es una excepción. */
  motivoExcepcion: string | null;
};

export type ResultadoEntrega =
  | { ok: true; conExcepcion: boolean; motivoExcepcion: string | null }
  | { ok: false; motivo: MotivoBloqueo | "excepcion_no_autorizada" | "excepcion_sin_motivo"; mensaje: string };

/** Decide el paso `pendiente → entregado`. La única transición que existe. */
export function resolverEntrega(i: IntentoEntrega): ResultadoEntrega {
  const d = evaluarEntrega(i.estado, i.cargo);
  if (d.permitida) return { ok: true, conExcepcion: false, motivoExcepcion: null };
  if (!d.excepcionPosible) return { ok: false, motivo: d.motivo, mensaje: d.mensaje };

  const motivo = i.motivoExcepcion?.trim() ?? "";
  if (!i.puedeAutorizarExcepcion) {
    return {
      ok: false, motivo: "excepcion_no_autorizada",
      mensaje: `${d.mensaje} Solo el director puede autorizar la entrega sin pago completo.`,
    };
  }
  if (motivo.length < 5) {
    return {
      ok: false, motivo: "excepcion_sin_motivo",
      mensaje: "Escribe el motivo de la excepción (al menos 5 caracteres).",
    };
  }
  return { ok: true, conExcepcion: true, motivoExcepcion: motivo };
}

/** Un cargo cuyo producto ya salió no se cancela: habría que recuperar el producto. */
export function puedeCancelarCargo(estadoVale: EstadoVale | null): { permitido: true } | { permitido: false; mensaje: string } {
  if (estadoVale === "entregado") {
    return {
      permitido: false,
      mensaje: "El producto de este cargo ya se entregó: no se puede cancelar el cargo.",
    };
  }
  return { permitido: true };
}

export type DatosTicket = {
  saludo: string;
  alumno: string;
  concepto: string;
  codigo: string;
  sede: string | null;
  /** Ya formateado: «$600.00». Este módulo no sabe de moneda. */
  importe: string;
  pagado: boolean;
  /** Lo que falta por pagar, ya formateado; solo se usa si no está pagado. */
  pendiente: string | null;
};

/**
 * Mensaje de WhatsApp que acompaña al ticket del vale. Lleva el código para poder buscarlo, pero
 * NO un enlace: la ruta del vale exige sesión del personal y a la familia no le serviría.
 */
export function textoTicketVale(d: DatosTicket): string {
  const lineas = [
    `Hola ${d.saludo} 👋, te saluda VioliniStar Academia de Música.`,
    "",
    `Este es el vale de entrega de *${d.concepto}* para ${d.alumno}:`,
    `🎟️ *${d.codigo}* · ${d.importe}`,
    "",
  ];
  lineas.push(
    d.pagado
      ? `Ya está pagado. Presenta el ticket (el código QR) para recogerlo${d.sede ? ` en la sede ${d.sede}` : ""}.`
      : `Aún falta por pagar${d.pendiente ? ` ${d.pendiente}` : ""}. Lo entregamos en cuanto se liquide${d.sede ? ` en la sede ${d.sede}` : ""}; presenta este ticket.`,
  );
  lineas.push("", "¡Gracias! 🎻");
  return lineas.join("\n");
}
