-- Varios roles por cuenta. El rol principal sigue en usuarios.rol_id; esta tabla
-- guarda solo los roles adicionales. Los permisos efectivos son la unión de todos.
CREATE TABLE usuarios_roles (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, rol_id)
);--> statement-breakpoint

-- Rol "Administradora": administración de alumnos e inscripciones. No incluye
-- alumnos.descartar (borra expedientes), ni usuarios, ni finanzas.
INSERT OR IGNORE INTO roles (clave, nombre) VALUES ('administradora', 'Administradora');--> statement-breakpoint

INSERT OR IGNORE INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.clave = 'administradora'
  AND p.clave IN (
    'alumnos.leer', 'alumnos.crear', 'alumnos.editar',
    'inscripciones.leer', 'inscripciones.crear'
  );
