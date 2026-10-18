/**
 * Carga los hechos del dashboard con una conexión SQLite mínima.
 *
 * La interfaz `Conexion` la cumplen better-sqlite3 (la app) y node:sqlite (las
 * pruebas), así que la misma consulta se verifica contra una base real sin
 * depender del módulo nativo.
 */

import {
  SQL_CARGOS, SQL_CATALOGOS, SQL_CLASES, SQL_GASTOS, SQL_INGRESOS, SQL_INSCRIPCIONES,
  SQL_NOMINA_PAGADA,
} from "./sql.ts";
import type { Dimensiones, Hechos } from "./tipos";
import type { EstadoClase } from "../dominio/creditos";

type Fila = Record<string, unknown>;

export type Sentencia = {
  all(...parametros: unknown[]): unknown[];
  get(...parametros: unknown[]): unknown;
  run(...parametros: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
};

export type Conexion = {
  prepare(sql: string): Sentencia;
  exec(sql: string): unknown;
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const txt = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function dims(r: Fila): Dimensiones {
  return {
    programaId: num(r.programaId),
    instrumentoId: num(r.instrumentoId),
    docenteId: num(r.docenteId),
    sedeId: num(r.sedeId),
  };
}

/** Hechos entre dos fechas civiles (inclusive). Las inscripciones se cargan todas. */
export function cargarHechos(cx: Conexion, desde: string, hasta: string): Hechos {
  const p = { desde, hasta };
  const todas = (sql: string, conParametros = true) =>
    (conParametros ? cx.prepare(sql).all(p) : cx.prepare(sql).all()) as Fila[];

  return {
    ingresos: todas(SQL_INGRESOS).map((r) => ({
      ...dims(r), mes: String(r.mes), centavos: Number(r.centavos ?? 0),
    })),
    clases: todas(SQL_CLASES).map((r) => ({
      ...dims(r),
      mes: String(r.mes),
      estado: String(r.estado) as EstadoClase,
      minutos: Number(r.minutos),
      tarifaDocente: num(r.tarifaDocente),
      tarifaPrograma: num(r.tarifaPrograma),
      importePartida: num(r.importePartida),
    })),
    nomina: todas(SQL_NOMINA_PAGADA).map((r) => ({
      ...dims(r), mes: String(r.mes), centavos: Number(r.centavos ?? 0),
    })),
    gastos: todas(SQL_GASTOS).map((r) => ({
      mes: String(r.mes),
      categoriaId: num(r.categoriaId),
      subcategoria: txt(r.subcategoria),
      tipo: r.tipo === "fijo" ? "fijo" as const : "variable" as const,
      sedeId: num(r.sedeId),
      programaId: num(r.programaId),
      centavos: Number(r.centavos ?? 0),
    })),
    cargos: todas(SQL_CARGOS).map((r) => ({
      ...dims(r), mes: String(r.mes),
      facturado: Number(r.facturado ?? 0), saldado: Number(r.saldado ?? 0),
    })),
    inscripciones: todas(SQL_INSCRIPCIONES, false).map((r) => ({
      ...dims(r),
      id: Number(r.id),
      alumnoId: Number(r.alumnoId),
      fechaInicio: String(r.fechaInicio),
      fechaFin: txt(r.fechaFin),
      origen: txt(r.origen),
    })),
    catalogos: {
      programas: todas(SQL_CATALOGOS.programas, false).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) })),
      instrumentos: todas(SQL_CATALOGOS.instrumentos, false).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) })),
      sedes: todas(SQL_CATALOGOS.sedes, false).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) })),
      docentes: todas(SQL_CATALOGOS.docentes, false).map((r) => ({ id: Number(r.id), nombre: String(r.nombre) })),
      categorias: todas(SQL_CATALOGOS.categorias, false).map((r) => ({
        id: Number(r.id), nombre: String(r.nombre), color: String(r.color), clave: txt(r.clave),
      })),
    },
  };
}
