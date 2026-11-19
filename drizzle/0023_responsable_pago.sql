-- Responsable de pago del plan familiar. El titular de un plan es el adulto que paga, no un
-- menor: puede ser un alumno adulto (la abuela) o un tutor que no toma clases (la mamá).
-- La reversa está en drizzle/reversas/0023_responsable_pago.down.sql.

-- Cuenta de pago: un adulto que paga pero no toma clases. Vive en `alumnos` porque la
-- cobranza (cargos, pagos, recibos) cuelga de ahí; esta marca la oculta de la lista de
-- alumnos y de los conteos. Sin inscripciones propias.
ALTER TABLE alumnos ADD COLUMN solo_responsable INTEGER NOT NULL DEFAULT 0;--> statement-breakpoint

-- A qué cuenta se le carga el plan, en la inscripción titular. NULL = su propio alumno
-- (individuales, planes de un adulto y todo lo anterior a esta migración).
ALTER TABLE inscripciones ADD COLUMN cuenta_pago_id INTEGER REFERENCES alumnos(id);--> statement-breakpoint
CREATE INDEX ix_inscripciones_cuenta_pago ON inscripciones (cuenta_pago_id) WHERE cuenta_pago_id IS NOT NULL;--> statement-breakpoint

-- La cuenta que ya se le abrió a un tutor, para no crearle otra en su siguiente plan.
ALTER TABLE tutores ADD COLUMN cuenta_alumno_id INTEGER REFERENCES alumnos(id);
