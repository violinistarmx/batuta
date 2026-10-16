-- Un envío de avisos tiene un grupo que une sus renglones (uno por destinatario).
-- Los avisos anteriores quedan con grupo nulo y no tienen adjuntos.
ALTER TABLE avisos ADD COLUMN grupo TEXT;--> statement-breakpoint

CREATE INDEX ix_avisos_grupo ON avisos (grupo);--> statement-breakpoint

-- Adjuntos del envío. El archivo vive en el almacén; aquí solo su metadato.
CREATE TABLE avisos_adjuntos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo TEXT NOT NULL,
  nombre_original TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  hash_sha256 TEXT NOT NULL,
  ruta TEXT NOT NULL,
  subido_por INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

CREATE INDEX ix_avisos_adjuntos_grupo ON avisos_adjuntos (grupo);
