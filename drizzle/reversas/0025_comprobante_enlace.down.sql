-- Reversa de 0025_comprobante_enlace. Ejecutar a mano con sqlite3 sobre una COPIA de la base y
-- después quitar la entrada 25 de drizzle/meta/_journal.json y la fila correspondiente de
-- __drizzle_migrations. Pierde: los enlaces ya compartidos por WhatsApp dejan de funcionar.

DROP INDEX IF EXISTS ux_recibos_token;
ALTER TABLE recibos DROP COLUMN token;
