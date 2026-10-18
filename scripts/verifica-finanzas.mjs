/**
 * Comprueba en datos reales los invariantes del dinero.
 *
 * Las pruebas unitarias comprueban las reglas; esto comprueba la base: que lo
 * guardado cumpla lo que la interfaz afirma. Un cuadre que solo existe en el
 * código deja de existir en cuanto alguien escribe SQL a mano.
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/batuta.db");
db.pragma("foreign_keys = ON");

let fallas = 0;
const ok = (m) => console.log("  OK    " + m);
const bad = (m) => { console.log("  FALLA " + m); fallas++; };
const uno = (q, ...a) => db.prepare(q).get(...a);
const todos = (q, ...a) => db.prepare(q).all(...a);

console.log("\n== CUADRE: nadie pagó de más un cargo ==");
const sobre = todos(`
  SELECT c.id, c.descripcion, c.monto_centavos AS cargo,
         coalesce(sum(a.monto_centavos), 0) AS aplicado
  FROM cargos c LEFT JOIN aplicaciones a ON a.cargo_id = c.id
  GROUP BY c.id HAVING aplicado > cargo`);
sobre.length === 0
  ? ok("ningún cargo tiene aplicado más de lo que vale")
  : bad(`cargos sobreaplicados: ${JSON.stringify(sobre)}`);

console.log("\n== CUADRE: lo aplicado nunca excede el pago (más su descuento autorizado) ==");
const excede = todos(`
  SELECT p.id, p.monto_centavos + p.descuento_centavos AS pago,
         coalesce(sum(a.monto_centavos), 0) AS aplicado
  FROM pagos p LEFT JOIN aplicaciones a ON a.pago_id = p.id
  GROUP BY p.id HAVING aplicado > pago`);
excede.length === 0
  ? ok("ningún pago repartió más dinero del que entró")
  : bad(`pagos sobrerrepartidos: ${JSON.stringify(excede)}`);

console.log("\n== CUADRE: todo pago tiene un recibo y solo uno ==");
const sinRecibo = uno("SELECT count(*) n FROM pagos p WHERE NOT EXISTS (SELECT 1 FROM recibos r WHERE r.pago_id = p.id)").n;
sinRecibo === 0 ? ok("todo pago tiene recibo") : bad(`${sinRecibo} pago(s) sin recibo`);
const dobles = todos("SELECT pago_id, count(*) n FROM recibos GROUP BY pago_id HAVING n > 1");
dobles.length === 0 ? ok("ningún pago tiene dos recibos") : bad(`recibos duplicados: ${JSON.stringify(dobles)}`);

console.log("\n== GARANTIA: el folio es único ==");
const folios = todos("SELECT folio, count(*) n FROM recibos GROUP BY folio HAVING n > 1");
folios.length === 0 ? ok("no hay folios repetidos") : bad(`folios repetidos: ${JSON.stringify(folios)}`);
const recibo = uno("SELECT folio FROM recibos LIMIT 1");
if (recibo) {
  const folio = recibo.folio;
  try {
    db.prepare("INSERT INTO recibos(folio, pago_id, alumno_id) SELECT ?, pago_id, alumno_id FROM recibos LIMIT 1").run(folio);
    bad("la base aceptó un folio repetido");
  } catch (e) {
    e.code === "SQLITE_CONSTRAINT_UNIQUE"
      ? ok(`la base rechaza el folio repetido → ${e.code}`)
      : bad(`rechazó por otra razón: ${e.code}`);
  }
} else {
  console.log("  (sin recibos en la base: se omite la prueba de folio repetido)");
}

console.log("\n== GARANTIA: una clase no se paga dos veces ==");
const clase = uno("SELECT id, docente_id, minutos FROM clases WHERE estado IN ('asistio','falta') LIMIT 1");
if (clase) {
  // La prueba se basta a sí misma: mete la primera partida y comprueba que la
  // segunda rebote. Antes daba por hecho que la nómina ya estaba calculada, así
  // que su propio INSERT era el primero, entraba sin problema y el script
  // denunciaba un doble pago que no existía.
  //
  // Todo ocurre dentro de una transacción que SIEMPRE se deshace: verificar no
  // puede dejar una partida de nómina inventada en la base real.
  const partida = db.prepare(`INSERT INTO nomina_partidas
    (clase_id, docente_id, minutos, estado_clase, tarifa_hora_centavos, factor, importe_centavos)
    VALUES (?, ?, ?, 'asistio', 12000, '1', 12000)`);

  const antes = uno("SELECT count(*) n FROM nomina_partidas WHERE clase_id = ?", clase.id).n;

  try {
    db.exec("BEGIN");
    if (antes === 0) partida.run(clase.id, clase.docente_id, clase.minutos);
    try {
      partida.run(clase.id, clase.docente_id, clase.minutos);
      bad("la base aceptó pagar dos veces la misma clase");
    } catch (e) {
      e.code === "SQLITE_CONSTRAINT_UNIQUE"
        ? ok(`la base rechaza la partida duplicada → ${e.code}`)
        : bad(`rechazó por otra razón: ${e.code}`);
    }
  } finally {
    db.exec("ROLLBACK");
  }

  const despues = uno("SELECT count(*) n FROM nomina_partidas WHERE clase_id = ?", clase.id).n;
  despues === antes
    ? ok("la prueba no dejó partidas inventadas en la base")
    : bad(`quedaron ${despues - antes} partida(s) de prueba en nomina_partidas`);
} else {
  console.log("  (sin clases impartidas: se omite la prueba de nómina duplicada)");
}

console.log("\n== CUADRE: los cortes pagados suman sus partidas ==");
const cortes = todos(`
  SELECT n.id, n.total_centavos AS declarado, n.clases AS declaradas,
         coalesce(sum(p.importe_centavos), 0) AS real_total, count(p.id) AS real_clases
  FROM nomina_pagos n LEFT JOIN nomina_partidas p ON p.nomina_id = n.id
  GROUP BY n.id`);
const descuadre = cortes.filter((c) => c.declarado !== c.real_total || c.declaradas !== c.real_clases);
descuadre.length === 0
  ? ok(`${cortes.length} corte(s): el total declarado coincide con sus partidas`)
  : bad(`cortes descuadrados: ${JSON.stringify(descuadre)}`);

console.log("\n== GARANTIA: una mensualidad por período ==");
const mens = todos(`
  SELECT ciclo_id, count(*) n FROM cargos
  WHERE concepto = 'mensualidad' AND ciclo_id IS NOT NULL AND cancelado = 0
  GROUP BY ciclo_id HAVING n > 1`);
mens.length === 0 ? ok("ningún período tiene dos mensualidades") : bad(`períodos duplicados: ${JSON.stringify(mens)}`);

console.log("\n== GARANTIA: un prospecto convertido tiene expediente ==");
const huerfanos = todos(
  "SELECT id, nombre FROM prospectos WHERE estado = 'convertido' AND alumno_id IS NULL");
huerfanos.length === 0
  ? ok("ningun convertido sin alumno")
  : bad(`convertidos sin expediente: ${JSON.stringify(huerfanos)}`);

const algunProspecto = uno("SELECT id FROM prospectos WHERE alumno_id IS NULL LIMIT 1");
if (algunProspecto) {
  try {
    db.prepare("UPDATE prospectos SET estado = 'convertido' WHERE id = ?").run(algunProspecto.id);
    db.prepare("UPDATE prospectos SET estado = 'nuevo' WHERE id = ?").run(algunProspecto.id);
    bad("la base acepto declarar una conversion sin expediente");
  } catch (e) {
    e.code === "SQLITE_CONSTRAINT_CHECK"
      ? ok(`la base rechaza el convertido sin alumno -> ${e.code}`)
      : bad(`rechazo por otra razon: ${e.code}`);
  }
} else {
  console.log("  (sin prospectos abiertos: se omite la prueba del CHECK)");
}

const dobleReclamo = uno(
  "SELECT alumno_id FROM prospectos WHERE alumno_id IS NOT NULL LIMIT 1");
if (dobleReclamo) {
  const libre = uno("SELECT id FROM prospectos WHERE alumno_id IS NULL LIMIT 1");
  if (libre) {
    try {
      db.prepare("UPDATE prospectos SET alumno_id = ? WHERE id = ?")
        .run(dobleReclamo.alumno_id, libre.id);
      bad("dos prospectos reclamaron al mismo alumno");
    } catch (e) {
      e.code === "SQLITE_CONSTRAINT_UNIQUE"
        ? ok(`la base rechaza el doble reclamo -> ${e.code}`)
        : bad(`rechazo por otra razon: ${e.code}`);
    }
  }
}

console.log("\n== PRODUCTOS: cada cargo de producto tiene sede y un vale ==");
const sinSedeOVale = todos(`
  SELECT c.id FROM cargos c
  WHERE c.concepto = 'producto'
    AND (c.sede_id IS NULL OR NOT EXISTS (SELECT 1 FROM vales_entrega v WHERE v.cargo_id = c.id))`);
sinSedeOVale.length === 0
  ? ok("todo cargo de producto tiene sede y vale")
  : bad(`cargos de producto sin sede o sin vale: ${JSON.stringify(sinSedeOVale)}`);

console.log("\n== PRODUCTOS: solo los cargos de producto llevan vale ==");
const valeAjeno = todos(`
  SELECT v.id FROM vales_entrega v JOIN cargos c ON c.id = v.cargo_id WHERE c.concepto <> 'producto'`);
valeAjeno.length === 0 ? ok("ningún vale cuelga de un cargo que no es producto") : bad(`vales ajenos: ${JSON.stringify(valeAjeno)}`);

console.log("\n== PRODUCTOS: reglas de entrega ==");
const entregaIndebida = todos(`
  SELECT v.codigo,
         c.cancelado, c.monto_centavos AS monto,
         coalesce((SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = c.id), 0) AS aplicado,
         v.excepcion_motivo AS excepcion
  FROM vales_entrega v JOIN cargos c ON c.id = v.cargo_id
  WHERE v.estado = 'entregado'
    AND (c.cancelado = 1 OR (aplicado < monto AND v.excepcion_motivo IS NULL))`);
entregaIndebida.length === 0
  ? ok("ningún vale entregado tiene el cargo cancelado o sin saldar sin excepción registrada")
  : bad(`entregas indebidas: ${JSON.stringify(entregaIndebida)}`);
const excepcionSinDirector = uno(`
  SELECT count(*) n FROM vales_entrega
  WHERE excepcion_motivo IS NOT NULL AND autorizado_por IS NULL`).n;
excepcionSinDirector === 0 ? ok("toda excepción dice quién la autorizó") : bad(`${excepcionSinDirector} excepción(es) sin autorizador`);

console.log("\n== PRODUCTOS: el dinero de un producto no se cuenta dos veces ==");
try {
  const { SQL_INGRESOS, SQL_PRODUCTOS } = await import("../src/lib/finanzas/sql.ts");
  const rango = { desde: "2000-01-01", hasta: "2999-12-31" };
  const clases = db.prepare(SQL_INGRESOS).all(rango).reduce((s, r) => s + Number(r.centavos ?? 0), 0);
  const productosIng = db.prepare(SQL_PRODUCTOS).all(rango).reduce((s, r) => s + Number(r.ingreso ?? 0), 0);
  const entro = Number(uno("SELECT coalesce(sum(monto_centavos), 0) AS t FROM pagos").t);
  Math.abs(clases + productosIng - entro) < 1
    ? ok(`clases + productos = lo que entró (${entro} centavos)`)
    : bad(`el dashboard cuenta ${clases + productosIng} y entró ${entro}`);

  const costoMal = db.prepare(SQL_PRODUCTOS).all(rango).filter((r) => Number(r.costo) > Number(r.ingreso) * 20);
  costoMal.length === 0 ? ok("ningún costo reconocido es absurdo frente a lo cobrado") : bad(`costos sospechosos: ${JSON.stringify(costoMal)}`);
} catch (e) {
  console.log(`  (se omite la conciliación con las consultas del dashboard: ${e.message})`);
}

db.close();
console.log("");
process.exit(fallas === 0 ? 0 : 1);
