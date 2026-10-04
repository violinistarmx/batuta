# Despliegue de Batuta en Railway

Batuta guarda su base en un archivo SQLite y los documentos del expediente
(contratos, recibos, planeaciones, identificaciones) en un directorio en disco.
Eso descarta las plataformas *serverless* como Vercel, cuyo sistema de archivos
es efímero: la base desaparecería entre peticiones. Railway levanta el
contenedor del `Dockerfile` y le monta un volumen que sobrevive a los
redespliegues, que es exactamente lo que este diseño necesita.

## Antes de empezar

El repositorio ya trae todo lo necesario: `Dockerfile`, `docker-entrypoint.sh`
y `railway.json`. El arranque del contenedor aplica las migraciones, luego las
semillas y, si se le indica, da de alta al primer director. Las tres cosas son
idempotentes: repetirlas no duplica nada.

## 1. Crear el proyecto

1. Entra a [railway.com](https://railway.com) e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo → `violinistarmx/batuta`**.
3. Railway detecta el `Dockerfile` y arranca la primera compilación.

Esa primera compilación va a fallar o a arrancar sin datos persistentes. Es
esperado: falta el volumen y las variables. Continúa con los pasos siguientes.

## 2. Montar el volumen

En el servicio: **Settings → Volumes → New Volume**.

| Campo | Valor |
|---|---|
| Mount path | `/app/persistente` |

Un solo volumen alcanza. La base y el almacén viven en subdirectorios dentro de
él, y el arranque los crea si no existen. Conviene así porque el respaldo de un
solo directorio ya se lleva el expediente completo: respaldar nada más la base
dejaría fuera los contratos y recibos, que son la mitad del archivo.

## 3. Configurar las variables

En **Variables**, agrega lo siguiente. Los dos secretos están en el archivo
`SECRETOS-RAILWAY.txt` que quedó en la carpeta del proyecto en tu computadora.

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `/app/persistente/data/batuta.db` |
| `ALMACEN_DIR` | `/app/persistente/almacen` |
| `LLAVE_DATOS_SENSIBLES` | *(el del archivo de secretos)* |
| `AUTH_SECRET` | *(el del archivo de secretos)* |
| `TZ` | `America/Mexico_City` |
| `IA_HABILITADA` | `false` |
| `DIRECTOR_EMAIL` | tu correo, p. ej. `juanskzx@gmail.com` |
| `DIRECTOR_NOMBRE` | `Juan Ángel Monzalvo Cervantes` |

`URL_PUBLICA` se configura en el paso 4, cuando ya exista el dominio.

> **La llave de datos sensibles no se puede perder.** Cifra la tabla de salud de
> los alumnos. Si se extravía, esos datos son irrecuperables — ni Railway ni
> nadie puede descifrarlos. Guarda una copia fuera del servidor.

## 4. Generar el dominio

**Settings → Networking → Generate Domain**. Railway devuelve algo como
`batuta-production-xxxx.up.railway.app`.

Copia esa dirección y agrégala como variable:

| Variable | Valor |
|---|---|
| `URL_PUBLICA` | `https://batuta-production-xxxx.up.railway.app` |

No es opcional. El QR de la credencial del alumno lleva esta URL dentro: si se
genera con el host de una petición interna, el código apunta a una dirección que
el teléfono del alumno no alcanza.

Guardar la variable dispara un redespliegue. Deja que termine.

## 5. Leer la contraseña del director

Abre **Deployments → (el último) → View Logs**. Busca estas líneas:

```
==> Aplicando migraciones en /app/persistente/data/batuta.db
==> Aplicando semillas
==> Verificando usuario director (tu@correo.mx)
```

Debajo aparece la contraseña generada, **una sola vez**. Cópiala, entra al
sistema con tu correo y cámbiala de inmediato.

Si ya existe un usuario con ese correo, el alta no hace nada y no imprime
contraseña. Es el comportamiento correcto en los arranques siguientes.

## 6. Verificar

Abre la URL pública. Deberías llegar a la pantalla de acceso. Entra con tu
correo y la contraseña de los logs.

Para confirmar que el volumen quedó bien montado: redespliega el servicio
(**Deployments → Redeploy**) y vuelve a entrar. Si tus datos siguen ahí, la
persistencia funciona. Si te pide crear todo de nuevo, el volumen no está
montado en la ruta correcta — revisa el paso 2.

## Respaldos

El proyecto ya trae `scripts/respaldo.mjs`, que empaqueta la base y el almacén
juntos. En Railway conviene además activar los *backups* del volumen desde
**Settings → Volumes**, y bajar una copia propia cada tanto: un respaldo que
vive solo en la misma plataforma que los datos no es un respaldo.

## Costo

Railway cobra por uso con un plan Hobby de 5 USD al mes que incluye 5 USD de
consumo. Para una aplicación de este tamaño, con tres sedes y un puñado de
usuarios concurrentes, el consumo real se queda holgadamente dentro de ese
crédito. El volumen se cobra por gigabyte almacenado y la base de una academia
de este volumen pesa megabytes, no gigas.

## Si algo falla

La compilación y el arranque dejan rastro en **Deployments → View Logs**. Los
tres errores probables:

- **`better-sqlite3` no compila.** La etapa `deps` instala `python3`, `make` y
  `g++` precisamente para eso. Si falla, el log dirá qué herramienta falta.
- **`SQLITE_CANTOPEN` o permiso denegado.** El volumen no está en
  `/app/persistente`, o `DATABASE_URL` no apunta dentro de él.
- **Arranca pero da 500 al guardar.** Revisa que `ALMACEN_DIR` apunte dentro del
  volumen; si apunta al disco del contenedor, las escrituras se pierden.
