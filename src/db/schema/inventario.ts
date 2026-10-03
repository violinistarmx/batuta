import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { instrumentos } from "./catalogo";
import { alumnos, usuarios } from "./personas";
import { ciclos, inscripciones } from "./academico";

/**
 * Un instrumento FISICO concreto, no un tipo de instrumento.
 *
 * `instrumentos` dice que la academia ensena violin; `ejemplares` dice que tiene
 * cuatro violines, uno de ellos con el arco flojo y otro prestado desde el martes.
 * Sin esa distincion no se puede contestar «¿hay uno libre?», que es la unica
 * pregunta que se le hace a un inventario.
 */
export const ejemplares = sqliteTable("ejemplares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codigo: text("codigo").notNull(),
  instrumentoId: integer("instrumento_id").notNull().references(() => instrumentos.id),
  marca: text("marca"),
  modelo: text("modelo"),
  numeroSerie: text("numero_serie"),
  /** Tamano: 4/4, 3/4, 1/2... Un violin de 1/2 no le sirve a un adolescente. */
  medida: text("medida"),

  estado: text("estado", {
    enum: ["disponible", "prestado", "en_reparacion", "baja"],
  }).notNull().default("disponible"),
  condicion: text("condicion", {
    enum: ["nuevo", "bueno", "regular", "dañado"],
  }).notNull().default("bueno"),

  ubicacion: text("ubicacion"),
  /**
   * Valor de reposicion, informativo. NO genera cargos: un dano no se cobra solo,
   * la direccion decide. Sirve para el seguro y para saber cuanto se arriesga al
   * prestar.
   */
  valorCentavos: integer("valor_centavos"),
  adquiridoEl: text("adquirido_el"),
  notas: text("notas"),

  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_ejemplares_codigo").on(t.codigo),
  index("ix_ejemplares_instrumento").on(t.instrumentoId, t.estado),
  uniqueIndex("ux_ejemplares_serie").on(t.numeroSerie).where(sql`numero_serie IS NOT NULL`),
]);

/**
 * Salida y regreso de un ejemplar. Clausula 9a.
 *
 * El prestamo se ancla al ciclo: dura lo que dura el periodo pagado. Cuando el
 * periodo cierra sin renovar, el instrumento esta en casa de alguien que ya no
 * toma clases, y esa es la situacion que de verdad urge.
 *
 * No hay deposito en garantia y un dano no genera cargo: queda la evidencia y la
 * direccion decide que cobrar. Cobrarle a una familia por un arco roto sin que
 * nadie lo haya tecleado es exactamente lo que no debe pasar solo.
 */
export const prestamos = sqliteTable("prestamos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ejemplarId: integer("ejemplar_id").notNull().references(() => ejemplares.id),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id),
  inscripcionId: integer("inscripcion_id").notNull().references(() => inscripciones.id),
  /** El periodo que lo ampara. Al renovar se revisa. */
  cicloId: integer("ciclo_id").notNull().references(() => ciclos.id),

  entregadoEl: text("entregado_el").notNull(),
  entregadoPor: integer("entregado_por").references(() => usuarios.id),
  condicionSalida: text("condicion_salida", {
    enum: ["nuevo", "bueno", "regular", "dañado"],
  }).notNull(),
  /** El tutor firmo la responsiva. Sin firma no sale el instrumento. */
  responsivaFirmada: integer("responsiva_firmada", { mode: "boolean" }).notNull().default(false),

  devueltoEl: text("devuelto_el"),
  recibidoPor: integer("recibido_por").references(() => usuarios.id),
  condicionRegreso: text("condicion_regreso", {
    enum: ["nuevo", "bueno", "regular", "dañado"],
  }),
  incidencia: text("incidencia", { enum: ["ninguna", "dano", "perdida"] }),
  incidenciaNota: text("incidencia_nota"),

  notas: text("notas"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_prestamos_alumno").on(t.alumnoId),
  index("ix_prestamos_ciclo").on(t.cicloId),
  /**
   * Un ejemplar esta prestado a lo sumo una vez.
   *
   * Es la garantia del modulo: sin ella, dos clics seguidos —o dos personas en
   * recepcion al mismo tiempo— entregan el mismo violin a dos familias, y el
   * inventario deja de contestar «¿hay uno libre?». La impone la base, no la
   * pantalla que deshabilita el boton.
   */
  uniqueIndex("ux_prestamo_abierto").on(t.ejemplarId).where(sql`devuelto_el IS NULL`),
  /** Devolver exige decir en que estado volvio: «devuelto» a secas no dice nada. */
  check("ck_prestamo_devolucion_completa",
    sql`devuelto_el IS NULL OR (condicion_regreso IS NOT NULL AND incidencia IS NOT NULL)`),
  /** Una incidencia sin nota no le sirve a quien tiene que decidir que cobrar. */
  check("ck_prestamo_incidencia_con_nota",
    sql`incidencia IS NULL OR incidencia = 'ninguna' OR incidencia_nota IS NOT NULL`),
]);
