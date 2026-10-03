CREATE TABLE `documentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alumno_id` integer,
	`inscripcion_id` integer,
	`clase_id` integer,
	`categoria` text NOT NULL,
	`nombre_original` text NOT NULL,
	`ruta` text NOT NULL,
	`tipo_mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`hash_sha256` text NOT NULL,
	`subido_por` integer,
	`subido_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subido_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_documentos_alumno` ON `documentos` (`alumno_id`,`categoria`);--> statement-breakpoint
CREATE INDEX `ix_documentos_clase` ON `documentos` (`clase_id`);--> statement-breakpoint
CREATE TABLE `planeaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clase_id` integer NOT NULL,
	`docente_id` integer NOT NULL,
	`documento_id` integer,
	`objetivos` text,
	`temas` text,
	`evaluacion` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	`actualizado_en` integer,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`docente_id`) REFERENCES `docentes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_planeacion_clase` ON `planeaciones` (`clase_id`);--> statement-breakpoint
CREATE INDEX `ix_planeaciones_docente` ON `planeaciones` (`docente_id`);--> statement-breakpoint
CREATE TABLE `progreso` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`clase_id` integer,
	`ciclo_id` integer,
	`fecha` text NOT NULL,
	`valoracion` text,
	`notas` text NOT NULL,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_progreso_inscripcion` ON `progreso` (`inscripcion_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `tareas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`clase_id` integer,
	`descripcion` text NOT NULL,
	`repertorio` text,
	`fecha_revision` text,
	`completada_en` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_tareas_inscripcion` ON `tareas` (`inscripcion_id`);--> statement-breakpoint
CREATE INDEX `ix_tareas_clase` ON `tareas` (`clase_id`);