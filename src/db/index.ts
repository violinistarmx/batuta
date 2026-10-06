import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema/index";

const url = process.env.DATABASE_URL ?? "./data/batuta.db";
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url);

// busy_timeout PRIMERO: sin él, cualquier SQLITE_BUSY durante el build (31
// workers en paralelo) tumba la compilación de inmediato. 10 s es amplio para
// el peor caso en Railway.
sqlite.pragma("busy_timeout = 10000");

// WAL requiere un candado exclusivo al cambiar por primera vez. Si otro proceso
// ya lo hizo, el pragma devuelve "wal" y no hace nada — está bien. Si devuelve
// algo distinto de "wal" en producción puede indicar un FS sin soporte (ej.
// red), pero en Railway con volumen persistente funciona.
try {
  sqlite.pragma("journal_mode = WAL");
} catch {
  // En build sobre FS temporal Railway puede fallar aquí sin consecuencias;
  // en producción el volumen persiste y el pragma ya fue aplicado.
}

// Las llaves foraneas NO estan activas por omision en SQLite. Sin esto, borrar
// un alumno dejaria inscripciones huerfanas sin que nada se queje.
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
