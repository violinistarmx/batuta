-- Tarifa de docente propia por programa.
-- NULL significa "usa la tarifa global del sistema".
ALTER TABLE `programas` ADD `tarifa_docente_hora_centavos` integer;
