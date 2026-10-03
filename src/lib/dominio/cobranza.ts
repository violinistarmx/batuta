/**
 * Aritmética de cobranza. Funciones puras, sin base de datos.
 *
 * Cargo y pago son cosas distintas: el cargo es lo que se debe, el pago es el
 * dinero que entró, y una aplicación los une. Modelarlo como «un pago con saldo»
 * funciona hasta que alguien abona dos veces sobre el mismo mes.
 *
 * Todo importe está en CENTAVOS. Nunca coma flotante: 0.1 + 0.2 !== 0.3 y la
 * cobranza no perdona.
 */

export type Cargo = {
  id: number;
  montoCentavos: number;
  /** Suma de lo ya aplicado a este cargo. */
  aplicadoCentavos: number;
  /** YYYY-MM-DD. Ordena qué se salda primero. */
  venceEl: string;
};

export function adeudoDe(c: Pick<Cargo, "montoCentavos" | "aplicadoCentavos">): number {
  return Math.max(0, c.montoCentavos - c.aplicadoCentavos);
}

export function estaSaldado(c: Pick<Cargo, "montoCentavos" | "aplicadoCentavos">): boolean {
  return adeudoDe(c) === 0;
}

export type Asignacion = { cargoId: number; montoCentavos: number };

export type PlanDeAplicacion = {
  asignaciones: Asignacion[];
  /** Dinero recibido que no alcanzó cargo: queda a favor del alumno. */
  aFavorCentavos: number;
};

/**
 * Reparte un pago entre los cargos abiertos, del más viejo al más nuevo.
 *
 * El orden importa: si el alumno debe septiembre y octubre y abona una
 * mensualidad, se salda septiembre. Aplicarlo al revés dejaría el cargo viejo
 * vencido para siempre y el reporte de adeudos mentiría.
 */
export function planearAplicacion(
  montoRecibido: number,
  cargosAbiertos: readonly Cargo[],
): PlanDeAplicacion {
  if (montoRecibido <= 0) return { asignaciones: [], aFavorCentavos: 0 };

  const porAntiguedad = [...cargosAbiertos]
    .filter((c) => adeudoDe(c) > 0)
    .sort((a, b) => (a.venceEl === b.venceEl ? a.id - b.id : a.venceEl < b.venceEl ? -1 : 1));

  const asignaciones: Asignacion[] = [];
  let restante = montoRecibido;

  for (const cargo of porAntiguedad) {
    if (restante === 0) break;
    const aplicar = Math.min(restante, adeudoDe(cargo));
    asignaciones.push({ cargoId: cargo.id, montoCentavos: aplicar });
    restante -= aplicar;
  }

  return { asignaciones, aFavorCentavos: restante };
}

/**
 * Folio de recibo: VS-2026-0001.
 *
 * Con prefijo propio y año, para que no se confunda con un CFDI. La secuencia
 * reinicia cada año y el consecutivo se toma dentro de la misma transacción que
 * crea el recibo, así que dos cobros simultáneos en recepción no repiten folio.
 */
export function formatearFolio(prefijo: string, anio: number, consecutivo: number): string {
  return `${prefijo}-${anio}-${String(consecutivo).padStart(4, "0")}`;
}

export type EstadoCargo = "abierto" | "parcial" | "saldado";

export function estadoDeCargo(c: Pick<Cargo, "montoCentavos" | "aplicadoCentavos">): EstadoCargo {
  if (c.aplicadoCentavos <= 0) return "abierto";
  return adeudoDe(c) === 0 ? "saldado" : "parcial";
}

/** Resumen de cobranza para el tablero. */
export function resumirCobranza(cargos: readonly Pick<Cargo, "montoCentavos" | "aplicadoCentavos" | "venceEl">[], hoy: string) {
  let porCobrar = 0;
  let vencido = 0;
  let cobrado = 0;

  for (const c of cargos) {
    const adeudo = adeudoDe(c);
    cobrado += Math.min(c.aplicadoCentavos, c.montoCentavos);
    porCobrar += adeudo;
    if (adeudo > 0 && c.venceEl < hoy) vencido += adeudo;
  }

  return { porCobrarCentavos: porCobrar, vencidoCentavos: vencido, cobradoCentavos: cobrado };
}
