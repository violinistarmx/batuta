-- Comprobante de pago: lo que la nueva plantilla pide y el sistema no tenía.
-- La reversa está en drizzle/reversas/0024_comprobante_pago.down.sql.

-- Fechas y horarios de las clases que cubre el pago, una por línea
-- («Sábado 21 de noviembre 11:00 am a 1:00 pm»). Texto libre: lo escribe o corrige quien cobra.
ALTER TABLE pagos ADD COLUMN clases_texto TEXT;--> statement-breakpoint

-- Si el comprobante lleva el sello «Pago registrado». Por defecto sí.
ALTER TABLE pagos ADD COLUMN sello_pago INTEGER NOT NULL DEFAULT 1;
