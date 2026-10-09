import "server-only";

import { and, gte, isNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { gastos, inscripciones, pagos } from "@/db/schema/index";
import { finDeMes, ultimosMeses } from "@/lib/dominio/meses";

/**
 * Series mensuales para las gráficas de dirección.
 *
 * Los meses sin movimiento se devuelven en cero en vez de omitirse: un hueco en la
 * serie haría que la gráfica dibujara una recta entre dos meses lejanos y contara
 * una historia más suave que la real.
 */

export type PuntoMes = { mes: string; valor: number };

/** Dinero cobrado por mes, en centavos. */
export function ingresosPorMes(hasta: string, meses = 12): PuntoMes[] {
  const serie = ultimosMeses(hasta, meses);
  const desde = `${serie[0]!}-01`;
  const fin = finDeMes(serie[serie.length - 1]!);

  const filas = db
    .select({
      mes: sql<string>`substr(${pagos.recibidoEl}, 1, 7)`,
      centavos: sql<number>`coalesce(sum(${pagos.montoCentavos}), 0)`,
    })
    .from(pagos)
    .where(and(gte(pagos.recibidoEl, desde), lte(pagos.recibidoEl, fin)))
    .groupBy(sql`substr(${pagos.recibidoEl}, 1, 7)`)
    .all();

  const porMes = new Map(filas.map((f) => [f.mes, Number(f.centavos)]));
  return serie.map((mes) => ({ mes, valor: porMes.get(mes) ?? 0 }));
}

/** Gastos registrados por mes, en centavos. */
export function gastosPorMes(hasta: string, meses = 12): PuntoMes[] {
  const serie = ultimosMeses(hasta, meses);
  const desde = `${serie[0]!}-01`;
  const fin = finDeMes(serie[serie.length - 1]!);

  const filas = db
    .select({
      mes: sql<string>`substr(${gastos.fecha}, 1, 7)`,
      centavos: sql<number>`coalesce(sum(${gastos.montoCentavos}), 0)`,
    })
    .from(gastos)
    .where(and(gte(gastos.fecha, desde), lte(gastos.fecha, fin)))
    .groupBy(sql`substr(${gastos.fecha}, 1, 7)`)
    .all();

  const porMes = new Map(filas.map((f: { mes: string; centavos: number }) => [f.mes, Number(f.centavos)]));
  return serie.map((mes: string) => ({ mes, valor: porMes.get(mes) ?? 0 }));
}

/**
 * Alumnos con inscripción vigente al cierre de cada mes.
 *
 * NO es un acumulado de altas. Un acumulado solo sabe sumar y dibujaría una línea
 * que nunca baja, aunque la academia estuviera perdiendo alumnos: la gráfica diría
 * que todo va bien el mes en que peor va. Aquí se cuenta quién seguía inscrito en
 * esa fecha, así que las bajas se notan.
 *
 * Se cuentan alumnos distintos, no inscripciones: quien lleva violín y piano es un
 * alumno, no dos.
 */
export function alumnosActivosPorMes(hasta: string, meses = 12): PuntoMes[] {
  return ultimosMeses(hasta, meses).map((mes) => {
    const cierre = finDeMes(mes);

    const fila = db
      .select({ n: sql<number>`count(distinct ${inscripciones.alumnoId})` })
      .from(inscripciones)
      .where(and(
        lte(inscripciones.fechaInicio, cierre),
        // Una inscripción cancelada nunca llegó a existir como tal.
        ne(inscripciones.estado, "cancelada"),
        or(isNull(inscripciones.fechaFin), gte(inscripciones.fechaFin, cierre)),
      ))
      .get();

    return { mes, valor: Number(fila?.n ?? 0) };
  });
}
