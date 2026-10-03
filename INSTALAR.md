# Instalar Batuta en tu computadora

Guía para dejar el sistema funcionando desde cero. No hace falta saber programar,
pero sí escribir unas cuantas líneas en una ventana negra. Son diez minutos.

Si algo no sale, no sigas adelante: cada paso depende del anterior.

---

## 1. Instalar Node.js

Batuta necesita **Node.js versión 22 o superior**. Es el motor que lo hace correr.

Descárgalo de **https://nodejs.org** — el botón que dice **LTS**. Instálalo como
cualquier programa, dándole siguiente a todo.

Para comprobar que quedó, abre una terminal:

- **Windows:** tecla Windows, escribe `powershell`, Enter.
- **Mac:** Cmd + Espacio, escribe `terminal`, Enter.

Y escribe:

```bash
node --version
```

Tiene que responder `v22.` o más alto. Si dice «no se reconoce el comando», cierra
la terminal, ábrela de nuevo y vuelve a probar.

---

## 2. Descomprimir el proyecto

Descomprime `batuta.tar.gz` donde quieras tenerlo. Te recomiendo una carpeta sin
espacios ni acentos en la ruta, por ejemplo `C:\batuta` o `~/batuta`.

Luego, en la terminal, entra a esa carpeta:

```bash
cd C:\batuta          # Windows
cd ~/batuta           # Mac
```

Sabrás que estás en el lugar correcto si `dir` (Windows) o `ls` (Mac) te muestra
`package.json`.

---

## 3. Instalar las piezas

```bash
npm install
```

Tarda unos minutos la primera vez. Descarga las librerías que usa el sistema.

> Si falla mencionando `better-sqlite3`, `node-gyp` o un compilador: en **Windows**
> instala «Desktop development with C++» desde el Visual Studio Installer; en
> **Mac** ejecuta `xcode-select --install`. Esa librería se compila en tu máquina
> a propósito, porque es la que guarda toda la información de la academia.

---

## 4. Crear el archivo de configuración

Copia la plantilla:

```bash
cp .env.example .env          # Mac
copy .env.example .env        # Windows
```

Ahora hacen falta **dos llaves**. Genéralas tú; no deben venir de nadie más, ni de
mí, ni de un correo:

```bash
node -e "console.log('LLAVE_DATOS_SENSIBLES=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

Abre `.env` con el Bloc de notas (o TextEdit) y pega cada resultado en su renglón,
sustituyendo el que está vacío. Deben quedar así, con la llave pegada después del
`=` y sin espacios:

```
LLAVE_DATOS_SENSIBLES=a1b2c3...
AUTH_SECRET=XyZ123...
```

Añade también esta línea, que es la dirección que va dentro del QR de cada alumno:

```
URL_PUBLICA=http://localhost:3000
```

> ### Esto es lo más importante de toda la guía
>
> **`LLAVE_DATOS_SENSIBLES` cifra los datos de salud de los alumnos.** Si la
> pierdes, esos datos son irrecuperables: no hay forma de sacarlos, ni yo ni nadie.
> Guárdala **fuera** de la computadora donde corre el sistema — en un papel en la
> caja fuerte, o en tu gestor de contraseñas. No en el escritorio, no en WhatsApp.
>
> El archivo `.env` no se comparte nunca. No se manda por correo, no se sube a
> ningún lado.

---

## 5. Preparar la base de datos

```bash
npm run preparar
```

Esto crea la base y siembra el catálogo: los programas con sus precios (Allegro
Andante $750, Allegro Virtuoso $1,500, los planes familiares…), los instrumentos,
los cubículos, las plantillas de mensajes y los parámetros del contrato con su
cláusula de origen.

Debe terminar diciendo `Semillas aplicadas:` y una lista de números.

---

## 6. Crear tu cuenta de director

```bash
npm run usuario -- --email juan@violinistar.mx --nombre "Juan Ángel Monzalvo Cervantes" --rol director
```

Te va a imprimir una contraseña **una sola vez**. Anótala antes de cerrar la
ventana: no se vuelve a mostrar, porque la base solo guarda su huella, no la
contraseña.

No te preocupes si se te pierde — el sistema te deja generar otra desde la
pantalla de cuentas, con cualquier sesión de director abierta.

---

## 7. Arrancar

```bash
npm run dev
```

Cuando diga `Ready`, abre el navegador en **http://localhost:3000** y entra con
ese correo y esa contraseña.

**Lo primero que va a pedirte es cambiar la contraseña, y no te va a dejar hacer
nada más hasta que lo hagas.** Es a propósito: la que te dio el sistema pasó por
una terminal y un papel, y mientras eso sea cierto la bitácora no puede responder
quién hizo qué.

Para apagarlo, vuelve a la terminal y presiona `Ctrl + C`.

---

## Cada vez que quieras usarlo

Solo los dos últimos pasos:

```bash
cd C:\batuta
npm run dev
```

---

## Respaldos: léelo antes de capturar al primer alumno

```bash
npm run respaldo
```

Crea una copia de la base **y del almacén** de documentos, y **la verifica antes de
darla por buena**. Un respaldo que nadie ha abierto es una hipótesis, no un
respaldo.

Se guarda en la carpeta `respaldos/`. **Cópiala a otro disco o a la nube**: un
respaldo que vive en la misma computadora que la base no te sirve el día que se
descomponga esa computadora, que es el único día en que ibas a necesitarlo.

Para restaurar:

```bash
npm run restaurar
```

Comprueba el hash y la integridad antes de tocar nada, y te va a decir en
mayúsculas que **reinicies la aplicación** cuando termine. Hazlo: si no, sigues
viendo la base anterior aunque la pantalla parezca normal.

---

## Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Arranca el sistema |
| `npm run usuario` | Da de alta una cuenta desde la terminal |
| `npm run respaldo` | Respalda y verifica la copia |
| `npm run restaurar` | Restaura un respaldo comprobado |
| `npm test` | Corre las 325 pruebas de las reglas |
| `npm run verify` | Intenta violar las garantías contra tu base real |
| `npm run limpiar:alumnos` | Borra los alumnos de prueba (**solo mientras pruebas**) |

---

## Ponerlo en un servidor de verdad

Cuando quieras que la academia entre desde varias computadoras y desde los
teléfonos, el proyecto ya trae `Dockerfile` y `docker-compose.yml`. Tres cosas que
cambian respecto de tu computadora:

1. **`URL_PUBLICA` deja de ser `localhost`** y pasa a ser la dirección real. El QR
   de la credencial la lleva dentro: con `localhost`, el teléfono del alumno no
   llega a ningún lado.
2. **Hace falta HTTPS.** La cookie de sesión se marca `Secure` en producción y sin
   certificado no viaja.
3. **La base y el almacén van en volúmenes**, que es lo que `docker-compose.yml` ya
   hace. Son las dos únicas cosas que hay que respaldar.

Prepara la base con los pasos 4 a 6 de esta guía **antes** de levantar el
contenedor: la imagen de producción no trae las herramientas de migración, así que
espera encontrarse la base ya hecha.

---

## Qué NO se comparte nunca

- `.env` — lleva las llaves.
- `data/` — la base con los expedientes.
- `almacen/` — contratos, identificaciones, planeaciones, recibos.
- `respaldos/` — todo lo anterior, junto.
- Las carpetas `*.reemplazado-*` que aparta el script de restauración.

Todas están en `.gitignore`, así que no se van a colar solas. Pero si algún día
copias la carpeta a un USB para llevarla a otro lado, ahí sí van incluidas: son
datos personales de menores de edad.
