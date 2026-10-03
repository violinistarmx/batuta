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
RUN useradd --system --uid 1001 batuta

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/node_modules/bindings ./node_modules/bindings
COPY --from=build /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# La base y el almacen viven en volumenes: el contenedor es desechable, los datos no.
RUN mkdir -p /app/data /app/almacen && chown -R batuta:batuta /app/data /app/almacen
USER batuta

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
