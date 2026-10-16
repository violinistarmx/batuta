-- Avisos internos de la dirección a los maestros. Un renglón por destinatario;
-- `leido_en` nulo significa que el maestro todavía no lo ha leído.
CREATE TABLE avisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remitente_id INTEGER NOT NULL REFERENCES usuarios(id),
  destinatario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asunto TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  creado_en INTEGER NOT NULL DEFAULT (unixepoch()),
  leido_en INTEGER
);--> statement-breakpoint

CREATE INDEX ix_avisos_destinatario ON avisos (destinatario_id, leido_en);
