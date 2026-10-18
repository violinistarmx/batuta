/**
 * Observaciones automáticas para el dashboard y el reporte PDF.
 *
 * Reglas simples y explicables sobre los indicadores ya calculados: cada frase dice
 * qué cambió, cuánto y contra qué. Nada de interpretación: el director decide.
 */

import { pesosExactos } from "../formato.ts";

export type Metas = {
  costoDocenteMax: number;
  margenNetoMin: number;
  margenBrutoMin: number;
  cobranzaMin: number;
  retencionMin: number;
  cacMaxCentavos: number;
  tolerancia: number;
};

export type Corte = {
  /** Cómo se nombra el periodo en una frase: "septiembre", "2025". */
  etiqueta: string;
  ingresos: number;
  costoDocentePct: number | null;
  margenNeto: number | null;
  cobranza: number | null;
  retencion: number | null;
  cac: number | null;
  alumnosActivos: number;
  alumnosMinimos: number | null;
};

export type ProgramaResumen = { nombre: string; margen: number; margenPct: number | null };

const pct = (x: number) => `${Math.round(x * 100)} %`;
const pts = (x: number) => `${Math.round(Math.abs(x) * 100)} pts`;

/** Umbrales para que un cambio merezca frase: menos que esto es ruido. */
const CAMBIO_PTS = 0.03;
const CAMBIO_INGRESO = 0.10;

export function observaciones(
  actual: Corte,
  anterior: Corte | null,
  metas: Metas,
  programas: ProgramaResumen[] = [],
): string[] {
  const salida: string[] = [];

  if (actual.ingresos === 0 && actual.alumnosActivos === 0) {
    return ["Sin movimientos en el periodo: no hay datos suficientes para observaciones."];
  }

  // ── Cambios contra el periodo anterior ──────────────────────────────────────
  if (anterior) {
    if (actual.costoDocentePct !== null && anterior.costoDocentePct !== null) {
      const d = actual.costoDocentePct - anterior.costoDocentePct;
      if (Math.abs(d) >= CAMBIO_PTS) {
        salida.push(`El costo docente ${d > 0 ? "subió" : "bajó"} ${pts(d)} vs ${anterior.etiqueta} ` +
          `(de ${pct(anterior.costoDocentePct)} a ${pct(actual.costoDocentePct)} de los ingresos).`);
      }
    }
    if (anterior.ingresos > 0) {
      const v = (actual.ingresos - anterior.ingresos) / anterior.ingresos;
      if (Math.abs(v) >= CAMBIO_INGRESO) {
        salida.push(`Los ingresos ${v > 0 ? "subieron" : "bajaron"} ${pct(Math.abs(v))} vs ${anterior.etiqueta} ` +
          `(${pesosExactos(anterior.ingresos)} → ${pesosExactos(actual.ingresos)}).`);
      }
    }
    if (actual.margenNeto !== null && anterior.margenNeto !== null) {
      const d = actual.margenNeto - anterior.margenNeto;
      if (Math.abs(d) >= CAMBIO_PTS) {
        salida.push(`El margen neto ${d > 0 ? "mejoró" : "cayó"} ${pts(d)} vs ${anterior.etiqueta}.`);
      }
    }
  }

  // ── Contra las metas ────────────────────────────────────────────────────────
  if (actual.costoDocentePct !== null && actual.costoDocentePct > metas.costoDocenteMax) {
    salida.push(`El costo docente es ${pct(actual.costoDocentePct)} de los ingresos, arriba de la meta de ` +
      `${pct(metas.costoDocenteMax)}.`);
  }
  if (actual.margenNeto !== null) {
    salida.push(actual.margenNeto >= metas.margenNetoMin
      ? `El margen operativo neto (${pct(actual.margenNeto)}) cumple la meta de ${pct(metas.margenNetoMin)}.`
      : `El margen operativo neto (${pct(actual.margenNeto)}) está por debajo de la meta de ${pct(metas.margenNetoMin)}.`);
  }
  if (actual.cobranza !== null && actual.cobranza < metas.cobranzaMin) {
    salida.push(`Se cobró el ${pct(actual.cobranza)} de lo facturado; la meta es ${pct(metas.cobranzaMin)}.`);
  }
  if (actual.retencion !== null && actual.retencion < metas.retencionMin) {
    salida.push(`La retención fue de ${pct(actual.retencion)}, debajo de la meta de ${pct(metas.retencionMin)}.`);
  }
  if (actual.cac !== null && actual.cac > metas.cacMaxCentavos) {
    salida.push(`Cada alumno nuevo costó ${pesosExactos(actual.cac)} en publicidad, arriba del máximo de ` +
      `${pesosExactos(metas.cacMaxCentavos)}.`);
  }

  // ── Punto de equilibrio ─────────────────────────────────────────────────────
  if (actual.alumnosMinimos === null) {
    salida.push("Con el ingreso y el costo variable actuales por alumno no hay punto de equilibrio: " +
      "cada alumno cuesta lo mismo o más de lo que aporta.");
  } else if (actual.alumnosMinimos > 0) {
    const diferencia = actual.alumnosActivos - actual.alumnosMinimos;
    salida.push(diferencia >= 0
      ? `Hay ${diferencia} alumno${diferencia === 1 ? "" : "s"} por encima del punto de equilibrio ` +
        `(${actual.alumnosMinimos}).`
      : `Faltan ${-diferencia} alumno${diferencia === -1 ? "" : "s"} para el punto de equilibrio ` +
        `(${actual.alumnosMinimos}).`);
  }

  // ── Programas ──────────────────────────────────────────────────────────────
  const conMargen = programas.filter((p) => p.margenPct !== null);
  if (conMargen.length > 1) {
    const mejor = conMargen.reduce((a, b) => (b.margen > a.margen ? b : a));
    salida.push(`${mejor.nombre} es el programa que más aporta: ${pesosExactos(mejor.margen)} de margen.`);
  }
  for (const p of conMargen.filter((x) => x.margen < 0)) {
    salida.push(`${p.nombre} tiene margen negativo (${pesosExactos(p.margen)}): el costo docente supera lo cobrado.`);
  }

  return salida;
}
