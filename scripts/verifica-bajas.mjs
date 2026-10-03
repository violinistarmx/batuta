/**
 * Comprueba que ninguna baja haya quedado a medias.
 *
 * Dar de baja mueve tres cosas a la vez —la inscripción, el cargo del período y
 * la agenda— y las tres viven en tablas distintas. Una baja a medias no se ve:
 * la inscripción dice «finalizada» y el cubículo sigue ocupado por un alumno que
 * ya no está, o el cargo sigue pidiendo el mes completo de alguien que se fue a
 * media mensualidad. Nada falla; simplemente está mal.
 *
 * Esto corre contra la base real, no contra datos de prueba.
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/batuta.db");
let fallas = 0;
const ok = (m) => console.log("  OK    " + m);
const fail = (m) => { console.log("  FALLA " + m); fallas++; };

console.log("\n== GARANTIA: una baja no deja el cubiculo ocupado ==");

const colgadas = db.prepare(`
  SELECT c.id, c.inscripcion_id, i.fecha_fin,
         date(c.inicia_en, 'unixepoch', '-6 hours') AS dia
  FROM clases c
  JOIN inscripciones i ON i.id = c.inscripcion_id
  WHERE i.estado = 'finalizada'
    AND i.fecha_fin IS NOT NULL
    AND c.estado = 'programada'
    AND date(c.inicia_en, 'unixepoch', '-6 hours') > i.fecha_fin
`).all();

colgadas.length === 0
  ? ok("ninguna clase programada sobrevive a la fecha de baja de su inscripcion")
  : fail(`${colgadas.length} clase(s) programadas despues de la baja: ` +
         colgadas.map((c) => `clase ${c.id} el ${c.dia} (baja al ${c.fecha_fin})`).join(", "));

console.log("\n== GARANTIA: una baja no expropia clases ya pagadas ==");

// El periodo de una baja sigue abierto a proposito hasta su fecha: quien pago el
// mes se lo queda entero. Lo que no puede pasar es que el saldo quede en negativo
// —se habrian consumido creditos que nadie emitio— ni que sobreviva un periodo
// cuyo saldo ya no le sirve a nadie porque la baja surtio efecto antes.
const negativos = db.prepare(`
  SELECT ci.id, coalesce((SELECT sum(cc.delta) FROM creditos_clase cc WHERE cc.ciclo_id = ci.id), 0) AS saldo
  FROM ciclos ci
  JOIN inscripciones i ON i.id = ci.inscripcion_id
  WHERE i.estado = 'finalizada'
`).all().filter((c) => c.saldo < 0);

negativos.length === 0
  ? ok("ningun periodo de una baja quedo con saldo negativo")
  : fail(`${negativos.length} periodo(s) con saldo negativo: ` +
         negativos.map((c) => `ciclo ${c.id}: ${c.saldo}`).join(", "));

console.log("\n== CUADRE: ningun cargo ajustado quedo por debajo de lo cobrado ==");

// Reducir un cargo por debajo de lo que el tutor ya pago seria una devolucion
// encubierta, y la clausula 12a no la concede.
const bajoLoPagado = db.prepare(`
  SELECT c.id, c.monto_centavos AS monto,
         coalesce((SELECT sum(a.monto_centavos) FROM aplicaciones a WHERE a.cargo_id = c.id), 0) AS aplicado
  FROM cargos c
  WHERE c.cancelado = 0
    AND coalesce((SELECT sum(a.monto_centavos) FROM aplicaciones a WHERE a.cargo_id = c.id), 0) > c.monto_centavos
`).all();

bajoLoPagado.length === 0
  ? ok("ningun cargo vale menos de lo que ya se le aplico")
  : fail(`${bajoLoPagado.length} cargo(s) por debajo de lo cobrado: ` +
         bajoLoPagado.map((c) => `cargo ${c.id}: ${c.monto} < ${c.aplicado}`).join(", "));

console.log("\n== GARANTIA: nadie se fue con un instrumento de la academia ==");

const conInstrumento = db.prepare(`
  SELECT p.id, p.ejemplar_id, i.id AS insc
  FROM prestamos p
  JOIN inscripciones i ON i.id = p.inscripcion_id
  WHERE p.devuelto_el IS NULL AND i.estado = 'finalizada'
`).all();

conInstrumento.length === 0
  ? ok("ninguna inscripcion finalizada conserva un prestamo abierto")
  : fail(`${conInstrumento.length} prestamo(s) abiertos de alumnos dados de baja: ` +
         conInstrumento.map((p) => `prestamo ${p.id}, ejemplar ${p.ejemplar_id}`).join(", "));

console.log("\n== CUADRE: toda baja dice cuando aviso y con que efecto ==");

const mudas = db.prepare(`
  SELECT id FROM inscripciones
  WHERE estado = 'finalizada' AND (fecha_fin IS NULL OR aviso_baja_en IS NULL)
`).all();

mudas.length === 0
  ? ok("toda inscripcion finalizada tiene fecha de aviso y fecha de efecto")
  : fail(`${mudas.length} baja(s) sin fecha de aviso o de efecto: ` +
         mudas.map((i) => `inscripcion ${i.id}`).join(", "));

db.close();
console.log("");
process.exit(fallas > 0 ? 1 : 0);
