/**
 * Comprueba contra la base real las garantías que el diseño promete.
 *
 * No son pruebas unitarias: verifican que el ESQUEMA las impone, no el código de
 * la aplicación. Una regla que solo vive en TypeScript se puede saltar con un
 * INSERT directo; una que vive en un índice, no.
 *
 * Trabaja sobre registros propios marcados con VS-VERIF y los borra al terminar,
 * así que puede correrse sobre una base con datos reales sin tocarlos.
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/batuta.db");
db.pragma("foreign_keys = ON");

const q = (s, ...p) => db.prepare(s).all(...p);
const ok = (m) => console.log("  OK    " + m);
const fail = (m) => { console.log("  FALLA " + m); process.exitCode = 1; };

const MARCA = "VS-VERIF";

function limpiar() {
  db.transaction(() => {
    const alumno = db.prepare("SELECT id FROM alumnos WHERE codigo = ?").get(MARCA);
    if (alumno) {
      db.prepare(`DELETE FROM creditos_clase WHERE ciclo_id IN
        (SELECT c.id FROM ciclos c JOIN inscripciones i ON i.id = c.inscripcion_id WHERE i.alumno_id = ?)`).run(alumno.id);
      db.prepare(`DELETE FROM clases WHERE inscripcion_id IN
        (SELECT id FROM inscripciones WHERE alumno_id = ?)`).run(alumno.id);
      db.prepare(`DELETE FROM ciclos WHERE inscripcion_id IN
        (SELECT id FROM inscripciones WHERE alumno_id = ?)`).run(alumno.id);
      db.prepare("DELETE FROM inscripciones WHERE alumno_id = ?").run(alumno.id);
      db.prepare("DELETE FROM alumnos WHERE id = ?").run(alumno.id);
    }
    db.prepare("DELETE FROM docentes WHERE nombre = ?").run(MARCA);
  })();
}

console.log("\n== CATALOGO SEMBRADO ==");
for (const p of q(`SELECT pr.nombre, pr.clases_por_ciclo c, pr.minutos_por_clase m,
                          pr.alumnos_incluidos a, pv.precio_centavos precio
                   FROM programas pr JOIN precios_vigencia pv ON pv.programa_id = pr.id
                   WHERE pv.vigente_hasta IS NULL ORDER BY pr.orden`)) {
  // `clases_por_ciclo` es por alumno. En un plan familiar el maestro imparte —y
  // cobra— las clases de cada hermano, así que el costo se multiplica por cuántos
  // cubre el precio. Sin ese factor, un Family Duet aparentaba 66.9 % de margen
  // cuando el real es 33.8 %, y el catálogo mentía justo donde se fija el precio.
  const horas = (p.c * p.m * p.a) / 60;
  const costo = horas * 12000;
  const familia = p.a > 1 ? ` ×${p.a}` : "   ";
  console.log(`  ${p.nombre.padEnd(40)} ${String(p.c).padStart(2)} x ${p.m}min${familia} = ${String(horas).padStart(3)}h/mes  ` +
    `$${(p.precio / 100).toLocaleString("es-MX").padStart(6)}  docente $${(costo / 100).toLocaleString("es-MX").padStart(6)}  ` +
    `margen ${((p.precio - costo) / p.precio * 100).toFixed(1)}%`);
}
console.log("  Inscripción:", q(`SELECT valor FROM configuracion WHERE clave='costo_inscripcion_centavos'`)[0].valor, "centavos");

limpiar();

console.log("\n== GARANTIA: una clase no puede debitar dos veces ==");
const { claseId, cicloId } = db.transaction(() => {
  const docente = db.prepare("INSERT INTO docentes(nombre) VALUES(?) RETURNING id").get(MARCA);
  const alumno = db.prepare(
    "INSERT INTO alumnos(codigo,qr_token,nombre,fecha_inscripcion) VALUES(?,?,?,'2026-09-18') RETURNING id",
  ).get(MARCA, MARCA + "-tok", MARCA);
  const insc = db.prepare(`INSERT INTO inscripciones(alumno_id,programa_id,instrumento_id,docente_id,fecha_inicio)
    VALUES(?, (SELECT id FROM programas WHERE clave='allegro_andante'),
              (SELECT id FROM instrumentos ORDER BY orden LIMIT 1), ?, '2026-09-18') RETURNING id`)
    .get(alumno.id, docente.id);
  const ciclo = db.prepare(`INSERT INTO ciclos(inscripcion_id,numero,inicia_el,termina_el,clases_contratadas,minutos_por_clase,precio_centavos)
    VALUES(?,1,'2026-09-18','2026-10-17',4,60,75000) RETURNING id`).get(insc.id);
  const clase = db.prepare(`INSERT INTO clases(inscripcion_id,ciclo_id,docente_id,inicia_en,termina_en,minutos)
    VALUES(?,?,?,unixepoch(),unixepoch()+3600,60) RETURNING id`).get(insc.id, ciclo.id, docente.id);
  db.prepare("INSERT INTO creditos_clase(ciclo_id,delta,motivo) VALUES(?,4,'emision_ciclo')").run(ciclo.id);
  return { claseId: clase.id, cicloId: ciclo.id };
})();

const debitar = db.prepare("INSERT INTO creditos_clase(ciclo_id,clase_id,delta,motivo) VALUES(?,?,-1,'clase_tomada')");
debitar.run(cicloId, claseId);
ok("primer débito aceptado");

try {
  debitar.run(cicloId, claseId);
  fail("el segundo débito pasó: la clase se cobraría dos veces");
} catch (e) {
  ok("segundo débito RECHAZADO por la base → " + e.code);
}

const saldo = db.prepare("SELECT coalesce(sum(delta),0) s FROM creditos_clase WHERE ciclo_id=?").get(cicloId).s;
saldo === 3 ? ok(`saldo correcto: ${saldo} de 4`) : fail(`saldo incorrecto: ${saldo}`);

console.log("\n== GARANTIA: llaves foráneas activas ==");
try {
  db.prepare(`INSERT INTO clases(inscripcion_id,ciclo_id,docente_id,inicia_en,termina_en,minutos)
              VALUES(999999,999999,999999,0,0,60)`).run();
  fail("aceptó referencias inexistentes");
} catch (e) {
  ok("referencias inválidas rechazadas → " + e.code);
}

limpiar();
db.close();
console.log("");
