CREATE TABLE `aulas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_aulas_nombre` ON `aulas` (`nombre`);--> statement-breakpoint
CREATE TABLE `configuracion` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`tipo` text NOT NULL,
	`descripcion` text NOT NULL,
	`fuente` text,
	`actualizado_en` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instrumentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`gran_formato` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_instrumentos_nombre` ON `instrumentos` (`nombre`);--> statement-breakpoint
CREATE TABLE `niveles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_niveles_nombre` ON `niveles` (`nombre`);--> statement-breakpoint
CREATE TABLE `precios_vigencia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`programa_id` integer NOT NULL,
	`precio_centavos` integer NOT NULL,
	`vigente_desde` text NOT NULL,
	`vigente_hasta` text,
	FOREIGN KEY (`programa_id`) REFERENCES `programas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_precios_programa` ON `precios_vigencia` (`programa_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_precio_vigente` ON `precios_vigencia` (`programa_id`) WHERE vigente_hasta IS NULL;--> statement-breakpoint
CREATE TABLE `programas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clave` text NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text NOT NULL,
	`clases_por_ciclo` integer NOT NULL,
	`minutos_por_clase` integer NOT NULL,
	`renovable` integer DEFAULT true NOT NULL,
	`permite_prestamo_a_casa` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_programas_clave` ON `programas` (`clave`);--> statement-breakpoint
CREATE TABLE `alumnos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo` text NOT NULL,
	`qr_token` text NOT NULL,
	`nombre` text NOT NULL,
	`fecha_nacimiento` text,
	`sexo` text,
	`telefono` text,
	`email` text,
	`direccion` text,
	`colonia` text,
	`fecha_inscripcion` text NOT NULL,
	`estado` text DEFAULT 'activo' NOT NULL,
	`objetivo_musical` text,
	`experiencia_previa` text,
	`observaciones` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_alumnos_codigo` ON `alumnos` (`codigo`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_alumnos_qr` ON `alumnos` (`qr_token`);--> statement-breakpoint
CREATE INDEX `ix_alumnos_nombre` ON `alumnos` (`nombre`);--> statement-breakpoint
CREATE INDEX `ix_alumnos_estado` ON `alumnos` (`estado`);--> statement-breakpoint
CREATE TABLE `alumnos_tutores` (
	`alumno_id` integer NOT NULL,
	`tutor_id` integer NOT NULL,
	`parentesco` text NOT NULL,
	`es_responsable_pago` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`alumno_id`, `tutor_id`),
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `consentimientos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alumno_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`otorgado` integer NOT NULL,
	`otorgado_por` text NOT NULL,
	`fecha` text NOT NULL,
	`revocado_en` text,
	`notas` text,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_consentimientos_alumno` ON `consentimientos` (`alumno_id`,`tipo`);--> statement-breakpoint
CREATE TABLE `credenciales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alumno_id` integer NOT NULL,
	`emitir_desde` text NOT NULL,
	`entregada_en` text,
	`entregada_por` integer,
	`notas` text,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entregada_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_credenciales_alumno` ON `credenciales` (`alumno_id`);--> statement-breakpoint
CREATE TABLE `docentes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer,
	`nombre` text NOT NULL,
	`telefono` text,
	`email` text,
	`tarifa_hora_centavos` integer,
	`activo` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_docentes_usuario` ON `docentes` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `permisos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clave` text NOT NULL,
	`descripcion` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_permisos_clave` ON `permisos` (`clave`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clave` text NOT NULL,
	`nombre` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_roles_clave` ON `roles` (`clave`);--> statement-breakpoint
CREATE TABLE `roles_permisos` (
	`rol_id` integer NOT NULL,
	`permiso_id` integer NOT NULL,
	PRIMARY KEY(`rol_id`, `permiso_id`),
	FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `salud_alumno` (
	`alumno_id` integer PRIMARY KEY NOT NULL,
	`condicion_salud` text,
	`trastorno_aprendizaje` text,
	`discapacidad_sensorial` text,
	`medicamentos` text,
	`consideracion_emocional` text,
	`observaciones` text,
	`actualizado_en` integer DEFAULT (unixepoch()) NOT NULL,
	`actualizado_por` integer,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tutores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text,
	`whatsapp` text,
	`email` text,
	`direccion` text,
	`notas` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_tutores_nombre` ON `tutores` (`nombre`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`nombre` text NOT NULL,
	`hash_password` text NOT NULL,
	`rol_id` integer NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_usuarios_email` ON `usuarios` (`email`);--> statement-breakpoint
CREATE TABLE `bitacora` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer,
	`accion` text NOT NULL,
	`entidad` text NOT NULL,
	`entidad_id` integer,
	`cambios` text,
	`ip` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_bitacora_entidad` ON `bitacora` (`entidad`,`entidad_id`);--> statement-breakpoint
CREATE INDEX `ix_bitacora_fecha` ON `bitacora` (`creado_en`);--> statement-breakpoint
CREATE TABLE `ciclos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`numero` integer NOT NULL,
	`inicia_el` text NOT NULL,
	`termina_el` text NOT NULL,
	`clases_contratadas` integer NOT NULL,
	`minutos_por_clase` integer NOT NULL,
	`precio_centavos` integer NOT NULL,
	`posposiciones_usadas` integer DEFAULT 0 NOT NULL,
	`estado` text DEFAULT 'abierto' NOT NULL,
	`cerrado_en` integer,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_ciclos_inscripcion_numero` ON `ciclos` (`inscripcion_id`,`numero`);--> statement-breakpoint
CREATE INDEX `ix_ciclos_estado` ON `ciclos` (`estado`);--> statement-breakpoint
CREATE TABLE `clases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`ciclo_id` integer NOT NULL,
	`docente_id` integer NOT NULL,
	`aula_id` integer,
	`inicia_en` integer NOT NULL,
	`termina_en` integer NOT NULL,
	`minutos` integer NOT NULL,
	`modalidad` text DEFAULT 'presencial' NOT NULL,
	`origen` text DEFAULT 'regular' NOT NULL,
	`estado` text DEFAULT 'programada' NOT NULL,
	`clase_original_id` integer,
	`observaciones` text,
	`registrado_por` integer,
	`registrado_en` integer,
	`evento_externo_id` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`docente_id`) REFERENCES `docentes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aula_id`) REFERENCES `aulas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_clases_ciclo` ON `clases` (`ciclo_id`);--> statement-breakpoint
CREATE INDEX `ix_clases_docente_fecha` ON `clases` (`docente_id`,`inicia_en`);--> statement-breakpoint
CREATE INDEX `ix_clases_aula_fecha` ON `clases` (`aula_id`,`inicia_en`);--> statement-breakpoint
CREATE INDEX `ix_clases_inscripcion_fecha` ON `clases` (`inscripcion_id`,`inicia_en`);--> statement-breakpoint
CREATE INDEX `ix_clases_estado` ON `clases` (`estado`);--> statement-breakpoint
CREATE TABLE `creditos_clase` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ciclo_id` integer NOT NULL,
	`clase_id` integer,
	`delta` integer NOT NULL,
	`motivo` text NOT NULL,
	`nota` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_creditos_ciclo` ON `creditos_clase` (`ciclo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_credito_debito` ON `creditos_clase` (`clase_id`) WHERE delta < 0 AND clase_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `inscripciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alumno_id` integer NOT NULL,
	`programa_id` integer NOT NULL,
	`instrumento_id` integer NOT NULL,
	`docente_id` integer NOT NULL,
	`nivel_id` integer,
	`estado` text DEFAULT 'activa' NOT NULL,
	`fecha_inicio` text NOT NULL,
	`fecha_fin` text,
	`aviso_baja_en` integer,
	`notas` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`programa_id`) REFERENCES `programas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrumento_id`) REFERENCES `instrumentos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`docente_id`) REFERENCES `docentes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`nivel_id`) REFERENCES `niveles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_inscripciones_alumno` ON `inscripciones` (`alumno_id`,`estado`);--> statement-breakpoint
CREATE INDEX `ix_inscripciones_docente` ON `inscripciones` (`docente_id`,`estado`);--> statement-breakpoint
CREATE TABLE `posposiciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clase_original_id` integer NOT NULL,
	`clase_recuperacion_id` integer,
	`aviso_en` integer NOT NULL,
	`horas_anticipacion` integer NOT NULL,
	`canal` text DEFAULT 'whatsapp' NOT NULL,
	`cumplio_umbral` integer NOT NULL,
	`autorizada_por` integer,
	`motivo_excepcion` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`clase_original_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`clase_recuperacion_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`autorizada_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_posposicion_clase` ON `posposiciones` (`clase_original_id`);--> statement-breakpoint
CREATE INDEX `ix_posposiciones_recuperacion` ON `posposiciones` (`clase_recuperacion_id`);