import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema/index";

const url = process.env.DATABASE_URL ?? "./data/batuta.db";
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url);

// Este va PRIMERO, y el orden no es cosmetico: busy_timeout solo protege a las
// sentencias que vienen despues. Cambiar a WAL exige candado exclusivo, y
// `next build` evalua este modulo en decenas de procesos a la vez al recolectar
// los datos de las paginas. Con el timeout al final, el primero que pierde la
// carrera recibe SQLITE_BUSY de inmediato y tumba la compilacion entera; con el
// al principio, espera su turno —son microsegundos— y pasa.
sqlite.pragma("busy_timeout = 5000");
// WAL: lecturas concurrentes sin bloquear escrituras. Con ~20 alumnos y tres
// usuarios simultaneos, SQLite cubre el volumen de sobra y el respaldo sigue
// siendo lo que el brief pedia que fuera: un archivo.
sqlite.pragma("journal_mode = WAL");
// Las llaves foraneas NO estan activas por omision en SQLite. Sin esto, borrar un
// alumno dejaria inscripciones huerfanas sin que nada se queje.
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
