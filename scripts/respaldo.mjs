/**
 * Respaldo verificado de la base y del almacén de archivos.
 *
 * La parte que importa no es copiar: es COMPROBAR. Un respaldo que nadie ha abierto
 * es una hipótesis, y el día que haga falta no es el día de descubrir que la copia
 * estaba truncada. Este script, después de escribir, abre la copia, le corre
 * `integrity_check`, cuenta las filas de las tablas que tienen que estar y compara
 * contra el original. Si algo no cuadra, borra la copia y sale con error: un
 * respaldo malo en la carpeta es peor que ninguno, porque da confianza falsa.
 *
 * Se usa la API de respaldo de SQLite y no `cp`: con WAL activo, copiar el archivo
 * a mano puede capturar una base a medio escribir.
 */
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";

const BASE = process.env.DATABASE_URL ?? "./data/batuta.db";
const ALMACEN = process.env.ALMACEN_DIR ?? "./almacen";
const DESTINO = process.env.RESPALDOS_DIR ?? "./respaldos";

/** Tablas cuya desaparición haría inútil el respaldo. */
const IMPRESCINDIBLES = [
  "alumnos", "tutores", "inscripciones", "ciclos", "clases", "creditos_clase",
  "cargos", "pagos", "aplicaciones", "recibos", "nomina_partidas",
  "usuarios", "roles", "permisos", "bitacora", "configuracion",
];

const sha256 = (ruta) => createHash("sha256").update(readFileSync(ruta)).digest("hex");
const ok = (m) => console.log("  OK    " + m);
const fatal = (m) => { console.error("  FALLA " + m); process.exit(1); };

if (!existsSync(BASE)) fatal(`No existe la base en ${BASE}.`);
mkdirSync(DESTINO, { recursive: true });

// La marca de tiempo va en horario de la academia: un respaldo fechado en UTC
// aparece con el día equivocado cuando se toma de noche.
const ahora = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Mexico_City",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
}).format(new Date());
const fecha = ahora.slice(0, 10);
const sello = ahora.replace(/[: ]/g, "-");

const carpeta = join(DESTINO, `batuta-${sello}`);
mkdirSync(carpeta, { recursive: true });

const copiaDb = join(carpeta, "batuta.db");

console.log(`\n== RESPALDO ${sello} ==`);

// ------------------------------------------------------------------- copia ---
const origen = new Database(BASE, { readonly: true });
await origen.backup(copiaDb);

// Conteos del original ANTES de cerrarlo, para comparar contra la copia.
const conteoOriginal = {};
for (const t of IMPRESCINDIBLES) {
  try {
    conteoOriginal[t] = origen.prepare(`SELECT count(*) n FROM ${t}`).get().n;
  } catch {
    conteoOriginal[t] = null; // La tabla aún no existe en este esquema.
  }
}
origen.close();
ok(`base copiada con la API de SQLite (${(statSync(copiaDb).size / 1048576).toFixed(1)} MB)`);

// ---------------------------------------------------------- verificación ---
const copia = new Database(copiaDb, { readonly: true });

const integridad = copia.pragma("integrity_check", { simple: true });
if (integridad !== "ok") {
  copia.close();
  rmSync(carpeta, { recursive: true, force: true });
  fatal(`integrity_check devolvió «${integridad}». Respaldo descartado.`);
}
ok("integrity_check: ok");

const fk = copia.pragma("foreign_key_check");
if (fk.length > 0) {
  copia.close();
  rmSync(carpeta, { recursive: true, force: true });
  fatal(`${fk.length} violación(es) de llave foránea. Respaldo descartado.`);
}
ok("foreign_key_check: sin violaciones");

let filas = 0;
for (const [t, esperado] of Object.entries(conteoOriginal)) {
  if (esperado === null) continue;
  let real;
  try {
    real = copia.prepare(`SELECT count(*) n FROM ${t}`).get().n;
  } catch {
    copia.close();
    rmSync(carpeta, { recursive: true, force: true });
    fatal(`la copia no tiene la tabla ${t}. Respaldo descartado.`);
  }
  if (real !== esperado) {
    copia.close();
    rmSync(carpeta, { recursive: true, force: true });
    fatal(`${t}: ${real} filas en la copia contra ${esperado} en el original. Descartado.`);
  }
  filas += real;
}
copia.close();
ok(`${Object.keys(conteoOriginal).length} tablas verificadas · ${filas} filas coinciden`);

// -------------------------------------------------------------- almacén ---
let copiaAlmacen = null;
if (existsSync(ALMACEN) && readdirSync(ALMACEN).length > 0) {
  copiaAlmacen = join(carpeta, "almacen.tgz");
  execFileSync("tar", ["-czf", copiaAlmacen, "-C", ALMACEN, "."]);
  ok(`almacén empaquetado (${(statSync(copiaAlmacen).size / 1048576).toFixed(1)} MB)`);
} else {
  console.log("  (almacén vacío: no se empaqueta)");
}

// ------------------------------------------------------------ manifiesto ---
// El hash es lo que permite comprobar años después que el archivo no se corrompió
// en el disco o en la nube donde se guardó.
const manifiesto = {
  version: 1,
  tomadoEn: ahora,
  fecha,
  zona: "America/Mexico_City",
  base: { archivo: "batuta.db", bytes: statSync(copiaDb).size, sha256: sha256(copiaDb) },
  almacen: copiaAlmacen
    ? { archivo: "almacen.tgz", bytes: statSync(copiaAlmacen).size, sha256: sha256(copiaAlmacen) }
    : null,
  conteos: conteoOriginal,
  verificado: { integrityCheck: "ok", foreignKeyCheck: "ok", filas },
};
writeFileSync(join(carpeta, "manifiesto.json"), JSON.stringify(manifiesto, null, 2));
ok("manifiesto escrito con SHA-256 de cada pieza");

// ------------------------------------------------------------- retención ---
const { aplicarRetencion, enMegas } = await import("../src/lib/dominio/respaldos.ts");

const existentes = readdirSync(DESTINO, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^batuta-\d{4}-\d{2}-\d{2}/.test(e.name))
  .map((e) => ({
    nombre: e.name,
    fecha: e.name.slice(7, 17),
    bytes: readdirSync(join(DESTINO, e.name))
      .reduce((s, f) => s + statSync(join(DESTINO, e.name, f)).size, 0),
  }));

const { conservar, borrar } = aplicarRetencion(existentes, fecha);
for (const b of borrar) rmSync(join(DESTINO, b.nombre), { recursive: true, force: true });

const total = conservar.reduce((s, r) => s + r.bytes, 0);
ok(`retención: ${conservar.length} respaldo(s) en ${enMegas(total)}` +
   (borrar.length > 0 ? `, ${borrar.length} borrado(s)` : ""));

console.log(`\n  Respaldo listo en ${carpeta}`);
console.log("  Cópialo FUERA de este servidor: un respaldo que vive en el mismo");
console.log("  disco que la base no protege contra lo que de verdad pasa.\n");
