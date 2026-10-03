/**
 * Restaura un respaldo, comprobando ANTES que sirve.
 *
 * El orden importa: primero se verifica el hash del manifiesto, luego la integridad
 * de la copia, y solo entonces se toca la base viva. Restaurar primero y descubrir
 * después que el archivo estaba corrupto deja a la academia sin base Y sin
 * respaldo, que es el peor resultado posible de una operación de rescate.
 *
 * La base que se reemplaza NO se borra: se aparta con marca de tiempo. Si la
 * restauración era la decisión equivocada, todavía hay a dónde volver.
 *
 *   node scripts/restaurar.mjs respaldos/batuta-2026-09-19-06-23-45
 *   node scripts/restaurar.mjs <carpeta> --si-estoy-seguro
 */
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync,
} from "node:fs";
import { join } from "node:path";

const BASE = process.env.DATABASE_URL ?? "./data/batuta.db";
const ALMACEN = process.env.ALMACEN_DIR ?? "./almacen";

const carpeta = process.argv[2];
const confirmado = process.argv.includes("--si-estoy-seguro");

const ok = (m) => console.log("  OK    " + m);
const fatal = (m) => { console.error("  FALLA " + m); process.exit(1); };

if (!carpeta) {
  console.error("\nUso: node scripts/restaurar.mjs <carpeta-del-respaldo> [--si-estoy-seguro]\n");
  process.exit(1);
}
if (!existsSync(join(carpeta, "manifiesto.json"))) {
  fatal(`${carpeta} no tiene manifiesto.json: no es un respaldo de este sistema.`);
}

const m = JSON.parse(readFileSync(join(carpeta, "manifiesto.json"), "utf8"));
console.log(`\n== RESTAURAR ${m.tomadoEn} ==`);

const sha256 = (ruta) => createHash("sha256").update(readFileSync(ruta)).digest("hex");

// ------------------------------------------------------- comprobaciones ---
const copiaDb = join(carpeta, m.base.archivo);
if (!existsSync(copiaDb)) fatal(`falta ${m.base.archivo} dentro del respaldo.`);

if (sha256(copiaDb) !== m.base.sha256) {
  fatal("el SHA-256 de la base NO coincide con el manifiesto: el archivo se corrompió.");
}
ok("SHA-256 de la base coincide con el manifiesto");

const copia = new Database(copiaDb, { readonly: true });
if (copia.pragma("integrity_check", { simple: true }) !== "ok") {
  copia.close();
  fatal("integrity_check falló sobre la copia. No se restaura nada.");
}
ok("integrity_check sobre la copia: ok");

const conteos = [];
for (const [t, esperado] of Object.entries(m.conteos ?? {})) {
  if (esperado === null) continue;
  const real = copia.prepare(`SELECT count(*) n FROM ${t}`).get().n;
  if (real !== esperado) {
    copia.close();
    fatal(`${t}: ${real} filas contra ${esperado} del manifiesto. No se restaura nada.`);
  }
  conteos.push(`${t}=${real}`);
}
copia.close();
ok(`conteos verificados (${conteos.length} tablas)`);

if (m.almacen) {
  const tgz = join(carpeta, m.almacen.archivo);
  if (!existsSync(tgz)) fatal(`falta ${m.almacen.archivo}.`);
  if (sha256(tgz) !== m.almacen.sha256) fatal("el SHA-256 del almacén no coincide.");
  ok("SHA-256 del almacén coincide");
}

// ------------------------------------------------------------- confirmar ---
if (!confirmado) {
  const vive = existsSync(BASE);
  console.log("\n  El respaldo está íntegro y es restaurable.");
  console.log(`  Contiene: ${conteos.slice(0, 6).join(" · ")}…`);
  if (vive) {
    console.log(`\n  ATENCIÓN: esto REEMPLAZA ${BASE}.`);
    console.log("  La base actual se apartará con marca de tiempo, no se borra.");
  }
  console.log("\n  DETÉN LA APLICACIÓN ANTES DE RESTAURAR.");
  console.log("  Un proceso que ya tiene la base abierta sigue escribiendo en el archivo");
  console.log("  que tenía cuando arrancó, no en el que quede después. Restaurar con la");
  console.log("  aplicación viva parece funcionar y no hace nada.");
  console.log("\n  Para proceder:");
  console.log(`  node scripts/restaurar.mjs ${carpeta} --si-estoy-seguro\n`);
  process.exit(0);
}

// -------------------------------------------------------------- restaurar ---
const sello = new Date().toISOString().replace(/[:.]/g, "-");

if (existsSync(BASE)) {
  // Primero se pliega el WAL dentro del archivo: sin esto, la copia de seguridad de
  // la base que estamos reemplazando saldria sin los ultimos cambios, justo los que
  // alguien querria recuperar si la restauracion resulta ser un error.
  const viva = new Database(BASE);
  viva.pragma("wal_checkpoint(TRUNCATE)");
  viva.close();

  // Se COPIA la base actual a un lado en vez de moverla, y luego se escribe encima
  // del archivo original. Renombrarlo dejaria al proceso que ya lo tiene abierto
  // escribiendo en un archivo que ya nadie ve: la restauracion pareceria haber
  // funcionado y la aplicacion seguiria con los datos viejos hasta reiniciarse.
  copyFileSync(BASE, `${BASE}.reemplazada-${sello}`);
  ok(`copia de la base anterior en ${BASE}.reemplazada-${sello}`);
}

copyFileSync(copiaDb, BASE);

// El WAL y el shm de la base anterior describen cambios que ya no existen: si se
// quedan, SQLite los aplica encima de la recien restaurada y la corrompe.
for (const sufijo of ["-wal", "-shm"]) {
  if (existsSync(BASE + sufijo)) rmSync(BASE + sufijo, { force: true });
}
ok(`base restaurada en ${BASE} (mismo archivo, WAL anterior descartado)`);

if (m.almacen) {
  if (existsSync(ALMACEN) && readdirSync(ALMACEN).length > 0) {
    const apartado = `${ALMACEN}.reemplazado-${sello}`;
    renameSync(ALMACEN, apartado);
    ok(`almacén anterior apartado en ${apartado}`);
  }
  mkdirSync(ALMACEN, { recursive: true });
  execFileSync("tar", ["-xzf", join(carpeta, m.almacen.archivo), "-C", ALMACEN]);
  ok("almacén restaurado");
}

// Comprobación final sobre la base YA restaurada: la única que de verdad cuenta.
const viva = new Database(BASE, { readonly: true });
const alumnos = viva.prepare("SELECT count(*) n FROM alumnos").get().n;
const integridad = viva.pragma("integrity_check", { simple: true });
viva.close();

integridad === "ok"
  ? ok(`base viva verificada: ${alumnos} alumno(s), integrity_check ok`)
  : fatal(`la base restaurada falla integrity_check: ${integridad}`);

console.log("\n  Listo. REINICIA LA APLICACIÓN antes de darla por buena: un proceso que");
console.log("  llevaba la base abierta no ve lo que se acaba de restaurar.\n");
