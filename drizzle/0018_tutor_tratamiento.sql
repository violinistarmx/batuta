-- Tratamiento del tutor para los saludos: "Sr.", "Sra." o nulo (sin especificar).
-- No se deriva del nombre: se captura en la ficha del alumno.
ALTER TABLE tutores ADD COLUMN tratamiento TEXT;
