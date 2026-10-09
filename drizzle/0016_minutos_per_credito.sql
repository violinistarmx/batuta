-- Cuántos minutos de clase equivalen a 1 crédito en este programa.
-- Por defecto 60 (una clase de 60 min = 1 crédito, una de 120 min = 2).
-- Permite que programas como Dibujo (sesión de 90 min) consuman 1 crédito
-- sin afectar la regla general de los demás programas.
ALTER TABLE programas ADD COLUMN minutos_per_credito INTEGER NOT NULL DEFAULT 60;
