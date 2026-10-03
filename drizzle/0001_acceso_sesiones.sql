CREATE TABLE `intentos_login` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`ip` text,
	`exito` integer NOT NULL,
	`motivo` text,
	`creado_en` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_intentos_email_fecha` ON `intentos_login` (`email`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ix_intentos_ip_fecha` ON `intentos_login` (`ip`,`creado_en`);--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`usuario_id` integer NOT NULL,
	`creada_en` integer DEFAULT (unixepoch()) NOT NULL,
	`ultima_actividad_en` integer DEFAULT (unixepoch()) NOT NULL,
	`expira_en` integer NOT NULL,
	`revocada_en` integer,
	`ip` text,
	`navegador` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_sesiones_token` ON `sesiones` (`token_hash`);--> statement-breakpoint
CREATE INDEX `ix_sesiones_usuario` ON `sesiones` (`usuario_id`);--> statement-breakpoint
CREATE INDEX `ix_sesiones_expira` ON `sesiones` (`expira_en`);