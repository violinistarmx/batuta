-- Reversa de 0024_comprobante_pago. Ejecutar a mano con sqlite3 sobre una COPIA de la
-- base y después quitar la entrada 24 de drizzle/meta/_journal.json y la fila
-- correspondiente de __drizzle_migrations.
--
-- Pierde: las fechas y horarios de clases escritos en cada comprobante y la marca del sello.

ALTER TABLE pagos DROP COLUMN sello_pago;
ALTER TABLE pagos DROP COLUMN clases_texto;
