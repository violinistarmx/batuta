/**
 * Borra alumnos y todo lo que cuelga de ellos, para poder repetir pruebas desde
 * cero. NO toca el catálogo, los usuarios ni la configuración.
 *
 * Solo para desarrollo: en producción no debe existir una forma de borrar
 * expedientes en bloque.
 */
import Database from "better-sqlite3";

if (process.env.NODE_ENV === "production") {
  console.error("Este script no corre en producción.");
  process.exit(1);
}

const db = new Database(process.env.DATABASE_URL ?? "./data/batuta.db");
db.pragma("foreign_keys = ON");

/**
 * Tablas que cuelgan de un alumno, en cualquier orden.
 *
 * Las llaves foráneas están activas y rechazan borrar un padre con hijos vivos.
 * En vez de mantener a mano el orden de dependencias —que se rompe cada vez que
 * el esquema crece— se repite el barrido hasta que no quede nada por borrar.
 */
const TABLAS = [
  "boletos", "participaciones", "recitales",
  "prestamos", "ejemplares",
  "mensajes", "seguimientos", "prospectos",
  "progreso", "tareas", "planeaciones", "documentos",
  "aplicaciones", "recibos", "pagos", "cargos",
  "nomina_partidas", "nomina_pagos",
  "creditos_clase", "posposiciones", "clases", "ciclos", "inscripciones",
  "consentimientos", "credenciales", "salud_alumno",
  "alumnos_tutores", "tutores", "alumnos",
];

const borrados = db.transaction(() => {
  const n = db.prepare("SELECT count(*) AS n FROM alumnos").get().n;

  let pendientes = [...TABLAS];
  for (let vuelta = 0; vuelta < TABLAS.length && pendientes.length > 0; vuelta++) {
    const fallaron = [];
    for (const t of pendientes) {
      try {
        db.prepare(`DELETE FROM ${t}`).run();
      } catch {
        // Todavía tiene hijos: se intenta en la siguiente vuelta.
        fallaron.push(t);
      }
    }
    if (fallaron.length === pendientes.length) {
      throw new Error(`No se pudieron vaciar: ${fallaron.join(", ")}`);
    }
    pendientes = fallaron;
  }

  // Los folios vuelven a empezar: un ambiente de pruebas con folios salteados
  // no permite verificar que el consecutivo sea consecutivo.
  db.prepare(
    "DELETE FROM secuencias WHERE clave IN ('alumno','ejemplar') " +
    "OR clave LIKE 'recibo:%' OR clave LIKE 'boleto:%'",
  ).run();
  db.prepare(
    "DELETE FROM bitacora WHERE entidad IN " +
    "('alumnos','salud_alumno','inscripciones','ciclos','clases','documentos','planeaciones'," +
    "'cargos','pagos','recibos','nomina_partidas','nomina_pagos','prospectos','mensajes'," +
    "'ejemplares','prestamos','recitales','participaciones','boletos')",
  ).run();
  return n;
})();

db.close();
console.log(`Listo: ${borrados} alumno(s) eliminados junto con tutores, salud y consentimientos.`);
