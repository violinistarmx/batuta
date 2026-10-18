-- Reversa de 0021_finanzas_dashboard. Ejecutar a mano con sqlite3 sobre una COPIA
-- de la base y después quitar la entrada 21 de drizzle/meta/_journal.json y la fila
-- correspondiente de __drizzle_migrations.
--
-- Pierde: tarifas con vigencia registradas después de la migración (antes, copia la
-- vigente a docentes.tarifa_hora_centavos con el primer UPDATE), categorías nuevas,
-- sedes y el origen de los alumnos. Los gastos conservan su `categoria` original.

UPDATE docentes SET tarifa_hora_centavos = (
  SELECT td.tarifa_hora_centavos FROM tarifas_docente td
  WHERE td.docente_id = docentes.id AND td.vigente_hasta IS NULL
);

ALTER TABLE alumnos DROP COLUMN origen;

DROP INDEX IF EXISTS ux_tarifa_docente_abierta;
DROP INDEX IF EXISTS ix_tarifas_docente;
DROP TABLE tarifas_docente;

DROP INDEX IF EXISTS ix_gastos_categoria;
ALTER TABLE gastos DROP COLUMN programa_id;
ALTER TABLE gastos DROP COLUMN sede_id;
ALTER TABLE gastos DROP COLUMN tipo;
ALTER TABLE gastos DROP COLUMN subcategoria;
ALTER TABLE gastos DROP COLUMN categoria_id;
DROP INDEX IF EXISTS ux_categorias_gasto_nombre;
DROP INDEX IF EXISTS ux_categorias_gasto_clave;
DROP TABLE categorias_gasto;

ALTER TABLE aulas DROP COLUMN sede_id;
DROP INDEX IF EXISTS ux_sedes_nombre;
DROP TABLE sedes;
