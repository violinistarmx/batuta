import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { instrumentos, programas } from "./catalogo";
import { alumnos, usuarios } from "./personas";

/**
 * Quien pregunta por clases y todavia no es alumno.
 *
 * El prospecto guarda DOS personas porque asi llegan: "hola, quiero clases para mi
 * hija de 7 anos" tiene un alumno en potencia y un adulto que escribe. Meterlos en
 * un solo juego de campos obliga a decidir de quien es el telefono, y al convertir
 * se pierde el parentesco que ya habia dicho el contrato que hace falta.
 */
export const prospectos = sqliteTable("prospectos", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  /** Quien tomaria la clase. */
  nombre: text("nombre").notNull(),
  edadAproximada: integer("edad_aproximada"),

  /** Quien pregunta. En un adulto que pregunta por si mismo, es la misma persona. */
  contactoNombre: text("contacto_nombre"),
  contactoParentesco: text("contacto_parentesco"),
  telefono: text("telefono"),
  whatsapp: text("whatsapp"),
  email: text("email"),

  programaInteresId: integer("programa_interes_id").references(() => programas.id),
  instrumentoInteresId: integer("instrumento_interes_id").references(() => instrumentos.id),

  /**
   * De donde llego. Es el dato que decide en que gastar el siguiente peso de
   * publicidad, y se pierde para siempre si no se captura al primer contacto.
   */
  origen: text("origen", {
    enum: [
      "instagram", "facebook", "tiktok", "recomendacion", "paso_por_la_calle",
      "whatsapp", "google", "evento", "otro",
    ],
  }).notNull().default("otro"),
  origenDetalle: text("origen_detalle"),

  estado: text("estado", {
    enum: ["nuevo", "contactado", "clase_muestra", "en_negociacion", "convertido", "perdido"],
  }).notNull().default("nuevo"),

  /** Clase muestra: se guarda como cita, no como clase real; todavia no hay ciclo. */
  claseMuestraEl: text("clase_muestra_el"),
  claseMuestraHora: text("clase_muestra_hora"),
  claseMuestraAsistio: integer("clase_muestra_asistio", { mode: "boolean" }),

  motivoPerdida: text("motivo_perdida", {
    enum: ["precio", "horario", "distancia", "no_contesto", "eligio_otra", "sin_interes", "otro"],
  }),
  motivoDetalle: text("motivo_detalle"),

  /** Fecha civil del proximo contacto acordado. Sin esto el prospecto se enfria solo. */
  proximoSeguimientoEl: text("proximo_seguimiento_el"),
  asignadoA: integer("asignado_a").references(() => usuarios.id),

  /** Resultado de la conversion. Enlaza el expediente con su origen comercial. */
  alumnoId: integer("alumno_id").references(() => alumnos.id),
  convertidoEn: integer("convertido_en", { mode: "timestamp" }),

  notas: text("notas"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  actualizadoEn: integer("actualizado_en", { mode: "timestamp" }),
}, (t) => [
  index("ix_prospectos_estado").on(t.estado, t.proximoSeguimientoEl),
  index("ix_prospectos_origen").on(t.origen),
  index("ix_prospectos_telefono").on(t.telefono),
  /**
   * Un alumno proviene de un solo prospecto.
   *
   * Sin este indice, dos clics seguidos en "convertir" crean dos expedientes para
   * el mismo nino, o dos prospectos distintos reclaman al mismo alumno y el embudo
   * cuenta dos conversiones donde hubo una. La garantia la impone la base, no la
   * pantalla que deshabilita el boton.
   */
  uniqueIndex("ux_prospecto_alumno").on(t.alumnoId).where(sql`alumno_id IS NOT NULL`),
  /**
   * Un prospecto convertido SIEMPRE apunta a su alumno.
   *
   * La otra mitad de la misma garantia: el indice impide que dos prospectos
   * reclamen al mismo alumno, y este CHECK impide declarar una conversion sin
   * expediente. Juntos hacen que el numero de convertidos del embudo sea el numero
   * de expedientes abiertos, no una afirmacion que alguien escribio.
   */
  check("ck_prospecto_convertido", sql`estado <> 'convertido' OR alumno_id IS NOT NULL`),
]);

/**
 * Cada intento de contacto, con su canal y su resultado.
 *
 * Es append-only como el libro mayor de creditos: un prospecto que dice "ya le
 * marque tres veces" necesita las tres marcas, no un contador. Tambien es la
 * respuesta a "quien quedo de llamarle y no lo hizo".
 */
export const seguimientos = sqliteTable("seguimientos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prospectoId: integer("prospecto_id").notNull()
    .references(() => prospectos.id, { onDelete: "cascade" }),
  fecha: text("fecha").notNull(),
  canal: text("canal", {
    enum: ["whatsapp", "llamada", "mensaje_directo", "correo", "presencial", "otro"],
  }).notNull().default("whatsapp"),
  resultado: text("resultado", {
    enum: [
      "contactado", "sin_respuesta", "agendo_clase_muestra",
      "pidio_informacion", "rechazo", "otro",
    ],
  }).notNull().default("contactado"),
  nota: text("nota"),
  registradoPor: integer("registrado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("ix_seguimientos_prospecto").on(t.prospectoId, t.fecha)]);
