/**
 * Lee el periodo, la comparación y los filtros desde la URL, y los vuelve a
 * escribir. Todo el estado del dashboard vive en la URL: se puede compartir,
 * recargar y descargar el PDF con exactamente lo que se está viendo.
 */

import type { Comparacion, Filtros, Linea, Periodo } from "./tipos";

export type Busqueda = Record<string, string | string[] | undefined>;

export type Seleccion = { periodo: Periodo; comparacion: Comparacion; filtros: Filtros };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function id(v: string | string[] | undefined): number | null {
  const s = uno(v);
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

function linea(v: string | string[] | undefined): Linea {
  const s = uno(v);
  return s === "clases" || s === "productos" ? s : "todo";
}

/** Por defecto: el mes actual, contra el mes anterior, sin filtros. */
export function leerSeleccion(b: Busqueda, hoy: string): Seleccion {
  const anioHoy = Number(hoy.slice(0, 4));
  const modo = uno(b.modo) === "anio" ? "anio" : "mes";
  const mes = uno(b.mes);
  const anio = Number(uno(b.anio));

  const periodo: Periodo = modo === "anio"
    ? { modo: "anio", anio: Number.isInteger(anio) && anio >= 2000 && anio <= anioHoy + 1 ? anio : anioHoy }
    : { modo: "mes", mes: mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoy.slice(0, 7) };

  return {
    periodo,
    comparacion: uno(b.comparar) === "anio_pasado" ? "anio_pasado" : "anterior",
    filtros: {
      linea: linea(b.linea),
      programaId: id(b.programa),
      instrumentoId: id(b.instrumento),
      sedeId: id(b.sede),
      docenteId: id(b.maestro),
      categoriaId: id(b.categoria),
    },
  };
}

/** La URL de una selección, con cambios. `null` en un filtro lo quita. */
export function escribirSeleccion(s: Seleccion, cambios: Partial<{
  periodo: Periodo; comparacion: Comparacion; filtros: Partial<Filtros>;
}> = {}): string {
  const periodo = cambios.periodo ?? s.periodo;
  const comparacion = cambios.comparacion ?? s.comparacion;
  const f = { ...s.filtros, ...cambios.filtros };
  const p = new URLSearchParams();
  if (periodo.modo === "anio") {
    p.set("modo", "anio");
    p.set("anio", String(periodo.anio));
  } else {
    p.set("mes", periodo.mes);
  }
  if (comparacion === "anio_pasado") p.set("comparar", "anio_pasado");
  if (f.linea !== "todo") p.set("linea", f.linea);
  if (f.programaId !== null) p.set("programa", String(f.programaId));
  if (f.instrumentoId !== null) p.set("instrumento", String(f.instrumentoId));
  if (f.sedeId !== null) p.set("sede", String(f.sedeId));
  if (f.docenteId !== null) p.set("maestro", String(f.docenteId));
  if (f.categoriaId !== null) p.set("categoria", String(f.categoriaId));
  return p.toString();
}

/** Nombre del archivo PDF: Reporte_Finanzas_VioliniStar_AAAA-MM.pdf (o _AAAA en modo año). */
export function nombreReporte(periodo: Periodo): string {
  const sufijo = periodo.modo === "anio" ? String(periodo.anio) : periodo.mes;
  return `Reporte_Finanzas_VioliniStar_${sufijo}.pdf`;
}
