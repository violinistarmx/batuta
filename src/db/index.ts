import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema/index";

const url = process.env.DATABASE_URL ?? "./data/batuta.db";

// mkdirSync siempre: en build el directorio tampoco existe, así que lo creamos
// antes de abrir la conexión. Si ya existe, { recursive: true } no falla.
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url);

// busy_timeout PRIMERO: protege todas las sentencias siguientes.
// Con 31 workers en paralelo durante `next build`, cada uno abre la DB;
// sin timeout, el segundo en llegar recibe SQLITE_BUSY y tumba el build.
sqlite.pragma("busy_timeout = 10000");

// WAL permite lecturas concurrentes sin bloquear escrituras. El pragma exige
// un candado exclusivo la primera vez; con busy_timeout ya activo, los workers
// que lleguen después esperan su turno en lugar de fallar de inmediato.
sqlite.pragma("journal_mode = WAL");

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
