import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema/index";

const url = process.env.DATABASE_URL ?? "./data/batuta.db";

// Durante `next build` los 31 workers abren la DB al mismo tiempo; WAL exige
// un candado exclusivo que provoca SQLITE_BUSY. En fase de build abrimos en
// modo solo-lectura para evitar cualquier escritura concurrente.
const esBuild = process.env.NEXT_PHASE === "phase-production-build";

if (!esBuild) {
  mkdirSync(dirname(url), { recursive: true });
}

const sqlite = new Database(url, esBuild ? { readonly: true, fileMustExist: false } : undefined);

sqlite.pragma("busy_timeout = 10000");

if (!esBuild) {
  // WAL: lecturas concurrentes sin bloquear escrituras. Solo se aplica en
  // tiempo de ejecución, no durante el build donde hay 31 conexiones simultáneas.
  sqlite.pragma("journal_mode = WAL");
}

// Las llaves foraneas NO estan activas por omision en SQLite.
sqlite.pragma("foreign_keys = ON");

/**
 * Búsqueda sin acentos.
 *
 * SQLite compara «Martínez» y «martinez» como distintos, y nadie en recepción
 * teclea los acentos al buscar. Esta función normaliza ambos lados de la
 * comparación: descompone los caracteres y descarta las marcas diacríticas.
 *
 * Impide usar índices, así que recorre la tabla — con cientos de alumnos eso son
 * microsegundos. Si algún día son decenas de miles, toca una columna normalizada
 * mantenida en cada escritura.
 */
sqlite.function("sin_acentos", { deterministic: true }, (valor: unknown) =>
  typeof valor === "string"
    ? valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    : valor as null,
);

export const db = drizzle(sqlite, { schema });
export { sqlite };
