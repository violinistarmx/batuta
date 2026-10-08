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
export function costoDeClaseSql(tarifaHoraCentavos: number, factorFaltaSinAviso: number) {
  // Jerarquía: tarifa propia del docente > tarifa del programa > tarifa global
  // La consulta que lo use debe tener `docentes` y `programas` en los JOINs.
  const tarifa = sql`coalesce(docentes.tarifa_hora_centavos, programas.tarifa_docente_hora_centavos, ${tarifaHoraCentavos})`;
  const completo = sql`clases.minutos / 60.0 * ${tarifa}`;
  return sql<number>`coalesce(
    (SELECT np.importe_centavos FROM nomina_partidas np WHERE np.clase_id = clases.id),
    CASE clases.estado
      WHEN 'asistio' THEN CAST(round(${completo}) AS INTEGER)
      WHEN 'falta' THEN CAST(round(${completo} * ${factorFaltaSinAviso}) AS INTEGER)
      WHEN 'falta_justificada' THEN CAST(round(${completo} * ${factorFaltaSinAviso}) AS INTEGER)
      ELSE 0
    END
  )`;
}

/** Tarifa y factor vigentes. Ninguna regla de negocio vive en el código. */
export function parametrosNomina(): { tarifaHoraCentavos: number; factorFaltaSinAviso: number } {
  const leer = (clave: string, omision: number) => {
    const v = db.select({ valor: configuracion.valor }).from(configuracion)
      .where(eq(configuracion.clave, clave)).get()?.valor;
    const n = Number(v);
    return Number.isFinite(n) ? n : omision;
  };
  return {
    tarifaHoraCentavos: leer("tarifa_docente_hora_centavos", 12000),
    factorFaltaSinAviso: leer("factor_falta_sin_aviso", 0.75),
  };
}
