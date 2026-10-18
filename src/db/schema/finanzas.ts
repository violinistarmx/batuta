import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { alumnos, docentes, usuarios } from "./personas";
import { ciclos, clases, inscripciones } from "./academico";
import { categoriasGasto, programas, sedes } from "./catalogo";

/**
 * Todo importe en CENTAVOS. $750.00 se guarda como 75000.
 *
 * Cargo y pago son entidades distintas, unidas por aplicaciones. Modelarlo como
 * "un pago con saldo" funciona hasta que alguien abona dos veces sobre el mismo
 * mes; asi el pago a cuenta que pide el brief sale natural y nada se edita.
 */

/** Lo que se debe. */
export const cargos = sqliteTable("cargos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id, { onDelete: "cascade" }),
  inscripcionId: integer("inscripcion_id").references(() => inscripciones.id),
  cicloId: integer("ciclo_id").references(() => ciclos.id),
  concepto: text("concepto", {
    enum: ["mensualidad", "clase_suelta", "inscripcion", "material", "recital", "otro", "producto"],
  }).notNull(),
  descripcion: text("descripcion").notNull(),
  /** Periodo que ampara, en texto legible: "18 sep - 17 oct 2026". */
  periodo: text("periodo"),
  montoCentavos: integer("monto_centavos").notNull(),
  venceEl: text("vence_el").notNull(),
  /** Solo en cargos de producto: dónde se vende y se entrega. Los demás salen de su inscripción. */
  sedeId: integer("sede_id").references(() => sedes.id),
  /** Producto del catálogo del que salió el cargo. NULL = concepto libre. */
  productoId: integer("producto_id").references(() => productos.id),
  /**
   * Costo del producto congelado al venderlo. NULL = se vendió sin costo registrado
   * (concepto libre): el margen de esa venta no se conoce y el dashboard la marca.
   */
  costoCentavos: integer("costo_centavos"),
  cancelado: integer("cancelado", { mode: "boolean" }).notNull().default(false),
  motivoCancelacion: text("motivo_cancelacion"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_cargos_alumno").on(t.alumnoId, t.venceEl),
  index("ix_cargos_ciclo").on(t.cicloId),
  // Un ciclo genera una sola mensualidad: sin esto, renovar dos veces por error
  // cobraria el mes dos veces.
  uniqueIndex("ux_cargo_mensualidad_ciclo").on(t.cicloId)
    .where(sql`concepto = 'mensualidad' AND ciclo_id IS NOT NULL AND cancelado = 0`),
]);

/** El dinero que entro. */
export const pagos = sqliteTable("pagos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id, { onDelete: "cascade" }),
  montoCentavos: integer("monto_centavos").notNull(),
  /** Condonación: importe que el director perdona sin recibir dinero. */
  descuentoCentavos: integer("descuento_centavos").notNull().default(0),
  metodo: text("metodo", {
    enum: ["efectivo", "transferencia", "tarjeta", "deposito", "otro"],
  }).notNull(),
  recibidoEl: text("recibido_el").notNull(),
  referencia: text("referencia"),
  /**
   * Descripción libre que aparece en el renglón del recibo junto al concepto.
   * Distinta de `nota`: la descripción es pública (va en el comprobante),
   * la nota es interna (solo la ven dirección y recepción).
   */
  descripcion: text("descripcion"),
  nota: text("nota"),
  registradoPor: integer("registrado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("ix_pagos_alumno").on(t.alumnoId, t.recibidoEl)]);

/** Une pagos con cargos. Un pago puede saldar varios y un cargo recibir varios. */
export const aplicaciones = sqliteTable("aplicaciones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pagoId: integer("pago_id").notNull().references(() => pagos.id, { onDelete: "cascade" }),
  cargoId: integer("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
  montoCentavos: integer("monto_centavos").notNull(),
}, (t) => [
  index("ix_aplicaciones_pago").on(t.pagoId),
  index("ix_aplicaciones_cargo").on(t.cargoId),
  // Un pago se aplica una sola vez a cada cargo; si hay que corregir, se ajusta
  // esa fila en vez de acumular dos.
  uniqueIndex("ux_aplicacion_pago_cargo").on(t.pagoId, t.cargoId),
]);

/**
 * Recibo emitido. NO es un comprobante fiscal digital: lleva prefijo propio y lo
 * declara en el pie, para que nadie lo confunda con un CFDI.
 */
export const recibos = sqliteTable("recibos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  folio: text("folio").notNull(),
  pagoId: integer("pago_id").notNull().references(() => pagos.id),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id),
  emitidoPor: integer("emitido_por").references(() => usuarios.id),
  emitidoEn: integer("emitido_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_recibos_folio").on(t.folio),
  // Un pago genera un recibo. Reimprimir usa el mismo folio, no emite otro.
  uniqueIndex("ux_recibos_pago").on(t.pagoId),
]);

/**
 * Partida de nomina: lo que una clase genera para su maestro.
 *
 * El indice unico sobre clase_id es la garantia contra el doble pago. La
 * secuencia "clase reprogramada -> recuperacion impartida" paga exactamente una
 * vez aunque el flujo la haya tocado varias veces, y esa garantia la impone la
 * base, no el codigo.
 */
export const nominaPartidas = sqliteTable("nomina_partidas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claseId: integer("clase_id").notNull().references(() => clases.id, { onDelete: "cascade" }),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),
  minutos: integer("minutos").notNull(),
  estadoClase: text("estado_clase").notNull(),
  /** Tarifa por hora vigente al generar la partida, congelada aqui. */
  tarifaHoraCentavos: integer("tarifa_hora_centavos").notNull(),
  /** 1.0 normal, 0.75 cuando el alumno falto sin avisar. */
  factor: text("factor").notNull(),
  importeCentavos: integer("importe_centavos").notNull(),
  nominaId: integer("nomina_id"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_nomina_clase").on(t.claseId),
  index("ix_nomina_docente").on(t.docenteId, t.nominaId),
]);

/** Corte de nomina: el pago efectivo a un docente por un conjunto de partidas. */
export const nominaPagos = sqliteTable("nomina_pagos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),
  desdeEl: text("desde_el").notNull(),
  hastaEl: text("hasta_el").notNull(),
  totalCentavos: integer("total_centavos").notNull(),
  clases: integer("clases").notNull(),
  metodo: text("metodo", {
    enum: ["efectivo", "transferencia", "deposito", "otro"],
  }).notNull().default("transferencia"),
  pagadoEl: text("pagado_el").notNull(),
  nota: text("nota"),
  registradoPor: integer("registrado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("ix_nomina_pagos_docente").on(t.docenteId, t.pagadoEl)]);

/** Gastos de la academia, para el resultado administrativo. */
export const gastos = sqliteTable("gastos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoria: text("categoria", {
    enum: ["renta", "servicios", "instrumentos", "material", "mantenimiento", "publicidad", "otro"],
  }).notNull(),
  concepto: text("concepto").notNull(),
  montoCentavos: integer("monto_centavos").notNull(),
  fecha: text("fecha").notNull(),
  /** Categoría editable. `categoria` (texto fijo) queda solo por compatibilidad. */
  categoriaId: integer("categoria_id").references(() => categoriasGasto.id),
  subcategoria: text("subcategoria"),
  /** Fijo o variable: alimenta el punto de equilibrio. */
  tipo: text("tipo", { enum: ["fijo", "variable"] }).notNull().default("variable"),
  /** NULL = gasto general de la academia, sin sede. */
  sedeId: integer("sede_id").references(() => sedes.id),
  /** NULL = no se atribuye a un programa. */
  programaId: integer("programa_id").references(() => programas.id),
  registradoPor: integer("registrado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_gastos_fecha").on(t.fecha),
  index("ix_gastos_categoria").on(t.categoriaId, t.fecha),
]);

/**
 * Tarifa por hora de cada maestro, con vigencia. Fuente única: la usan la nómina y
 * el dashboard. Cambiar la tarifa cierra la vigente y abre otra; el pasado no cambia.
 */
export const tarifasDocente = sqliteTable("tarifas_docente", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  docenteId: integer("docente_id").notNull().references(() => docentes.id),
  tarifaHoraCentavos: integer("tarifa_hora_centavos").notNull(),
  vigenteDesde: text("vigente_desde").notNull(),
  vigenteHasta: text("vigente_hasta"),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("ix_tarifas_docente").on(t.docenteId, t.vigenteDesde),
  uniqueIndex("ux_tarifa_docente_abierta").on(t.docenteId).where(sql`vigente_hasta IS NULL`),
]);

/**
 * Diseño del dashboard de finanzas de cada usuario: qué gráficas ve, dónde, de qué
 * tamaño, de qué tipo y con qué paleta. JSON validado en lib/finanzas/diseno.ts.
 */
export const panelesFinanzas = sqliteTable("paneles_finanzas", {
  usuarioId: integer("usuario_id").primaryKey().references(() => usuarios.id, { onDelete: "cascade" }),
  diseno: text("diseno").notNull(),
  actualizadoEn: integer("actualizado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});


/**
 * Catálogo de productos que vende la academia: métodos, instrumentos de cuerda,
 * libretas. El costo y el margen son información de dirección: solo se leen con
 * `productos.gestionar`, nunca en el flujo de venta que ve la familia.
 */
export const productos = sqliteTable("productos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codigo: text("codigo"),
  nombre: text("nombre").notNull(),
  categoria: text("categoria", {
    enum: ["metodo", "instrumento", "accesorio", "papeleria", "otro"],
  }).notNull().default("otro"),
  descripcion: text("descripcion"),
  /** Lo que le cuesta a la academia. */
  costoCentavos: integer("costo_centavos").notNull().default(0),
  /** Precio de venta sugerido; el cargo puede llevar otro (descuento). */
  precioCentavos: integer("precio_centavos").notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoPor: integer("creado_por").references(() => usuarios.id),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_productos_nombre").on(t.nombre),
  uniqueIndex("ux_productos_codigo").on(t.codigo).where(sql`codigo IS NOT NULL`),
]);

/**
 * Vale de entrega de un cargo de producto. Uno por cargo.
 *
 * `codigo` es el legible (VE-2026-000123); `token` es lo que lleva el QR y no es
 * secuencial, para que nadie pueda construir los vales vecinos.
 */
export const valesEntrega = sqliteTable("vales_entrega", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codigo: text("codigo").notNull(),
  token: text("token").notNull(),
  cargoId: integer("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
  estado: text("estado", { enum: ["pendiente", "entregado"] }).notNull().default("pendiente"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  entregadoEn: integer("entregado_en", { mode: "timestamp" }),
  entregadoPor: integer("entregado_por").references(() => usuarios.id),
  /** Entrega con el cargo sin saldar: motivo y director que la autorizó. */
  excepcionMotivo: text("excepcion_motivo"),
  autorizadoPor: integer("autorizado_por").references(() => usuarios.id),
}, (t) => [
  uniqueIndex("ux_vales_codigo").on(t.codigo),
  uniqueIndex("ux_vales_token").on(t.token),
  uniqueIndex("ux_vales_cargo").on(t.cargoId),
  index("ix_vales_estado").on(t.estado),
  check("ck_vale_entrega", sql`(estado = 'entregado') = (entregado_en IS NOT NULL AND entregado_por IS NOT NULL)`),
]);
