import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";

/**
 * Lo que una clase le cuesta a la academia, haya corte de nómina o no.
 *
 * `nomina_partidas` guarda lo que ya se consideró para pagar. Leer el costo solo de
 * ahí hacía que un mes sin corte apareciera con costo cero y margen del 100 %: el
 * reporte decía que el programa era perfecto justo porque nadie había apretado el
 * botón. El costo lo causa la clase impartida, no el clic.
 *
 * Cuando la partida existe manda ella —lleva la tarifa del día en que se calculó y
 * un cambio de tarifa no debe reescribir el pasado—; cuando no, se aplica la misma
 * regla de `importeDocenteCentavos` sobre la clase.
 *
 * La consulta que lo use debe tener `clases` y `docentes` en el FROM o en un JOIN.
 */
/**
 * Tarifa propia del maestro de la clase vigente el día de la clase. NULL si no tiene
 * tarifa propia ese día.
 *
 * El día civil se obtiene con `localtime`, que usa la zona del proceso: el contenedor
 * fija TZ=America/Mexico_City (Dockerfile). No se escribe el desfase a mano, por la
 * misma razón que explica lib/formato.ts.
 *
 * `tarifas_docente` es la fuente única: la usan la nómina y el dashboard, así que lo
 * que se paga y lo que se reporta salen del mismo número. La consulta que lo use debe
 * tener `clases` en el FROM o en un JOIN.
 */
export const DIA_DE_CLASE = sql`date(clases.inicia_en, 'unixepoch', 'localtime')`;

export const TARIFA_VIGENTE_DE_CLASE = sql<number | null>`(
  SELECT td.tarifa_hora_centavos FROM tarifas_docente td
  WHERE td.docente_id = clases.docente_id
    AND td.vigente_desde <= ${DIA_DE_CLASE}
    AND (td.vigente_hasta IS NULL OR td.vigente_hasta >= ${DIA_DE_CLASE})
  ORDER BY td.vigente_desde DESC LIMIT 1
)`;

export function costoDeClaseSql(
  tarifaHoraCentavos: number,
  factorFaltaSinAviso: number,
  factorFaltaJustificada: number,
) {
  // Jerarquía: tarifa del maestro vigente ese día > tarifa del programa > tarifa global.
  // La consulta que lo use debe tener `clases` y `programas` en los JOINs.
  const tarifa = sql`coalesce(${TARIFA_VIGENTE_DE_CLASE}, programas.tarifa_docente_hora_centavos, ${tarifaHoraCentavos})`;
  const completo = sql`clases.minutos / 60.0 * ${tarifa}`;
  return sql<number>`coalesce(
    (SELECT np.importe_centavos FROM nomina_partidas np WHERE np.clase_id = clases.id),
    CASE clases.estado
      WHEN 'asistio' THEN CAST(round(${completo}) AS INTEGER)
      WHEN 'falta' THEN CAST(round(${completo} * ${factorFaltaSinAviso}) AS INTEGER)
      WHEN 'falta_justificada' THEN CAST(round(${completo} * ${factorFaltaJustificada}) AS INTEGER)
      ELSE 0
    END
  )`;
}

/** Tarifa y factor vigentes. Ninguna regla de negocio vive en el código. */
export function parametrosNomina(): {
  tarifaHoraCentavos: number;
  factorFaltaSinAviso: number;
  factorFaltaJustificada: number;
} {
  const leer = (clave: string, omision: number) => {
    const v = db.select({ valor: configuracion.valor }).from(configuracion)
      .where(eq(configuracion.clave, clave)).get()?.valor;
    const n = Number(v);
    return Number.isFinite(n) ? n : omision;
  };
  return {
    tarifaHoraCentavos: leer("tarifa_docente_hora_centavos", 12000),
    factorFaltaSinAviso: leer("factor_falta_sin_aviso", 0.75),
    // Sin costo por omision: una falta justificada se recupera y no se paga.
    factorFaltaJustificada: leer("factor_falta_justificada", 0),
  };
}
