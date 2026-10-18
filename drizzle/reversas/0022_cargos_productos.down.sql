-- Reversa de 0022_cargos_productos. Ejecutar a mano con sqlite3 sobre una COPIA de la
-- base y después quitar la entrada 22 de drizzle/meta/_journal.json y la fila
-- correspondiente de __drizzle_migrations.
--
-- Pierde: el catálogo de productos, los vales de entrega y, en los cargos, la sede, el
-- producto y el costo congelado. Antes borra los cargos de producto (concepto
-- 'producto'), porque sin esta migración el concepto no existe y quedarían huérfanos;
-- los pagos aplicados a ellos se conservan como saldo a favor al quitar sus aplicaciones.

DROP TABLE IF EXISTS vales_entrega;

DELETE FROM aplicaciones WHERE cargo_id IN (SELECT id FROM cargos WHERE concepto = 'producto');
DELETE FROM cargos WHERE concepto = 'producto';

DROP INDEX IF EXISTS ix_cargos_producto;
ALTER TABLE cargos DROP COLUMN costo_centavos;
ALTER TABLE cargos DROP COLUMN producto_id;
ALTER TABLE cargos DROP COLUMN sede_id;

DROP INDEX IF EXISTS ux_productos_codigo;
DROP INDEX IF EXISTS ux_productos_nombre;
DROP TABLE IF EXISTS productos;

DELETE FROM secuencias WHERE clave LIKE 'vale:%';
