-- Finanzas: sedes, categorías de gasto editables, tarifas de maestro con vigencia
-- y origen del alumno. La reversa está en drizzle/reversas/0021_finanzas_dashboard.down.sql.

-- ── Sedes ─────────────────────────────────────────────────────────────────────
CREATE TABLE sedes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);--> statement-breakpoint
CREATE UNIQUE INDEX ux_sedes_nombre ON sedes (nombre);--> statement-breakpoint
INSERT INTO sedes (nombre, orden) VALUES
  ('Mineral de la Reforma', 0), ('Hueypoxtla', 1), ('Real del Monte', 2);--> statement-breakpoint

-- La sede sale del aula de la clase. Las aulas actuales están en la sede principal;
-- las de Hueypoxtla y Real del Monte se corrigen desde Catálogo.
ALTER TABLE aulas ADD COLUMN sede_id INTEGER REFERENCES sedes(id);--> statement-breakpoint
UPDATE aulas SET sede_id = (SELECT id FROM sedes WHERE nombre = 'Mineral de la Reforma');--> statement-breakpoint

-- ── Categorías de gasto ───────────────────────────────────────────────────────
CREATE TABLE categorias_gasto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL,
  tipo_sugerido TEXT NOT NULL DEFAULT 'variable',
  orden INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  -- Clave fija para las categorías que el sistema necesita reconocer aunque se
  -- renombren: 'publicidad' alimenta el CAC. NULL en las demás.
  clave TEXT
);--> statement-breakpoint
CREATE UNIQUE INDEX ux_categorias_gasto_clave ON categorias_gasto (clave) WHERE clave IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX ux_categorias_gasto_nombre ON categorias_gasto (nombre);--> statement-breakpoint
INSERT INTO categorias_gasto (nombre, color, tipo_sugerido, orden) VALUES
  ('Arrendamiento', '#6366f1', 'fijo', 0),
  ('Servicios', '#06b6d4', 'fijo', 1),
  ('Honorarios docentes', '#8b5cf6', 'variable', 2),
  ('Materiales educativos', '#10b981', 'variable', 3),
  ('Publicidad y marketing', '#f27405', 'variable', 4),
  ('Software/plataformas', '#0ea5e9', 'fijo', 5),
  ('Comisiones y tarifas', '#14b8a6', 'variable', 6),
  ('Administración', '#a855f7', 'fijo', 7),
  ('Gastos de oficina', '#84cc16', 'variable', 8),
  ('Otros', '#94a3b8', 'variable', 9);--> statement-breakpoint
UPDATE categorias_gasto SET clave = 'publicidad' WHERE nombre = 'Publicidad y marketing';--> statement-breakpoint
UPDATE categorias_gasto SET clave = 'honorarios_docentes' WHERE nombre = 'Honorarios docentes';--> statement-breakpoint

-- ── Gastos: nuevas columnas ───────────────────────────────────────────────────
-- `categoria` (texto fijo) se conserva para poder revertir; la fuente es categoria_id.
ALTER TABLE gastos ADD COLUMN categoria_id INTEGER REFERENCES categorias_gasto(id);--> statement-breakpoint
ALTER TABLE gastos ADD COLUMN subcategoria TEXT;--> statement-breakpoint
ALTER TABLE gastos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'variable';--> statement-breakpoint
ALTER TABLE gastos ADD COLUMN sede_id INTEGER REFERENCES sedes(id);--> statement-breakpoint
ALTER TABLE gastos ADD COLUMN programa_id INTEGER REFERENCES programas(id);--> statement-breakpoint

UPDATE gastos SET categoria_id = (SELECT id FROM categorias_gasto WHERE nombre = CASE gastos.categoria
    WHEN 'renta' THEN 'Arrendamiento'
    WHEN 'servicios' THEN 'Servicios'
    WHEN 'instrumentos' THEN 'Materiales educativos'
    WHEN 'material' THEN 'Materiales educativos'
    WHEN 'mantenimiento' THEN 'Gastos de oficina'
    WHEN 'publicidad' THEN 'Publicidad y marketing'
    ELSE 'Otros' END);--> statement-breakpoint
UPDATE gastos SET subcategoria = CASE categoria
    WHEN 'instrumentos' THEN 'Instrumentos'
    WHEN 'material' THEN 'Material'
    WHEN 'mantenimiento' THEN 'Mantenimiento'
    ELSE NULL END;--> statement-breakpoint
UPDATE gastos SET tipo = (SELECT tipo_sugerido FROM categorias_gasto WHERE id = gastos.categoria_id);--> statement-breakpoint
CREATE INDEX ix_gastos_categoria ON gastos (categoria_id, fecha);--> statement-breakpoint

-- ── Tarifas de maestro con vigencia ───────────────────────────────────────────
-- Fuente única de la tarifa propia del maestro: la usan la nómina y el dashboard.
CREATE TABLE tarifas_docente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  docente_id INTEGER NOT NULL REFERENCES docentes(id),
  tarifa_hora_centavos INTEGER NOT NULL,
  vigente_desde TEXT NOT NULL,
  vigente_hasta TEXT,
  creado_por INTEGER REFERENCES usuarios(id),
  creado_en INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint
CREATE INDEX ix_tarifas_docente ON tarifas_docente (docente_id, vigente_desde);--> statement-breakpoint
CREATE UNIQUE INDEX ux_tarifa_docente_abierta ON tarifas_docente (docente_id) WHERE vigente_hasta IS NULL;--> statement-breakpoint
-- Las tarifas propias que ya existían valen desde siempre: así el pasado no cambia.
INSERT INTO tarifas_docente (docente_id, tarifa_hora_centavos, vigente_desde)
  SELECT id, tarifa_hora_centavos, '2000-01-01' FROM docentes WHERE tarifa_hora_centavos IS NOT NULL;--> statement-breakpoint

-- ── Origen del alumno ─────────────────────────────────────────────────────────
ALTER TABLE alumnos ADD COLUMN origen TEXT;--> statement-breakpoint
UPDATE alumnos SET origen = (SELECT p.origen FROM prospectos p WHERE p.alumno_id = alumnos.id)
  WHERE EXISTS (SELECT 1 FROM prospectos p WHERE p.alumno_id = alumnos.id);--> statement-breakpoint

-- ── Diseño del dashboard por usuario ──────────────────────────────────────────
-- Qué gráficas ve, dónde, de qué tamaño, de qué tipo y con qué paleta (JSON).
CREATE TABLE paneles_finanzas (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  diseno TEXT NOT NULL,
  actualizado_en INTEGER NOT NULL DEFAULT (unixepoch())
);
