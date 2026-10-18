import "server-only";

import { sqlite } from "@/db";
import { parametrosNomina } from "@/lib/datos/costo-docente";
import { cargarHechos, type Conexion } from "@/lib/finanzas/cargar";
import { armarDashboard } from "@/lib/finanzas/dashboard";
import type { Metas } from "@/lib/finanzas/observaciones";
import type { Seleccion } from "@/lib/finanzas/parametros";
import type { Dashboard, OpcionesDashboard } from "@/lib/finanzas/tipos";
import { hoyEnMexico } from "@/lib/zona";

/**
 * El dashboard de finanzas para una selección. Lo usan la página y el PDF, así que
 * ambos muestran exactamente las mismas cifras.
 *
 * Carga dos años de hechos (el del periodo y el anterior): alcanza para comparar
 * contra el mes anterior, el mismo mes del año pasado o el año anterior, y para la
 * tendencia de seis meses.
 */

function leerConfiguracion(): Map<string, string> {
  const filas = sqlite.prepare("SELECT clave, valor FROM configuracion").all() as { clave: string; valor: string }[];
  return new Map(filas.map((f) => [f.clave, f.valor]));
}

function numero(c: Map<string, string>, clave: string, omision: number): number {
  const n = Number(c.get(clave));
  return c.has(clave) && Number.isFinite(n) ? n : omision;
}

/** Metas del dashboard. Viven en `configuracion`; estos son solo respaldos si faltan. */
export function metasFinanzas(c = leerConfiguracion()): Metas {
  return {
    costoDocenteMax: numero(c, "meta_costo_docente_max", 0.45),
    margenNetoMin: numero(c, "meta_margen_neto_min", 0.2),
    margenBrutoMin: numero(c, "meta_margen_bruto_min", 0.45),
    cobranzaMin: numero(c, "meta_cobranza_min", 0.9),
    retencionMin: numero(c, "meta_retencion_min", 0.9),
    cacMaxCentavos: numero(c, "meta_cac_max_centavos", 50_000),
    tolerancia: numero(c, "semaforo_tolerancia", 0.1),
  };
}

export function dashboardFinanzas(seleccion: Seleccion, hoy = hoyEnMexico()): Dashboard {
  const c = leerConfiguracion();
  const anio = seleccion.periodo.modo === "anio"
    ? seleccion.periodo.anio
    : Number(seleccion.periodo.mes.slice(0, 4));

  const hechos = cargarHechos(sqlite as unknown as Conexion, `${anio - 1}-01-01`, `${anio}-12-31`);

  const opciones: OpcionesDashboard = {
    ...seleccion,
    hoy,
    nomina: parametrosNomina(),
    metas: metasFinanzas(c),
    profitFirst: {
      activo: c.get("profit_first_activo") === "true",
      porcentajes: {
        ganancia: numero(c, "profit_first_ganancia", 0.05),
        sueldo: numero(c, "profit_first_sueldo", 0.5),
        impuestos: numero(c, "profit_first_impuestos", 0.15),
        operacion: numero(c, "profit_first_operacion", 0.3),
      },
    },
  };

  return armarDashboard(hechos, opciones);
}
