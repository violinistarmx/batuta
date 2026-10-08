import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Todo importe se guarda en CENTAVOS como entero.
 * $750.00 -> 75000. Nunca float: 0.1 + 0.2 !== 0.3 y la nomina no perdona.
 */

export const instrumentos = sqliteTable("instrumentos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  granFormato: integer("gran_formato", { mode: "boolean" }).notNull().default(false),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  orden: integer("orden").notNull().default(0),
}, (t) => [uniqueIndex("ux_instrumentos_nombre").on(t.nombre)]);

/**
 * Un programa queda definido por cuantas clases trae el ciclo y cuanto dura cada una.
 * Con eso basta: el contrato de 2025 lista una sola forma por programa, asi que no
 * existe tabla de modalidades.
 */
export const programas = sqliteTable("programas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clave: text("clave").notNull(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull(),
  /** Clases que recibe CADA alumno en el ciclo, no el total del grupo. */
  clasesPorCiclo: integer("clases_por_ciclo").notNull(),
  minutosPorClase: integer("minutos_por_clase").notNull(),
  /**
   * Cuantos alumnos cubre un precio. 1 en los planes individuales; 2 o 3 en los
   * familiares, donde el precio es del grupo y cada hermano recibe sus propias
   * clases individuales. Es lo que distingue un plan familiar de uno normal.
   */
  alumnosIncluidos: integer("alumnos_incluidos").notNull().default(1),
  /** Un ciclo mensual renueva; el Plan por Clase se agota y no renueva. */
  renovable: integer("renovable", { mode: "boolean" }).notNull().default(true),
  /** Clausula 9a: solo Allegro Virtuoso autoriza llevarse el instrumento a casa. */
  permitePrestamoACasa: integer("permite_prestamo_a_casa", { mode: "boolean" }).notNull().default(false),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  orden: integer("orden").notNull().default(0),
  /**
   * Tarifa de docente propia para este programa, en centavos por hora.
   * NULL = usa la tarifa global del sistema (configuracion.tarifa_docente_hora_centavos).
   * Ejemplo: programa en línea → 10000 ($100/h), dibujo → 20000 ($200/h).
   */
  tarifaDocenteHoraCentavos: integer("tarifa_docente_hora_centavos"),
}, (t) => [uniqueIndex("ux_programas_clave").on(t.clave)]);

/**
 * El precio se versiona por vigencia: cambiar la tarifa no reescribe contratos vivos.
 * La fila vigente es la que tiene vigente_hasta NULL.
 */
export const preciosVigencia = sqliteTable("precios_vigencia", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programaId: integer("programa_id").notNull().references(() => programas.id),
  precioCentavos: integer("precio_centavos").notNull(),
  vigenteDesde: text("vigente_desde").notNull(),
  vigenteHasta: text("vigente_hasta"),
}, (t) => [
  index("ix_precios_programa").on(t.programaId),
  uniqueIndex("ux_precio_vigente").on(t.programaId).where(sql`vigente_hasta IS NULL`),
]);

/** Clausula 5a: la academia opera con dos cubiculos. Es el limite duro de la agenda. */
export const aulas = sqliteTable("aulas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
}, (t) => [uniqueIndex("ux_aulas_nombre").on(t.nombre)]);

export const niveles = sqliteTable("niveles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  orden: integer("orden").notNull().default(0),
}, (t) => [uniqueIndex("ux_niveles_nombre").on(t.nombre)]);

/**
 * Contadores para folios consecutivos: codigos de alumno, folios de recibo.
 *
 * Deducir el siguiente con MAX(codigo) tiene una carrera: dos altas simultaneas en
 * recepcion leen el mismo maximo y generan el mismo folio. Aqui el incremento
 * ocurre dentro de la transaccion que crea el registro, asi que se serializa.
 */
export const secuencias = sqliteTable("secuencias", {
  clave: text("clave").primaryKey(),
  valor: integer("valor").notNull().default(0),
});

/**
 * Parametros de operacion. Ninguna regla de negocio se incrusta en el codigo:
 * el umbral de aviso, el tope de posposiciones y la tarifa docente viven aqui.
 */
export const configuracion = sqliteTable("configuracion", {
  clave: text("clave").primaryKey(),
  valor: text("valor").notNull(),
  tipo: text("tipo", { enum: ["texto", "entero", "decimal", "booleano"] }).notNull(),
  descripcion: text("descripcion").notNull(),
  /** De donde sale la regla: clausula del contrato o decision de direccion. */
  fuente: text("fuente"),
  actualizadoEn: integer("actualizado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
