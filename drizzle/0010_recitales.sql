CREATE TABLE `boletos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recital_id` integer NOT NULL,
	`folio` text NOT NULL,
	`cantidad` integer NOT NULL,
	`precio_unitario_centavos` integer NOT NULL,
	`total_centavos` integer NOT NULL,
	`comprador_nombre` text NOT NULL,
	`comprador_telefono` text,
	`alumno_id` integer,
	`metodo` text DEFAULT 'efectivo' NOT NULL,
	`vendido_el` text NOT NULL,
	`vendido_por` integer,
	`cancelado` integer DEFAULT false NOT NULL,
	`motivo_cancelacion` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`recital_id`) REFERENCES `recitales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendido_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_boleto_cantidad" CHECK(cantidad > 0),
	CONSTRAINT "ck_boleto_total_cuadra" CHECK(total_centavos = cantidad * precio_unitario_centavos),
	CONSTRAINT "ck_boleto_cancelacion_con_motivo" CHECK(cancelado = 0 OR motivo_cancelacion IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_boletos_folio` ON `boletos` (`folio`);--> statement-breakpoint
CREATE INDEX `ix_boletos_recital` ON `boletos` (`recital_id`,`cancelado`);--> statement-breakpoint
CREATE TABLE `participaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recital_id` integer NOT NULL,
	`alumno_id` integer NOT NULL,
	`inscripcion_id` integer NOT NULL,
	`docente_id` integer NOT NULL,
	`pieza` text NOT NULL,
	`compositor` text,
	`duracion_minutos` integer,
	`orden` integer,
	`estado` text DEFAULT 'propuesta' NOT NULL,
	`motivo_rechazo` text,
	`propuesta_por` integer,
	`propuesta_en` integer DEFAULT (unixepoch()) NOT NULL,
	`confirmada_por` integer,
	`confirmada_en` integer,
	`asistio` integer,
	`notas` text,
	FOREIGN KEY (`recital_id`) REFERENCES `recitales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`docente_id`) REFERENCES `docentes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`propuesta_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmada_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_participacion_rechazo_con_motivo" CHECK(estado <> 'rechazada' OR motivo_rechazo IS NOT NULL),
	CONSTRAINT "ck_participacion_confirmacion_completa" CHECK(estado <> 'confirmada' OR (confirmada_por IS NOT NULL AND confirmada_en IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `ix_participaciones_recital` ON `participaciones` (`recital_id`,`estado`);--> statement-breakpoint
CREATE INDEX `ix_participaciones_alumno` ON `participaciones` (`alumno_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_participacion_orden` ON `participaciones` (`recital_id`,`orden`) WHERE orden IS NOT NULL AND estado = 'confirmada';--> statement-breakpoint
CREATE TABLE `recitales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`fecha` text NOT NULL,
	`hora` text NOT NULL,
	`sede` text NOT NULL,
	`direccion_sede` text,
	`capacidad` integer,
	`precio_boleto_centavos` integer DEFAULT 0 NOT NULL,
	`estado` text DEFAULT 'planeado' NOT NULL,
	`notas` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_recital_precio_no_negativo" CHECK(precio_boleto_centavos >= 0),
	CONSTRAINT "ck_recital_capacidad" CHECK(capacidad IS NULL OR capacidad > 0)
);
--> statement-breakpoint
CREATE INDEX `ix_recitales_fecha` ON `recitales` (`fecha`);