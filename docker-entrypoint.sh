#!/bin/sh
# Arranque de Batuta en contenedor.
#
# Hace tres cosas antes de ceder el control al servidor de Next:
#   1. Devuelve la propiedad de los volumenes al usuario sin privilegios.
#   2. Aplica las migraciones pendientes.
#   3. Aplica las semillas (es idempotente: no duplica nada).
#
# El orden importa. Railway y Docker montan los volumenes como root; si la base
# se crea con ese dueno, el usuario `batuta` no puede escribir despues y la app
# arranca pero falla en la primera consulta de escritura.
set -e

RUTA_BASE="${DATABASE_URL:-/app/data/batuta.db}"
DIR_BASE="$(dirname "$RUTA_BASE")"
DIR_ALMACEN="${ALMACEN_DIR:-/app/almacen}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DIR_BASE" "$DIR_ALMACEN"
  chown -R batuta:batuta "$DIR_BASE" "$DIR_ALMACEN"
  # Reejecuta este mismo script ya sin privilegios.
  exec gosu batuta "$0" "$@"
fi

echo "==> Aplicando migraciones en $RUTA_BASE"
npm run --silent db:migrate

echo "==> Aplicando semillas"
npm run --silent db:seed

# Alta del primer director. Solo corre si se definieron las dos variables; el
# script de alta ya se niega a duplicar un correo existente, asi que en los
# arranques siguientes no hace nada. La contrasena generada se imprime una vez
# en estos logs: hay que leerla ahi y cambiarla al primer acceso.
if [ -n "$DIRECTOR_EMAIL" ] && [ -n "$DIRECTOR_NOMBRE" ]; then
  echo "==> Verificando usuario director ($DIRECTOR_EMAIL)"
  npm run --silent usuario -- --email "$DIRECTOR_EMAIL" --nombre "$DIRECTOR_NOMBRE" --rol director || true
fi

echo "==> Iniciando Batuta en el puerto ${PORT:-3000}"
exec "$@"
