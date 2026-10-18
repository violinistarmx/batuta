/**
 * Datos de demostración del dashboard de finanzas (12 meses).
 *
 *   npm run seed:finanzas              siembra
 *   npm run seed:finanzas -- --limpiar borra lo sembrado
 *
 * SOLO local. Se niega a correr en producción (Railway o NODE_ENV=production): los
 * datos demo nunca deben mezclarse con alumnos y pagos reales.
 */

import type { Conexion } from "../src/lib/finanzas/cargar.ts";
import { limpiarDemo, sembrarDemo } from "../src/lib/finanzas/demo.ts";

const enProduccion = process.env.NODE_ENV === "production"
  || Boolean(process.env.RAILWAY_ENVIRONMENT)
  || Boolean(process.env.RAILWAY_PROJECT_ID)
  || (process.env.DATABASE_URL ?? "").startsWith("/app/");

if (enProduccion) {
  console.error("✗ seed:finanzas no corre en producción. Los datos demo son solo para desarrollo local.");
  process.exit(1);
}

async function main() {
  // El módulo nativo se carga después del candado de producción.
  const { default: Database } = await import("better-sqlite3");
  const ruta = process.env.DATABASE_URL ?? "./data/batuta.db";
  const db = new Database(ruta);
  db.pragma("foreign_keys = ON");
  const cx = db as unknown as Conexion;

  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  if (process.argv.includes("--limpiar")) {
    const r = limpiarDemo(cx);
    console.log(`✓ Datos demo borrados de ${ruta}: ${r.alumnos} alumnos y ${r.gastos} gastos.`);
  } else {
    const r = sembrarDemo(cx, hoy);
    console.log(`✓ Datos demo en ${ruta} (${r.meses[0]} a ${r.meses[r.meses.length - 1]}):`);
    console.log(`  ${r.alumnos} alumnos · ${r.clases} clases · ${r.pagos} pagos · ` +
      `${r.cortesNomina} cortes de nómina · ${r.gastos} gastos · ${r.ventasProductos} ventas de productos`);
    console.log("  Para borrarlos: npm run seed:finanzas -- --limpiar");
  }
  db.close();
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
