/**
 * Comprueba que el saldo que muestran las consultas coincida con la suma real del
 * libro mayor, para cada período de cada inscripción.
 *
 * Existe por un error concreto: la subconsulta correlacionada se escribió
 * interpolando columnas de Drizzle, que las renderiza sin prefijo de tabla. El
 * SQL resultante comparaba `ciclo_id = id` dentro de creditos_clase, devolvía 0
 * en silencio y la cifra grande del expediente quedaba mal sin que nada fallara.
 *
 * Una prueba unitaria no lo habría visto: el error vivía en el SQL generado.
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/batuta.db");

// La misma subconsulta que usa la aplicación.
const comoLaApp = db.prepare(`
  SELECT c.id, c.numero, c.inscripcion_id,
         coalesce((SELECT sum(cc.delta) FROM creditos_clase cc WHERE cc.ciclo_id = c.id), 0) AS saldo
  FROM ciclos c ORDER BY c.id
`).all();

const verdad = new Map(
  db.prepare("SELECT ciclo_id, sum(delta) AS s FROM creditos_clase GROUP BY ciclo_id")
    .all().map((r) => [r.ciclo_id, r.s]),
);

let fallas = 0;
for (const c of comoLaApp) {
  const esperado = verdad.get(c.id) ?? 0;
  if (c.saldo !== esperado) {
    console.log(`  FALLA ciclo ${c.id} (período ${c.numero}): muestra ${c.saldo}, la suma es ${esperado}`);
    fallas++;
  }
}

// Ningún período cerrado debe quedar con saldo: la cláusula 4ª no permite arrastre.
const cerradosConSaldo = db.prepare(`
  SELECT c.id, coalesce((SELECT sum(cc.delta) FROM creditos_clase cc WHERE cc.ciclo_id = c.id), 0) AS saldo
  FROM ciclos c WHERE c.estado = 'cerrado'
`).all().filter((c) => c.saldo !== 0);

for (const c of cerradosConSaldo) {
  console.log(`  FALLA ciclo ${c.id} está cerrado pero conserva saldo ${c.saldo}`);
  fallas++;
}

db.close();

if (comoLaApp.length === 0) {
  console.log("  (sin períodos que revisar)");
} else if (fallas === 0) {
  console.log(`  OK    ${comoLaApp.length} período(s): el saldo mostrado coincide con el libro mayor`);
  console.log("  OK    ningún período cerrado conserva saldo");
} else {
  process.exitCode = 1;
}
