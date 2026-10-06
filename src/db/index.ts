import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema/index";

// Durante `next build` en Railway, DATABASE_URL no está inyectada.
// Los 31 workers paralelos del build abren la misma DB simultáneamente y
// colisionan al intentar poner journal_mode=WAL (requiere candado exclusivo).
// Solución: si no hay DATABASE_URL usamos :memory: — solo lectura de esquema,
// sin escrituras reales, sin archivos, sin candados.
const url = process.env.DATABASE_URL;
const dbPath = url ?? ":memory:";

if (url) {
  mkdirSync(dirname(url), { recursive: true });
}

const sqlite = new Database(dbPath);

sqlite.pragma("busy_timeout = 10000");

// WAL solo tiene sentido con un archivo real; :memory: no tiene journal.
if (dbPath !== ":memory:") {
  sqlite.pragma("journal_mode = WAL");
}

// Las llaves foráneas no están activas por omisión en SQLite.
sqlite.pragma("foreign_keys = ON");

/**
 * Búsqueda sin acentos.
 * SQLite compara «Martínez» y «martinez» como distintos; esta función
 * normaliza ambos lados antes de comparar.
 */
sqlite.function("sin_acentos", { deterministic: true }, (valor: unknown) =>
  typeof valor === "string"
    ? valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    : valor as null,
);

export const db = drizzle(sqlite, { schema });
export { sqlite };
