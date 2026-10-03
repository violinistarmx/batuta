CREATE TABLE `aplicaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pago_id` integer NOT NULL,
	`cargo_id` integer NOT NULL,
	`monto_centavos` integer NOT NULL,
	FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cargo_id`) REFERENCES `cargos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_aplicaciones_pago` ON `aplicaciones` (`pago_id`);--> statement-breakpoint
CREATE INDEX `ix_aplicaciones_cargo` ON `aplicaciones` (`cargo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_aplicacion_pago_cargo` ON `aplicaciones` (`pago_id`,`cargo_id`);--> statement-breakpoint
CREATE TABLE `cargos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alumno_id` integer NOT NULL,
	`inscripcion_id` integer,
	`ciclo_id` integer,
	`concepto` text NOT NULL,
	`descripcion` text NOT NULL,
	`periodo` text,
	`monto_centavos` integer NOT NULL,
	`vence_el` text NOT NULL,
	`cancelado` integer DEFAULT false NOT NULL,
	`motivo_cancelacion` text,
	`creado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_cargos_alumno` ON `cargos` (`alumno_id`,`vence_el`);--> statement-breakpoint
CREATE INDEX `ix_cargos_ciclo` ON `cargos` (`ciclo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_cargo_mensualidad_ciclo` ON `cargos` (`ciclo_id`) WHERE concepto = 'mensualidad' AND ciclo_id IS NOT NULL AND cancelado = 0;--> statement-breakpoint
CREATE TABLE `gastos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`categoria` text NOT NULL,
	`concepto` text NOT NULL,
	`monto_centavos` integer NOT NULL,
	`fecha` text NOT NULL,
	`registrado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_gastos_fecha` ON `gastos` (`fecha`);--> statement-breakpoint
CREATE TABLE `nomina_pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`docente_id` integer NOT NULL,
	`desde_el` text NOT NULL,
	`hasta_el` text NOT NULL,
	`total_centavos` integer NOT NULL,
	`clases` integer NOT NULL,
	`metodo` text DEFAULT 'transferencia' NOT NULL,
	`pagado_el` text NOT NULL,
	`nota` text,
	`registrado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`docente_id`) REFERENCES `docentes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_nomina_pagos_docente` ON `nomina_pagos` (`docente_id`,`pagado_el`);--> statement-breakpoint
CREATE TABLE `nomina_partidas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clase_id` integer NOT NULL,
	`docente_id` integer NOT NULL,
	`minutos` integer NOT NULL,
	`estado_clase` text NOT NULL,
	`tarifa_hora_centavos` integer NOT NULL,
	`factor` text NOT NULL,
	`importe_centavos` integer NOT NULL,
	`nomina_id` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`docente_id`) REFERENCES `docentes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_nomina_clase` ON `nomina_partidas` (`clase_id`);--> statement-breakpoint
CREATE INDEX `ix_nomina_docente` ON `nomina_partidas` (`docente_id`,`nomina_id`);--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alumno_id` integer NOT NULL,
	`monto_centavos` integer NOT NULL,
	`metodo` text NOT NULL,
	`recibido_el` text NOT NULL,
	`referencia` text,
	`nota` text,
	`registrado_por` integer,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_pagos_alumno` ON `pagos` (`alumno_id`,`recibido_el`);--> statement-breakpoint
CREATE TABLE `recibos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`folio` text NOT NULL,
	`pago_id` integer NOT NULL,
	`alumno_id` integer NOT NULL,
	`emitido_por` integer,
	`emitido_en` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`alumno_id`) REFERENCES `alumnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`emitido_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_recibos_folio` ON `recibos` (`folio`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_recibos_pago` ON `recibos` (`pago_id`);