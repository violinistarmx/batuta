import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema/index";

const url = process.env.DATABASE_URL ?? "./data/batuta.db";

// Durante `next build` (NEXT_PHASE=phase-production-build) los 31 workers
// evalúan este módulo en paralelo sin que exista la DB en disco. No hay
// ninguna consulta real en tiempo de build —Next.js solo importa el módulo
// para analizar rutas— así que creamos un stub que satisface los tipos sin
// tocar el sistema de archivos.
const esBuild = process.env.NEXT_PHASE === "phase-production-build";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<typeof schema>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite: InstanceType<typeof Database>;

if (esBuild) {
  // Stub: drizzle necesita un objeto con la interfaz de Database.
  // Ninguna de sus funciones se llama durante el build.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqlite = {} as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = {} as any;
} else {
  mkdirSync(dirname(url), { recursive: true });
  const _sqlite = new Database(url);
  _sqlite.pragma("busy_timeout = 10000");
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.function("sin_acentos", { deterministic: true }, (valor: unknown) =>
    typeof valor === "string"
      ? valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      : valor as null,
  );
  sqlite = _sqlite;
  db = drizzle(_sqlite, { schema });
}

export { db, sqlite };
