CREATE TABLE `prospectos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`edad_aproximada` integer,
	`contacto_nombre` text,
	`contacto_parentesco` text,
	`telefono` text,
	`whatsapp` text,
	`email` text,
	`programa_interes_id` integer,
	`instrumento_interes_id` integer,
	`origen` text DEFAULT 'otro' NOT NULL,
	`origen_detalle` text,
	`estado` text DEFAULT 'nuevo' NOT NULL,
	`clase_muestra_el` text,
	`clase_muestra_hora` text,
	`clase_muestra_asistio` integer,
	`motivo_perdida` text,
	`motivo_detalle` text,
	`proximo_seguimiento_el` text,
	`asignado_a` integer,
	`alumno_id` integer,
	`convertido_en` integer,
	`notas` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	`actualizado_en` integer,
	FOREIGN KEY (`programa_interes_id`) REFERENCES `programas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrumento_interes_id`) REFERENCES `instrumentos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asignado_a`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_prospecto_convertido" CHECK(estado <> 'convertido' OR alumno_id IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `ix_prospectos_estado` ON `prospectos` (`estado`,`proximo_seguimiento_el`);--> statement-breakpoint
CREATE INDEX `ix_prospectos_origen` ON `prospectos` (`origen`);--> statement-breakpoint
CREATE INDEX `ix_prospectos_telefono` ON `prospectos` (`telefono`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_prospecto_alumno` ON `prospectos` (`alumno_id`) WHERE alumno_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `seguimientos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prospecto_id` integer NOT NULL,
	`fecha` text NOT NULL,
	`canal` text DEFAULT 'whatsapp' NOT NULL,
	`resultado` text DEFAULT 'contactado' NOT NULL,
	`nota` text,
	`registrado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prospecto_id`) REFERENCES `prospectos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_seguimientos_prospecto` ON `seguimientos` (`prospecto_id`,`fecha`);