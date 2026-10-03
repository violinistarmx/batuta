CREATE TABLE `mensajes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plantilla_id` integer,
	`alumno_id` integer,
	`prospecto_id` integer,
	`destinatario` text NOT NULL,
	`telefono` text,
	`canal` text DEFAULT 'whatsapp' NOT NULL,
	`asunto` text,
	`cuerpo` text NOT NULL,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`motivo_rechazo` text,
	`redactado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	`aprobado_por` integer,
	`aprobado_en` integer,
	`enviado_por` integer,
	`enviado_en` integer,
	`nota_envio` text,
	FOREIGN KEY (`plantilla_id`) REFERENCES `plantillas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prospecto_id`) REFERENCES `prospectos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`redactado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aprobado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enviado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_mensaje_aprobado_antes_de_enviar" CHECK(estado <> 'enviado' OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL)),
	CONSTRAINT "ck_mensaje_aprobacion_completa" CHECK(estado <> 'aprobado' OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL)),
	CONSTRAINT "ck_mensaje_rechazo_con_motivo" CHECK(estado <> 'rechazado' OR motivo_rechazo IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `ix_mensajes_estado` ON `mensajes` (`estado`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ix_mensajes_alumno` ON `mensajes` (`alumno_id`);--> statement-breakpoint
CREATE INDEX `ix_mensajes_prospecto` ON `mensajes` (`prospecto_id`);--> statement-breakpoint
CREATE TABLE `plantillas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clave` text NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text NOT NULL,
	`canal` text DEFAULT 'whatsapp' NOT NULL,
	`asunto` text,
	`cuerpo` text NOT NULL,
	`activa` integer DEFAULT true NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_plantillas_clave` ON `plantillas` (`clave`);