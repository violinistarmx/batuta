ALTER TABLE `programas` ADD `alumnos_incluidos` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inscripciones` ADD `cubierta_por_id` integer;--> statement-breakpoint
CREATE INDEX `ix_inscripciones_cubierta` ON `inscripciones` (`cubierta_por_id`);