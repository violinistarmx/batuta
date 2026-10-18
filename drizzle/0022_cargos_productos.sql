-- Productos de la academia: catálogo con costo y precio, cargos de producto con
-- sede y costo congelado, y vales de entrega con QR.
-- La reversa está en drizzle/reversas/0022_cargos_productos.down.sql.

CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otro'
    CHECK (categoria IN ('metodo', 'instrumento', 'accesorio', 'papeleria', 'otro')),
  descripcion TEXT,
  costo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (costo_centavos >= 0),
  precio_centavos INTEGER NOT NULL CHECK (precio_centavos > 0),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_por INTEGER REFERENCES usuarios(id),
  creado_en INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint
CREATE UNIQUE INDEX ux_productos_nombre ON productos (nombre);--> statement-breakpoint
CREATE UNIQUE INDEX ux_productos_codigo ON productos (codigo) WHERE codigo IS NOT NULL;--> statement-breakpoint

-- Cargos de producto: sede donde se vende, producto del catálogo (NULL = concepto
-- libre) y costo congelado al venderlo (NULL = sin costo registrado).
ALTER TABLE cargos ADD COLUMN sede_id INTEGER REFERENCES sedes(id);--> statement-breakpoint
ALTER TABLE cargos ADD COLUMN producto_id INTEGER REFERENCES productos(id);--> statement-breakpoint
ALTER TABLE cargos ADD COLUMN costo_centavos INTEGER CHECK (costo_centavos IS NULL OR costo_centavos >= 0);--> statement-breakpoint
CREATE INDEX ix_cargos_producto ON cargos (producto_id) WHERE producto_id IS NOT NULL;--> statement-breakpoint

CREATE TABLE vales_entrega (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL,
  token TEXT NOT NULL,
  cargo_id INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'entregado')),
  creado_en INTEGER NOT NULL DEFAULT (unixepoch()),
  entregado_en INTEGER,
  entregado_por INTEGER REFERENCES usuarios(id),
  excepcion_motivo TEXT,
  autorizado_por INTEGER REFERENCES usuarios(id),
  -- Un vale está entregado si y solo si dice cuándo y quién.
  CONSTRAINT ck_vale_entrega CHECK (
    (estado = 'entregado') = (entregado_en IS NOT NULL AND entregado_por IS NOT NULL)
  )
);--> statement-breakpoint
CREATE UNIQUE INDEX ux_vales_codigo ON vales_entrega (codigo);--> statement-breakpoint
CREATE UNIQUE INDEX ux_vales_token ON vales_entrega (token);--> statement-breakpoint
CREATE UNIQUE INDEX ux_vales_cargo ON vales_entrega (cargo_id);--> statement-breakpoint
CREATE INDEX ix_vales_estado ON vales_entrega (estado);
