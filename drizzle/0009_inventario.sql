CREATE TABLE `ejemplares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo` text NOT NULL,
	`instrumento_id` integer NOT NULL,
	`marca` text,
	`modelo` text,
	`numero_serie` text,
	`medida` text,
	`estado` text DEFAULT 'disponible' NOT NULL,
	`condicion` text DEFAULT 'bueno' NOT NULL,
	`ubicacion` text,
	`valor_centavos` integer,
	`adquirido_el` text,
	`notas` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`instrumento_id`) REFERENCES `instrumentos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_ejemplares_codigo` ON `ejemplares` (`codigo`);--> statement-breakpoint
CREATE INDEX `ix_ejemplares_instrumento` ON `ejemplares` (`instrumento_id`,`estado`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_ejemplares_serie` ON `ejemplares` (`numero_serie`) WHERE numero_serie IS NOT NULL;--> statement-breakpoint
CREATE TABLE `prestamos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ejemplar_id` integer NOT NULL,
	`alumno_id` integer NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`ciclo_id` integer NOT NULL,
	`entregado_el` text NOT NULL,
	`entregado_por` integer,
	`condicion_salida` text NOT NULL,
	`responsiva_firmada` integer DEFAULT false NOT NULL,
	`devuelto_el` text,
	`recibido_por` integer,
	`condicion_regreso` text,
	`incidencia` text,
	`incidencia_nota` text,
	`notas` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ejemplar_id`) REFERENCES `ejemplares`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entregado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recibido_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_prestamo_devolucion_completa" CHECK(devuelto_el IS NULL OR (condicion_regreso IS NOT NULL AND incidencia IS NOT NULL)),
	CONSTRAINT "ck_prestamo_incidencia_con_nota" CHECK(incidencia IS NULL OR incidencia = 'ninguna' OR incidencia_nota IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `ix_prestamos_alumno` ON `prestamos` (`alumno_id`);--> statement-breakpoint
CREATE INDEX `ix_prestamos_ciclo` ON `prestamos` (`ciclo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_prestamo_abierto` ON `prestamos` (`ejemplar_id`) WHERE devuelto_el IS NULL;