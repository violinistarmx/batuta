FROM node:22-slim AS base
ENV TZ=America/Mexico_City

# --- Dependencias -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
# better-sqlite3 se compila desde fuente: necesita toolchain en esta etapa nada mas.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# --- Compilacion ------------------------------------------------------------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Ejecucion --------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# gosu: el arranque necesita privilegios para ajustar el volumen y luego cederlos.
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 batuta

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle

# Migraciones y semillas corren en cada arranque con las herramientas del
# proyecto (tsx + drizzle-kit), no con un migrador propio: cualquier migrador
# paralelo se desincroniza del que se usa en desarrollo. Eso obliga a traer
# node_modules completo y src/, a cambio de que `db:migrate` y `db:seed` se
# comporten identico dentro y fuera del contenedor.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# La base y el almacen viven en volumenes: el contenedor es desechable, los datos no.
RUN mkdir -p /app/data /app/almacen && chown -R batuta:batuta /app/data /app/almacen

# Sin USER: el entrypoint arranca como root para ajustar la propiedad del
# volumen montado y despues baja a `batuta` con gosu. Si se fija USER aqui,
# el chown falla y la base queda sin permisos de escritura.
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
