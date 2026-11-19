-- Reversa de 0023_responsable_pago. Ejecutar a mano con sqlite3 sobre una COPIA de la
-- base y después quitar la entrada 23 de drizzle/meta/_journal.json y la fila
-- correspondiente de __drizzle_migrations.
--
-- ANTES: si hay planes con cuenta de pago, sus cargos viven en la cuenta del responsable.
-- Reasignarlos al alumno titular (primer UPDATE) para que sigan visibles en un expediente.
-- Después se borran las cuentas sin inscripciones (segundo DELETE; sus cargos ya se movieron).

UPDATE cargos
   SET alumno_id = (SELECT i.alumno_id FROM inscripciones i WHERE i.id = cargos.inscripcion_id)
 WHERE alumno_id IN (SELECT id FROM alumnos WHERE solo_responsable = 1)
   AND inscripcion_id IS NOT NULL;

DROP INDEX IF EXISTS ix_inscripciones_cuenta_pago;
ALTER TABLE tutores DROP COLUMN cuenta_alumno_id;
ALTER TABLE inscripciones DROP COLUMN cuenta_pago_id;

DELETE FROM alumnos WHERE solo_responsable = 1
   AND id NOT IN (SELECT alumno_id FROM cargos)
   AND id NOT IN (SELECT alumno_id FROM pagos);
ALTER TABLE alumnos DROP COLUMN solo_responsable;
