/**
 * Comprueba en la base que nada puede salir sin aprobación previa.
 *
 * Es el requisito central del módulo de comunicación, así que no basta con que el
 * código lo respete: se intenta violar por SQL directo y se comprueba que la base
 * lo rechaza.
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/batuta.db");
db.pragma("foreign_keys = ON");

let fallas = 0;
const ok = (m) => console.log("  OK    " + m);
const bad = (m) => { console.log("  FALLA " + m); fallas++; };
const todos = (q, ...a) => db.prepare(q).all(...a);

console.log("\n== GARANTIA: nada se envia sin aprobacion previa ==");

const enviadosSinAprobar = todos(
  "SELECT id, destinatario FROM mensajes WHERE estado = 'enviado' AND aprobado_por IS NULL");
enviadosSinAprobar.length === 0
  ? ok("ningun mensaje enviado carece de quien lo aprobo")
  : bad(`enviados sin aprobacion: ${JSON.stringify(enviadosSinAprobar)}`);

const intento = db.transaction(() => {
  const m = db.prepare(`INSERT INTO mensajes (destinatario, cuerpo, estado)
    VALUES ('Prueba de garantia', 'texto', 'borrador') RETURNING id`).get();
  try {
    db.prepare("UPDATE mensajes SET estado = 'enviado' WHERE id = ?").run(m.id);
    return "ACEPTADO";
  } catch (e) {
    return e.code;
  } finally {
    db.prepare("DELETE FROM mensajes WHERE id = ?").run(m.id);
  }
});
const codigo = intento();
codigo === "SQLITE_CONSTRAINT_CHECK"
  ? ok(`la base rechaza el envio sin aprobacion -> ${codigo}`)
  : bad(`la base acepto el envio sin aprobacion: ${codigo}`);

console.log("\n== GARANTIA: un rechazo siempre dice por que ==");
const rechazoMudo = db.transaction(() => {
  const m = db.prepare(`INSERT INTO mensajes (destinatario, cuerpo, estado)
    VALUES ('Prueba de garantia', 'texto', 'borrador') RETURNING id`).get();
  try {
    db.prepare("UPDATE mensajes SET estado = 'rechazado' WHERE id = ?").run(m.id);
    return "ACEPTADO";
  } catch (e) {
    return e.code;
  } finally {
    db.prepare("DELETE FROM mensajes WHERE id = ?").run(m.id);
  }
})();
rechazoMudo === "SQLITE_CONSTRAINT_CHECK"
  ? ok(`la base rechaza el rechazo sin motivo -> ${rechazoMudo}`)
  : bad(`la base acepto un rechazo sin motivo: ${rechazoMudo}`);

console.log("\n== CUADRE: ningun mensaje aprobado o enviado conserva huecos ==");
const conHuecos = todos(`
  SELECT id, destinatario FROM mensajes
  WHERE estado IN ('aprobado', 'enviado') AND cuerpo LIKE '%{{%'`);
conHuecos.length === 0
  ? ok("ningun mensaje autorizado lleva {{huecos}} sin llenar")
  : bad(`mensajes con huecos autorizados: ${JSON.stringify(conHuecos)}`);

const sinTelefono = todos(`
  SELECT id, destinatario FROM mensajes
  WHERE estado = 'enviado' AND (telefono IS NULL OR trim(telefono) = '')`);
sinTelefono.length === 0
  ? ok("ningun mensaje se marco enviado sin telefono")
  : bad(`enviados sin telefono: ${JSON.stringify(sinTelefono)}`);

db.close();
console.log("");
process.exit(fallas === 0 ? 0 : 1);
