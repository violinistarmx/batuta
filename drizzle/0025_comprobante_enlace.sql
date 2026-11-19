-- Enlace privado al PDF del comprobante: un token largo e imposible de adivinar por recibo.
-- Se crea al enviar el comprobante por primera vez (NULL = nunca se ha compartido).
-- La reversa está en drizzle/reversas/0025_comprobante_enlace.down.sql.

ALTER TABLE recibos ADD COLUMN token TEXT;--> statement-breakpoint
CREATE UNIQUE INDEX ux_recibos_token ON recibos (token) WHERE token IS NOT NULL;
