import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clave: text("clave", { enum: ["director", "docente", "asistente"] }).notNull(),
  nombre: text("nombre").notNull(),
}, (t) => [uniqueIndex("ux_roles_clave").on(t.clave)]);

export const permisos = sqliteTable("permisos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clave: text("clave").notNull(),
  descripcion: text("descripcion").notNull(),
}, (t) => [uniqueIndex("ux_permisos_clave").on(t.clave)]);

export const rolesPermisos = sqliteTable("roles_permisos", {
  rolId: integer("rol_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permisoId: integer("permiso_id").notNull().references(() => permisos.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.rolId, t.permisoId] })]);

export const usuarios = sqliteTable("usuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  nombre: text("nombre").notNull(),
  /** Argon2id. Nunca se expone ni se registra en bitacora. */
  hashPassword: text("hash_password").notNull(),
  rolId: integer("rol_id").notNull().references(() => roles.id),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  /**
   * Cuando el usuario eligio su propia contrasena.
   *
   * NULL significa que sigue usando la que le genero el sistema y que viajo por
   * WhatsApp o en un papel. Mientras sea NULL, el acceso desemboca en la pantalla
   * de cambio: decirle «cambiala en el primer acceso» y no obligarlo es como no
   * decirlo.
   */
  passwordCambiadaEn: integer("password_cambiada_en", { mode: "timestamp" }),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [uniqueIndex("ux_usuarios_email").on(t.email)]);

/** Un docente existe aunque no use el sistema: usuario_id es nulable a proposito. */
export const docentes = sqliteTable("docentes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  email: text("email"),
  /** Excepcion a la tarifa general, en centavos por hora. NULL usa la del sistema. */
  tarifaHoraCentavos: integer("tarifa_hora_centavos"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  /**
   * Fotografia de perfil. Vive en el almacen como cualquier archivo: fuera de
   * public/ y servida por un endpoint que verifica sesion.
   *
   * Es atributo de la persona, no documento del expediente: `documentos` cuelga
   * de una clase para resolver el alcance, y una foto de perfil no tiene clase.
   * Meterla ahi obligaria a aflojar ese filtro, que es justo el que impide que un
   * docente lea expedientes ajenos.
   */
  fotoRuta: text("foto_ruta"),
  fotoMime: text("foto_mime"),
  fotoBytes: integer("foto_bytes"),
  /** Para detectar corrupcion y verificar que un respaldo restauro la imagen. */
  fotoHash: text("foto_hash"),
  fotoActualizadaEn: integer("foto_actualizada_en", { mode: "timestamp" }),
}, (t) => [index("ix_docentes_usuario").on(t.usuarioId)]);

export const alumnos = sqliteTable("alumnos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Folio legible para recepcion: VS-0001. */
  codigo: text("codigo").notNull(),
  /**
   * Token opaco de 128 bits para el QR de la credencial. No es el id, no es
   * secuencial y es rotable. Escanearlo sin sesion activa no revela nada.
   */
  qrToken: text("qr_token").notNull(),
  nombre: text("nombre").notNull(),
  /** Fecha civil YYYY-MM-DD, no marca de tiempo: evita cumpleanos corridos un dia. */
  fechaNacimiento: text("fecha_nacimiento"),
  sexo: text("sexo", { enum: ["F", "M", "otro", "no_especifica"] }),
  telefono: text("telefono"),
  email: text("email"),
  direccion: text("direccion"),
  colonia: text("colonia"),
  fechaInscripcion: text("fecha_inscripcion").notNull(),
  /** Binario a proposito. El matiz vive en el estado de cada inscripcion. */
  estado: text("estado", { enum: ["activo", "inactivo"] }).notNull().default("activo"),
  objetivoMusical: text("objetivo_musical"),
  experienciaPrevia: text("experiencia_previa"),
  observaciones: text("observaciones"),
  /**
   * Fotografia de perfil. Misma decision que en `docentes`: atributo de la
   * persona, no documento del expediente.
   *
   * Guardarla NO es publicarla. El consentimiento `uso_imagen` sigue gobernando
   * la difusion (redes, material promocional); esta foto es de uso interno —
   * identificar al alumno en recepcion y en la credencial que la clausula 10a
   * obliga a emitir.
   */
  fotoRuta: text("foto_ruta"),
  fotoMime: text("foto_mime"),
  fotoBytes: integer("foto_bytes"),
  fotoHash: text("foto_hash"),
  fotoActualizadaEn: integer("foto_actualizada_en", { mode: "timestamp" }),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("ux_alumnos_codigo").on(t.codigo),
  uniqueIndex("ux_alumnos_qr").on(t.qrToken),
  index("ix_alumnos_nombre").on(t.nombre),
  index("ix_alumnos_estado").on(t.estado),
]);

export const tutores = sqliteTable("tutores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  direccion: text("direccion"),
  notas: text("notas"),
  creadoEn: integer("creado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => [index("ix_tutores_nombre").on(t.nombre)]);

/** N:N. Maria Lopez con dos hijos es un tutor y dos vinculos, no dos tutores. */
export const alumnosTutores = sqliteTable("alumnos_tutores", {
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id, { onDelete: "cascade" }),
  tutorId: integer("tutor_id").notNull().references(() => tutores.id, { onDelete: "cascade" }),
  parentesco: text("parentesco").notNull(),
  esResponsablePago: integer("es_responsable_pago", { mode: "boolean" }).notNull().default(false),
}, (t) => [primaryKey({ columns: [t.alumnoId, t.tutorId] })]);

/**
 * DATOS PERSONALES SENSIBLES (LFPDPPP art. 3 fr. VI).
 *
 * Tabla aparte y cifrada en reposo por una razon concreta: son datos de salud de
 * menores de edad. Reglas que el resto del sistema debe respetar:
 *   - permiso propio, distinto de "ver alumno"
 *   - excluida de listados, reportes y exportaciones
 *   - el catalogo de consultas de la IA no expone ninguna funcion que la lea
 *   - cada lectura se registra en bitacora
 *
 * Campos tomados literalmente del bloque "Consideraciones de salud y aprendizaje"
 * del contrato 2025.
 */
export const saludAlumno = sqliteTable("salud_alumno", {
  alumnoId: integer("alumno_id").primaryKey().references(() => alumnos.id, { onDelete: "cascade" }),
  condicionSalud: text("condicion_salud"),
  trastornoAprendizaje: text("trastorno_aprendizaje"),
  discapacidadSensorial: text("discapacidad_sensorial"),
  medicamentos: text("medicamentos"),
  /** El contrato dirige esta pregunta al maestro: el docente asignado si la ve. */
  consideracionEmocional: text("consideracion_emocional"),
  observaciones: text("observaciones"),
  actualizadoEn: integer("actualizado_en", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  actualizadoPor: integer("actualizado_por").references(() => usuarios.id),
});

/**
 * Hace operativo el "no" del contrato. Hoy depende de que alguien recuerde una
 * conversacion; aqui es una fila que el modulo de publicacion consulta.
 */
export const consentimientos = sqliteTable("consentimientos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id, { onDelete: "cascade" }),
  tipo: text("tipo", {
    enum: ["aviso_privacidad", "uso_imagen", "demo_videos", "grupo_whatsapp"],
  }).notNull(),
  otorgado: integer("otorgado", { mode: "boolean" }).notNull(),
  otorgadoPor: text("otorgado_por").notNull(),
  fecha: text("fecha").notNull(),
  revocadoEn: text("revocado_en"),
  notas: text("notas"),
}, (t) => [index("ix_consentimientos_alumno").on(t.alumnoId, t.tipo)]);

/** Clausula 10a: credencial oficial a los 7 dias del alta, sin costo. */
export const credenciales = sqliteTable("credenciales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alumnoId: integer("alumno_id").notNull().references(() => alumnos.id, { onDelete: "cascade" }),
  emitirDesde: text("emitir_desde").notNull(),
  entregadaEn: text("entregada_en"),
  entregadaPor: integer("entregada_por").references(() => usuarios.id),
  notas: text("notas"),
}, (t) => [index("ix_credenciales_alumno").on(t.alumnoId)]);
