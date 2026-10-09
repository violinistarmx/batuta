/**
 * Corrección puntual: Sofía Álvarez Barrera, primera clase de Dibujo (90 min).
 *
 * La sesión consumió 2 créditos porque la lógica anterior dividía los minutos
 * entre 60 y redondeaba hacia arriba (ceil(90/60) = 2). Lo correcto es 1.
 * Este script inserta un movimiento de +1 crédito (reposición) en creditos_clase
 * con motivo "corrección" para que el saldo quede en -1 neto por esa sesión.
 *
 * NO modifica ni borra filas existentes; solo agrega una compensación.
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_URL ?? "./data/batuta.db";
const db = new Database(DB_PATH);

// ── 1. Encontrar a Sofía ─────────────────────────────────────────────────────
const sofia = db.prepare(`
  SELECT id, nombre FROM alumnos
  WHERE nombre LIKE '%Sof%' AND nombre LIKE '%lvarez%'
`).all();

console.log("Alumnos encontrados:", sofia);
if (sofia.length === 0) {
  console.error("No se encontró a Sofía Álvarez. Revisa el nombre en la BD.");
  process.exit(1);
}
if (sofia.length > 1) {
  console.log("Hay más de un resultado. Seleccionando el primero. Si no es el correcto, ajusta el script.");
}
const alumno = sofia[0];
console.log(`\nAlumna: ${alumno.nombre} (id=${alumno.id})`);

// ── 2. Ver sus inscripciones (buscamos Dibujo) ───────────────────────────────
const inscripciones = db.prepare(`
  SELECT i.id, p.nombre AS programa, i.programa_id
  FROM inscripciones i
  JOIN programas p ON p.id = i.programa_id
  WHERE i.alumno_id = ?
`).all(alumno.id);

console.log("\nInscripciones:");
inscripciones.forEach(r => console.log(` - [${r.id}] ${r.programa}`));

// ── 3. Buscar clases de 90 min con consumo de 2 créditos ────────────────────
const clasesCandidatas = db.prepare(`
  SELECT
    c.id        AS clase_id,
    c.minutos,
    c.estado,
    c.inicia_en,
    ci.id       AS ciclo_id,
    p.nombre    AS programa,
    COALESCE(SUM(cc.delta), 0) AS saldo_creditos
  FROM clases c
  JOIN ciclos ci ON ci.id = c.ciclo_id
  JOIN inscripciones i ON i.id = c.inscripcion_id
  JOIN programas p ON p.id = i.programa_id
  LEFT JOIN creditos_clase cc ON cc.clase_id = c.id
  WHERE i.alumno_id = ?
    AND c.minutos = 90
    AND c.estado IN ('asistio', 'falta_sin_aviso')
  GROUP BY c.id
  HAVING saldo_creditos <= -2
  ORDER BY c.inicia_en ASC
`).all(alumno.id);

console.log("\nClases de 90 min con consumo de -2 créditos o más:");
clasesCandidatas.forEach(r =>
  console.log(` - clase ${r.clase_id} | ${r.programa} | ${r.inicia_en} | estado=${r.estado} | saldo=${r.saldo_creditos}`)
);

if (clasesCandidatas.length === 0) {
  console.log("\nNo se encontraron clases que necesiten corrección. Puede que ya se haya corregido o el consumo fue de 1.");
  process.exit(0);
}

// ── 4. Encontrar un usuario admin para atribuir la corrección ────────────────
const admin = db.prepare(`SELECT id FROM usuarios ORDER BY id LIMIT 1`).get();
if (!admin) { console.error("No hay usuarios en la BD."); process.exit(1); }

// ── 5. Insertar el movimiento de compensación para cada clase afectada ───────
const insertar = db.prepare(`
  INSERT INTO creditos_clase (ciclo_id, clase_id, delta, motivo, nota, creado_por)
  VALUES (?, ?, 1, 'correccion', 'Reposición: sesión de 90 min contabilizó 2 créditos en lugar de 1. Corrección manual.', ?)
`);

const corregir = db.transaction(() => {
  for (const clase of clasesCandidatas) {
    insertar.run(clase.ciclo_id, clase.clase_id, admin.id);
    console.log(`  ✓ +1 crédito repuesto en clase ${clase.clase_id} (ciclo ${clase.ciclo_id})`);
  }
});

console.log("\nAplicando correcciones...");
corregir();
console.log("Listo. Verifica el saldo de Sofía en la app.");
