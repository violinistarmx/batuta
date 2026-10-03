# Batuta

Sistema de gestión de la **Academia de Música VioliniStar** — Pachuca de Soto, Hidalgo.

Alumnos, inscripciones, agenda, saldo de clases, planeaciones, cobranza, nómina docente,
alertas, reportes, prospectos y comunicación con aprobación previa, alineado cláusula por
cláusula al contrato de prestación de servicios de 2025.

---

## Estado

**Las nueve etapas del plan están terminadas**, más los planes familiares, la credencial
digital, el inventario con préstamo de instrumentos y los recitales. El sistema cobra,
comprueba, paga, avisa, vende, presta, programa recitales y se respalda.

| Etapa | Contenido | Estado |
|-------|-----------|--------|
| E0 | Andamiaje, esquema, semillas, reglas de crédito y nómina | ✅ |
| E1 | Acceso: usuarios, roles, permisos, sesión, bitácora | ✅ |
| E2 | Alumnos, tutores, QR, expediente, búsqueda | ✅ |
| E3 | Inscripciones, períodos, libro mayor de créditos | ✅ |
| E4 | Agenda, conflictos, asistencia, posposiciones | ✅ |
| E5 | Planeaciones, progreso, tareas, vista del docente | ✅ |
| E6 | Cargos, pagos, recibos con folio, nómina docente | ✅ |
| — | Planes familiares: Family Duet y Allegro Virtuoso Familiar | ✅ |
| E7 | Tablero con alertas priorizadas, reportes de dirección | ✅ |
| E8 | Prospectos, seguimientos, clase muestra y conversión | ✅ |
| E9 | Comunicación con aprobación previa, respaldos verificados | ✅ |
| — | Credencial digital: QR compartible y vista de estatus | ✅ |
| — | Inventario y préstamo de instrumentos (cláusula 9ª) | ✅ |
| — | Recitales: programa, taquilla y programa de mano | ✅ |
| — | Cuentas, cambio de contraseña obligatorio, bitácora y ajustes | ✅ |
| — | Baja de inscripción con prorrateo y aviso de 72 h (cláusula 12ª) | ✅ |

---

## Arranque

```bash
cp .env.example .env     # completar LLAVE_DATOS_SENSIBLES y AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run usuario -- --email tu@correo.mx --nombre "Tu Nombre" --rol director
npm run dev              # http://localhost:3000
```

El comando `usuario` genera la contraseña y la imprime **una sola vez**. No se pide por
argumento a propósito: lo que se teclea en la terminal queda en el historial del shell.
Solo hace falta para la primera cuenta: a partir de ahí se dan de alta desde `/usuarios`,
con la misma regla —la contraseña la genera el sistema y se ve una vez.

Al entrar con esa contraseña, Batuta lleva a `/perfil` y **no deja hacer nada más** hasta
que la persona elija la suya. Es deliberado: una contraseña que viajó por WhatsApp la
conoce más de uno, y mientras eso sea cierto la bitácora no puede responder quién hizo
qué.

| Comando | Qué hace |
|---------|----------|
| `npm test` | Reglas puras: créditos, nómina, cobranza, ciclos, conflictos, contraseñas, zona horaria, archivos, cuentas, bitácora, ajustes, bajas (325 pruebas) |
| `npm run verify` | Intenta violar las garantías contra la base real: doble cobro, doble pago, folio repetido, conversión sin expediente, envío sin aprobación, baja con instrumento afuera. Además cuadra saldos, aplicaciones y bajas |
| `npm run respaldo` | Respalda base y almacén, y **verifica la copia** antes de darla por buena |
| `npm run restaurar` | Restaura un respaldo, comprobando su hash e integridad antes de tocar nada |
| `npm run usuario` | Da de alta un usuario y genera su contraseña |
| `npm run docente` | Da de alta un maestro (puede existir sin cuenta de acceso) |
| `npm run limpiar:alumnos` | Borra alumnos y todo lo suyo, para repetir pruebas (solo desarrollo) |
| `npm run db:generate` | Genera la migración tras cambiar el esquema |
| `npm run db:reset` | Borra la base y vuelve a migrar y sembrar |
| `npm run typecheck` | TypeScript en modo estricto |

Producción: `docker compose up -d --build`

---

## Dos decisiones que explican el resto del código

### La inscripción es el eje, no el alumno

Un alumno puede cursar violín en *Allegro Virtuoso* y piano en *Allegro Andante* al mismo
tiempo. En cuanto eso pasa, cualquier campo `programa` sobre el alumno deja de tener un valor
único — y con él caen maestro, horario, saldo y cobranza. Por eso todo eso vive en
`inscripciones`, y el alumno guarda solo lo que es de la persona.

### El saldo de clases es un libro mayor, no un contador

Un campo `clases_restantes` que se incrementa y decrementa no es auditable: cuando marca 2 y
el tutor reclama 3, no hay forma de reconstruir qué pasó. En `creditos_clase` cada cambio es
un movimiento con signo, motivo, autor y fecha, y **el saldo es la suma**.

La garantía contra el doble cobro no es código, es un índice:

```sql
CREATE UNIQUE INDEX ux_credito_debito ON creditos_clase (clase_id)
  WHERE delta < 0 AND clase_id IS NOT NULL
    AND motivo IN ('clase_tomada', 'falta_sin_aviso');
```

Una clase consume por asistencia a lo sumo una vez. La base lo impide, no la aplicación.
Los ajustes por corrección quedan fuera del índice a propósito — ver *Agenda y asistencia*.

El mismo patrón protege el dinero: `ux_nomina_clase` sobre `nomina_partidas.clase_id` impide
pagar dos veces la misma clase, `ux_cargo_mensualidad_ciclo` impide cobrar dos veces el mismo
período, y `ux_recibos_folio` impide dos recibos con el mismo folio.

Y el embudo comercial, con las dos mitades de la misma garantía: `ux_prospecto_alumno` impide
que dos prospectos reclamen al mismo alumno, y `ck_prospecto_convertido` impide declarar una
conversión sin expediente. Juntas hacen que «convertidos» sea el número de alumnos que
existen, no una afirmación que alguien escribió.

Y la comunicación: `ck_mensaje_aprobado_antes_de_enviar` hace que un mensaje en estado
«enviado» sin quien lo aprobó sea un dato imposible. El requisito central del módulo no vive
solo en el código.

`npm run verify` intenta violarlas todas y comprueba que la base las rechaza.

---

## Reglas del contrato 2025

Ninguna está incrustada en el código: todas viven en la tabla `configuracion` con su cláusula
de origen.

| Regla | Valor | Fuente |
|-------|-------|--------|
| Inscripción | Gratuita, incluye credencial | Cláusula 2ª |
| Aviso mínimo para posponer | 24 h por WhatsApp institucional | Cláusula 4ª |
| Tope de posposiciones | 2 por período | Cláusula 4ª |
| Recuperación | Dentro del mismo período | Cláusula 4ª |
| Arrastre al mes siguiente | Ninguno | Cláusula 4ª |
| Falta sin aviso | Clase consumida; docente cobra 75 % | Cláusula 4ª + Dirección |
| Cubículos | 2 | Cláusula 5ª |
| Credencial oficial | A los 7 días del alta | Cláusula 10ª |
| Aviso de baja | 72 h, sin devolución | Cláusula 12ª |
| Pago docente | $120 por hora impartida | Dirección |
| Ciclo | Anclado a la inscripción | Cláusula 3ª |

### Programas

| Programa | Descripción | Horas/mes | Tarifa | Costo docente | Margen |
|----------|-------------|-----------|--------|---------------|--------|
| Plan por Clase | Clase suelta, reagendable | 1 | $200 | $120 | 40 % |
| Allegro Andante | 4 clases individuales al mes | 4 | $750 | $480 | 36 % |
| Allegro Virtuoso | 8 clases individuales al mes | 8 | $1,500 | $960 | 36 % |
| Presto Virtuoso | 8 sesiones de 2 horas al mes | 16 | $2,500 | $1,920 | 23 % |
| Allegro Andante Family Duet · 2 | 4 clases al mes **para cada uno** | 8 | $1,450 | $960 | 34 % |
| Allegro Andante Family Duet · 3 | 4 clases al mes para cada uno | 12 | $2,100 | $1,440 | 31 % |
| Allegro Virtuoso Familiar · 2 | 8 clases al mes para cada uno | 16 | $2,800 | $1,920 | 31 % |
| Allegro Virtuoso Familiar · 3 | 8 clases al mes para cada uno | 24 | $4,095 | $2,880 | 30 % |

Las horas de los planes familiares son las del grupo: cada hermano recibe sus propias clases
individuales y el maestro cobra por todas. Contarlas como si fuera un solo alumno daba 67 %
de margen donde el real es 34 %, y ese número es justo el que se usa para fijar precios.

---

## Acceso

Sesiones propias respaldadas en base de datos, no Auth.js. El contrato exige cierre por
inactividad, cierre absoluto y revocación — y las tres obligan a consultar la base en cada
petición de todos modos, así que un token firmado no aportaba nada y sí quitaba control.

| Medida | Cómo |
|--------|------|
| Contraseñas | Argon2id, 19 MiB · 2 iteraciones · paralelismo 1 (OWASP 2024) |
| Token de sesión | 32 bytes aleatorios; en la base solo vive su SHA-256 |
| Cookie | `httpOnly`, `SameSite=Lax`, `Secure` en producción |
| Cierre por inactividad | 30 minutos |
| Cierre absoluto | 12 horas |
| Límite de intentos | 5 por correo y 20 por IP en 15 minutos |
| Enumeración de correos | Hash señuelo real: el login tarda lo mismo exista o no la cuenta |
| Cierre de sesión | `POST`, nunca `GET` |

La autorización vive en `lib/auth/permisos.ts`, **no en un middleware**. Un middleware de Next
corre en el runtime edge, no puede tocar SQLite, y protege rutas: en cuanto alguien añade una
pantalla nueva, la protección se olvida. Obligando a que cada pantalla llame `exigirSesion()` o
`exigirPermiso()`, una pantalla sin guardia simplemente no obtiene datos.

Sin permiso se responde **404, no 403**: confirmar que un recurso existe pero está prohibido ya
filtra información. Para un docente, el expediente de un alumno ajeno no existe.

### La contraseña que generó el sistema no deja trabajar

`usuarios.password_cambiada_en` en `NULL` significa que la persona sigue usando la contraseña
que Batuta generó y que se le entregó en un papel o por WhatsApp. Mientras sea `NULL`,
`exigirSesionUsable()` manda a `/perfil` desde cualquier pantalla.

No es celo: es lo único que hace que la bitácora signifique algo. «¿Quién cambió esa
asistencia?» solo tiene respuesta si nadie más podía entrar con esa cuenta, y una contraseña
que viajó por mensaje la conoce más de una persona por definición. La excepción son `/perfil`
y `/salir`, que usan `exigirSesion()` a secas: si también rebotaran, la redirección sería un
círculo del que nadie podría salir.

Restablecer una contraseña vuelve a dejar la columna en `NULL` y cierra todas las sesiones de
esa cuenta. Si se restablece porque alguien no reconocido la estaba usando, dejarla abierta no
resolvería nada. Cambiarla uno mismo cierra las **otras** sesiones y conserva la actual: echar
de la aplicación a quien acaba de hacer lo correcto enseña a no hacerlo.

### Cuentas

`/usuarios` da de alta, cambia el rol, restablece contraseñas y desactiva. Dos guardias viven
en `lib/dominio/usuarios.ts` y se prueban sin base de datos, porque son el único error que no
tiene arreglo desde la propia aplicación:

- nadie puede desactivarse ni degradarse a sí mismo;
- no se puede dejar a la academia sin **ningún director activo**.

Quien pasa a ser maestro recibe su ficha laboral si no la tenía: un docente sin ficha entra,
abre la agenda y no ve un solo alumno, porque su alcance filtra por una ficha que no existe.

Desactivar no borra nada. El historial de esa persona —sus clases, su nómina, lo que registró—
sigue completo, que es precisamente de lo que vive la bitácora.

### Bitácora

`/bitacora` responde «quién hizo esto y cuándo» con filtros por día, persona, acción y texto
libre. Las claves (`clase.autorizar_excepcion`) se traducen a español en `lib/dominio/bitacora.ts`:
una auditoría que solo entiende un programador no audita nada. Los movimientos delicados
—datos de salud, un pago modificado después de registrado, un respaldo restaurado— se marcan
para poder encontrarlos.

Las fechas se filtran con `inicioDelDiaEnMexico`/`finDelDiaEnMexico`. Comparar contra
medianoche UTC dejaría fuera las seis primeras horas de cada día en la academia, y en una
auditoría eso no es un detalle de presentación: es un renglón que no aparece cuando se le busca.

La bitácora nunca guarda contraseñas, hashes ni tokens de credencial; guarda que alguien los
tocó. `resumirCambios()` los filtra otra vez al mostrar, por si alguna vez se colaran.

### Ajustes

`/ajustes` edita las reglas de operación, separadas en tres: lo que viene del **contrato
firmado**, lo que decide **dirección** y los **datos de la academia** que salen impresos.
El dinero se captura en pesos y se guarda en centavos, como en todo el sistema.

Tres parámetros están bajo candado y se muestran sin poder editarse, porque no se pueden
deshacer mirando la pantalla: `zona_horaria` (movería de día todo lo ya fechado),
`recibo_prefijo_folio` (partiría la numeración en dos series irreconciliables) e
`ia_habilitada` (todavía no hay asistente que encender).

Cambiar un ajuste **no recalcula lo que ya ocurrió**. Los cortes de nómina, los cargos y los
recibos emitidos conservan las reglas vigentes cuando se hicieron, que es lo que permite
defenderlos meses después.

## Alumnos

El alta es una sola transacción: alumno, tutor, ficha de salud cifrada, consentimientos y
credencial entran juntos o no entra nada. Un alumno a medias —con expediente pero sin
consentimiento registrado— es peor que ninguno.

| Regla | Dónde vive |
|-------|-----------|
| Menor de edad ⇒ tutor obligatorio | Validado en el servidor, no solo con `required` |
| Aviso de privacidad ⇒ obligatorio | Sin él no hay base legal para tratar los datos |
| Uso de imagen ⇒ opcional | El **no** se guarda igual que el sí, y el expediente lo muestra |
| Folio `VS-0001` | Contador incrementado dentro de la transacción, sin carreras |
| Credencial a 7 días | Cláusula 10ª; se agenda sola al dar de alta. Hoy se entrega como QR digital |

La búsqueda es **insensible a acentos**: teclear `martinez` encuentra a *Martínez*. Nadie en
recepción escribe los acentos, y con ellos la búsqueda sería inútil en México.

### El QR es la credencial

Codifica solo un token opaco de 128 bits — ni el id del alumno ni nada secuencial, porque si
lo fuera, quien viera un QR podría construir los de los demás sumando uno. Escanearlo sin
sesión no revela nada, ni siquiera que el token exista: un token inventado y uno real llevan
a la misma pantalla de acceso.

**Escanear lleva al estatus, no al expediente.** El expediente contesta bien «cuéntame todo»
y mal «¿este niño puede pasar a su clase?», que es la única pregunta que se hace con un
teléfono en la mano frente al mostrador. El estatus la contesta en un vistazo —clases
disponibles, período, próxima clase, adeudo— y desde ahí el expediente está a un clic.

Mientras la credencial física esté en diseño, **el QR es la credencial**: se descarga como PNG
desde `/api/qr/[id]`, se manda por WhatsApp y el alumno lo muestra desde el teléfono. Hay
también una tarjeta imprimible con el mismo armazón que la nota de remisión. Registrar la
entrega —y por qué medio— apaga la alerta de la cláusula 10ª; «entregada» a secas no
distinguiría una tarjeta de un enlace seis meses después.

El PNG existe aparte del SVG que se dibuja en pantalla porque son dos usos: el SVG se ve e
imprime, el PNG se comparte. WhatsApp no manda SVG, y pedirle a recepción que le tome captura
a la pantalla produce códigos cortados que no escanean.

Escanear una credencial es un acceso al expediente y queda en bitácora como tal.

`URL_PUBLICA` no es opcional en producción: el QR lleva la dirección dentro, y generarlo con
el host de una petición interna produce un código que el teléfono del alumno no alcanza.

## Inscripciones y períodos

Un alumno puede tener varias inscripciones a la vez si son instrumentos distintos. Cada una
lleva su programa, maestro, período y saldo propios.

El período **se ancla a la fecha de alta**, no al mes calendario: quien se inscribe el 18 de
septiembre tiene período hasta el 17 de octubre. Así «4 clases contratadas» significa cuatro
exactas y desaparecen los prorrateos y los meses de cinco semanas.

Al abrir un período se emiten sus créditos y **se congela el precio**: cambiar la tarifa
después no reescribe contratos vigentes.

### Una trampa de fechas que vale documentar

`sumarMeses` recorta al último día del mes cuando el destino no existe. Sin ese recorte, el
31 de enero más un mes da «31 de febrero», que `Date` convierte alegremente en 2 o 3 de marzo
— y el período del alumno se correría dos días cada vez que cae en un mes largo. Hay pruebas
para enero, marzo y años bisiestos.

### Por qué existe `verifica-saldos.mjs`

La subconsulta que calcula el saldo se escribió interpolando columnas de Drizzle, que las
renderiza **sin prefijo de tabla**. El SQL resultante comparaba `ciclo_id = id` dentro de
`creditos_clase`, devolvía 0 en silencio, y la cifra grande del expediente quedaba mal sin
que nada fallara. Una prueba unitaria no lo habría visto: el error vivía en el SQL generado.
Ese script compara, para cada período, el saldo que muestra la aplicación contra la suma
real del libro mayor.

## Planes familiares

Un Family Duet cuesta $1,450 y cubre a dos hermanos. **Lo que se comparte es el precio, no
el horario ni el saldo**: cada uno recibe sus cuatro clases individuales, con su maestro y su
libro mayor.

De ahí la forma del modelo: una inscripción por alumno y una sola de ellas —la titular—
carga la mensualidad. Las demás apuntan a ella con `cubierta_por_id` y abren su ciclo en
cero. No es cortesía: es el mismo dinero contado una vez.

| Alternativa descartada | Por qué |
|---|---|
| Cobrar $1,450 en cada expediente | Duplica el adeudo de la familia y la cobranza global miente |
| Partirlo en $725 por alumno | Dos recibos por un pago que el tutor hace una vez |
| Una tabla de «grupo familiar» | Un nivel de indirección para lo que un campo ya dice |

Para sumarse a un plan se exige **tutor en común**, no apellido: los apellidos se repiten y
el parentesco que la academia sí registró es el del tutor. El cupo se valida en el servidor
dentro de la transacción, no solo en la pantalla — el id del titular viaja en el formulario
y quien lo cambie a mano se colgaría del plan de otra familia.

Eso destapó que el alta **siempre creaba un tutor nuevo**: cada hermano estrenaba su propia
copia de la misma madre, y la tabla N:N que existe justo para compartirla no servía para
nada. Ahora el alta ofrece el padrón.

### Dar de baja (cláusula 12ª)

El contrato pide 72 horas de aviso y dice «sin derecho a devolución». Eso resuelve lo que ya
se pagó y calla sobre lo que se facturó y sigue sin cobrarse, que es el caso incómodo.
Dirección lo resolvió por estado del cargo:

| Situación | Cuándo surte efecto | Qué pasa con el dinero |
|-----------|---------------------|------------------------|
| Mensualidad **pagada** | Al cierre del período | No se devuelve nada. Conserva sus clases hasta esa fecha |
| Mensualidad **sin pagar** | A las 72 h del aviso | El cargo se ajusta a la proporción de clases tomadas |

El plazo se cuenta desde el día en que **avisó el tutor**, no desde el día en que recepción lo
capturó: lo que el tutor puede demostrar es su mensaje con fecha. Y cuando las dos condiciones
aplican, manda la más tardía — el contrato pide ambas, no la que salga primero.

El prorrateo **nunca baja del importe ya entregado**. Reducir el cargo por debajo de lo que el
tutor pagó sería una devolución con otro nombre, y la cláusula 12ª no la concede.

**La agenda:** se cancelan las clases programadas *después* de la fecha efectiva y su cubículo
queda libre. Las de antes no se tocan: son las que el alumno todavía tiene derecho a tomar.

**El período no se cierra.** Es deliberado, y cuesta verlo: si la baja surte efecto en tres
semanas porque ya pagó el mes, cerrar el período ahora expiraría su saldo y le quitaría
justo lo que el contrato le concede. El período corre hasta su fecha; lo que se detuvo es la
renovación, y el tablero ya filtra por inscripción activa.

**Dos negativas** protegen de lo que después nadie arregla mirando la pantalla: no se cierra
una inscripción con un instrumento de la academia afuera, y no se va el hermano que paga un
plan familiar dejando a los demás tomando clase sin cargo. `verifica-bajas.mjs` comprueba las
dos contra la base real, junto con que ninguna baja haya dejado clases ocupando cubículo ni un
cargo por debajo de lo cobrado.

Nada se borra. El expediente, las clases tomadas, los pagos y los recibos siguen completos.

## Agenda y asistencia

Las clases se agendan desde la inscripción. Antes de guardar se comprueban tres choques:
**alumno**, **maestro** y **cubículo** — la academia tiene dos, así que el aula es un recurso
escaso de verdad. Una clase en línea no ocupa cubículo y por eso no choca por aula.

Los extremos no cuentan como traslape: una clase de 16:00 a 17:00 y otra de 17:00 a 18:00
son consecutivas, no simultáneas. Usar `<=` ahí haría imposible agendar dos clases seguidas,
que es justo como trabaja la academia.

### Corregir un registro de asistencia

El índice único impide que una clase consuma dos veces. Pero una corrección legítima
—«marqué asistió y en realidad avisó con dos días»— tiene que poder mover el saldo en
sentido contrario, y bloquearla dejaría el expediente mal para siempre.

La salida fue separar dos cosas que se veían iguales:

| | Motivo | Cubierto por el índice |
|---|---|---|
| Consumo por asistencia | `clase_tomada`, `falta_sin_aviso` | Sí — ocurre una sola vez por clase |
| Corrección posterior | `ajuste_manual` | No — es explícito y queda marcado |

El libro mayor sigue siendo append-only: una corrección **agrega** un movimiento
compensatorio, nunca borra ni reescribe el anterior. Y si el saldo no cambia (de «asistió» a
«falta sin aviso», que consumen igual) no se escribe nada: el cambio de estado queda en
bitácora y el libro no se ensucia con movimientos de cero.

### Posposiciones

Cláusula 4ª, implementada al pie de la letra: 24 h de aviso, tope de 2 por período, y la
recuperación va dentro del mismo período. **Se guarda la hora en que avisó el tutor**, no
aquella en que el personal la capturó — es lo único que determina si se cumplió el umbral.

El director puede autorizar por debajo del umbral dejando el motivo; queda con su nombre en
la bitácora. Una clase de recuperación **no se puede volver a posponer**: ya es la segunda
oportunidad, y permitirlo abriría la puerta al diferimiento indefinido.

### Zona horaria

El servidor corre en UTC. Interpretar «2026-09-21 16:00» con su reloj pondría la clase seis
horas antes de lo que el director escribió, y nadie se daría cuenta hasta que alguien llegara
a un cubículo vacío. `lib/zona.ts` convierte en ambos sentidos calculando el desfase con el
identificador IANA, nunca con un −6 escrito a mano.

## Archivos del expediente

Los PDF de planeaciones, contratos y documentos del expediente viven en `almacen/`,
**fuera de `public/`**. Los recibos no se guardan como archivo: se reimprimen desde su folio,
que es el dato que sí es permanente. No
existe una URL que sirva un archivo sin pasar por `/api/documentos/[id]`, y ahí se verifica
sesión, permiso y alcance antes de tocar el disco.

| Medida | Por qué |
|--------|---------|
| Nombre en disco generado por el sistema | Un archivo llamado `../../.env` escribiría fuera del almacén |
| Solo PDF, JPG y PNG, hasta 10 MB | Un HTML subido y servido se ejecutaría en el navegador |
| `X-Content-Type-Options: nosniff` | Impide que el navegador adivine otro tipo |
| `Cache-Control: private, no-store` | Un expediente no se guarda en cachés intermedias |
| Nombre de descarga saneado | Comillas y saltos de línea permiten inyectar cabeceras |
| SHA-256 guardado | Detecta corrupción y verifica que un respaldo restauró el archivo íntegro |

Un documento fuera de alcance responde **404, no 403**: un maestro no puede siquiera confirmar
que existe la planeación de otro.

## Cobranza, recibos y nómina

El dinero se mueve en tres piezas separadas a propósito: **cargos** (lo que se debe),
**pagos** (lo que entró) y **aplicaciones** (qué pago saldó qué cargo). Un solo campo
`pagado` en el cargo no habría podido explicar un abono parcial, ni un pago que salda dos
meses, ni un saldo a favor — y esos tres casos ocurren todas las semanas.

| Momento | Qué pasa |
|---------|----------|
| Se abre o renueva un período | Se genera su mensualidad con el precio congelado del período y vence el día de inicio (cláusula 3ª) |
| Se recibe dinero | Se reparte al cargo **más antiguo primero**; lo que sobra queda a favor del alumno |
| Se emite el recibo | Folio consecutivo por año tomado dentro de la misma transacción |

La inscripción **no genera cargo**: el contrato de 2025 la declara gratuita, y el sistema se
atiene al contrato aunque el brief inicial mencionara $800.

### El recibo

Es la nota de remisión de la academia, replicada en HTML e impresa por el navegador. No se
genera PDF en el servidor: «Guardar como PDF» da fidelidad exacta y cero dependencias, y un
PDF servidor solo hará falta cuando el sistema envíe recibos por correo (fase 2).

Un abono parcial **no se imprime como «$750 × 1 = $400»**. El renglón cuadra solo —precio
unitario igual al importe aplicado— y el cargo completo y el saldo restante se declaran en la
descripción. Un documento que se entrega al tutor no puede necesitar explicación aparte.

El recibo dice en su cara que **no es un comprobante fiscal digital**. Mientras no exista
facturación integrada, callarlo invitaría a usarlo como si lo fuera.

### La nómina

$120 por hora impartida: una clase de una hora paga $120 y una de dos, $240. Cuando el alumno
falta sin avisar, el maestro cobra el **75 %** —reservó el horario y se presentó— y el factor
queda guardado en la partida, no solo calculado, para que el recibo de nómina de hace seis
meses siga explicándose solo si mañana cambia la tarifa.

Correr el corte dos veces no paga dos veces. La garantía es `ux_nomina_clase`, un índice único
sobre `clase_id`: el código salta las clases ya consideradas, y si el código fallara, la base
rechaza el `INSERT`.

Al cerrar un corte las partidas salen de «pendiente de pago» y con ellas desaparecería todo
rastro en pantalla. Por eso existe **Cortes pagados**: el director ve constancia de lo que
liquidó y el maestro ve —solo lo suyo— lo que le pagaron.

### Lo que el maestro no ve

| | Director | Maestro |
|---|---|---|
| Adeudos y cobranza de la academia | Sí | No |
| Resultado administrativo | Sí | No |
| Recibos de alumnos | Sí | No (404) |
| Nómina propia y cortes propios | Sí | Sí |
| Nómina de otros maestros | Sí | No |

`/finanzas` responde **404** a un maestro, no 403.

### «Resultado administrativo», nunca «utilidad»

Ingresos menos nómina —pagada **y devengada**— menos gastos. Incluir la nómina ya impartida
aunque no se haya pagado evita que el resultado se vea inflado hasta el día del corte.

El nombre es deliberado y aparece así en toda la interfaz: mientras no exista contabilidad
fiscal integrada, llamarlo utilidad sería afirmar algo que el sistema no puede sostener.

## Tablero, alertas y reportes

### Una alerta que no se puede apagar es ruido

Todo lo que entra a **Pendientes** tiene un destino al que ir y una acción que lo apaga. Por
eso no hay avisos de «tienes 12 alumnos»: eso es un indicador, y vive en las tarjetas de
arriba.

El orden importa tanto como el contenido. Una pantalla con veinte avisos del mismo color es
una pantalla que nadie lee, así que la urgencia se reparte en tres niveles y la lista se
ordena por ellos —no por cuándo se detectó—, desempatando por gravedad: más días vencidos,
más pesos, más tiempo sin registrar.

| Alerta | Urge cuando |
|--------|-------------|
| Clase sin registrar | 1 día de gracia; a los 3 pasa a urgente |
| Adeudo | Desde el día siguiente al vencimiento (cláusula 3ª) |
| Período por vencer | ≤ 5 días; vencido es urgente |
| Saldo agotado | El alumno se quedó sin clases con el período vivo |
| Credencial pendiente | Desde su fecha; a los 7 días urge (cláusula 10ª) |
| Sin planeación | Informativa: no bloquea a nadie |
| Prospecto sin seguir | Vencido o sin fecha; urgente a los 3 días |
| Mensajes sin aprobar | Mientras no se aprueben, no los recibe nadie |
| Respaldo atrasado | Más de 2 días; urgente pasada la semana |
| Instrumento sin devolver | El período que lo amparaba ya cerró |
| Propuestas sin confirmar | Urgente a tres días del recital: ya no hay margen para ensayar |
| Nómina por pagar | Informativa: es dinero comprometido, no vencido |

La más valiosa es **clase sin registrar**. Sin ese registro el saldo del alumno miente, la
nómina del maestro falta y nadie se entera hasta que alguien reclama. Se da un día de gracia
porque registrar la clase de la tarde a la mañana siguiente es la operación normal de la
academia, no un descuido.

El maestro recibe solo lo suyo y **ninguna alerta de dinero**: ni adeudos, ni credenciales,
ni nómina de la academia.

### El tablero dejó de ser un catálogo

Programas, tarifas, reglas del contrato, instrumentos y cubículos se mudaron a `/catalogo`.
Son dos preguntas distintas —«qué hay que hacer hoy» y «qué es la academia»— y competían por
la misma pantalla.

### Reportes

Ninguno escribe en la base: correrlo dos veces da el mismo resultado.

- **Movimiento de inscripciones.** Cuenta inscripciones, no alumnos: quien da de baja el
  piano y sigue en violín es una baja aunque el alumno se quede.
- **Asistencia** por maestro y por programa. El porcentaje sale solo de las clases con
  resultado; las que siguen sin registrar se muestran aparte porque no son un dato, son un
  pendiente.
- **Carga de trabajo.** Solo cuenta lo que genera pago —la misma regla de la nómina—, porque
  contar las canceladas daría dos verdades sobre el mismo mes.
- **Dinero por programa.** El margen se calcula sobre lo **cobrado**, no sobre lo emitido. Un
  programa con mucho facturado y poco cobrado no tiene buen margen: tiene un problema de
  cobranza, y la columna de al lado lo dice.
- **Alumnos en riesgo.** Faltaron a la mitad o más de sus clases. Es la señal temprana de una
  baja, y lo único que se puede hacer antes de las 72 h de la cláusula 12ª.

### El costo docente no espera al botón

El costo salía de `nomina_partidas`, que solo existen después de calcular un corte. Un mes sin
corte aparecía con **costo cero y margen del 100 %**: el reporte decía que el programa era
perfecto precisamente porque nadie había apretado el botón.

Ahora se deriva de las clases. Cuando la partida existe manda ella —lleva la tarifa del día en
que se calculó, y un cambio de tarifa no debe reescribir el pasado—; cuando no, se aplica la
misma regla sobre la clase impartida. El costo lo causa la clase, no el clic.

## Prospectos

Un prospecto rara vez se pierde por falta de interés: se pierde porque nadie volvió a
escribirle. Casi todo este módulo existe para que el sistema sepa **a quién hay que buscar
hoy** en vez de ser una lista que se mira de vez en cuando.

### Dos personas, no una

«Hola, quiero clases para mi hija de 7 años» trae un alumno en potencia y un adulto que
escribe. El prospecto guarda a los dos. Meterlos en un solo juego de campos obliga a decidir
de quién es el teléfono, y al convertir se pierde el parentesco que el contrato sí exige.

Al convertir, el contacto se vuelve **tutor** —con su parentesco— solo si es otra persona. Un
adulto que pregunta por sí mismo no es su propio tutor, y registrarlo así ensucia el padrón.

### Etapas que no se saltan

| | |
|---|---|
| `nuevo → convertido` | **No.** Convertir a alguien con quien nadie habló significa que el registro de contacto se perdió, y el embudo deja de medir nada |
| `convertido → cualquiera` | **No.** Un alumno no vuelve a ser prospecto |
| `perdido → convertido` | **No.** Se reactiva primero con un contacto |
| Retroceder | **Sí.** Un prospecto que se enfría vuelve a «contactado»: la realidad no avanza en línea recta |

**Cambiar la etapa nunca convierte.** Ni siquiera desde una etapa desde la que la transición
sería legítima: convertir significa abrir un expediente, y eso solo lo hace la conversión. Sin
esa puerta, un formulario editado a mano dejaba el prospecto marcado como convertido con
`alumno_id` en NULL — el embudo contaba una inscripción que nunca existió y nadie podía
encontrar al alumno. Hoy lo impide el código y, si el código fallara, el `CHECK` de la tabla.

### Por qué un perdido necesita motivo

Es obligatorio. Sin él, la tabla de «por qué se pierden» estaría vacía justo donde hay algo
que cambiar: si nueve de diez dicen «precio», el problema es el precio; si dicen «horario»,
es la agenda.

### La conversión se mide sobre los cerrados

`convertidos / (convertidos + perdidos)`. Contar los que siguen en juego castiga a quien acaba
de recibir diez mensajes: todavía no son un fracaso, solo no son un resultado. Y cuando no hay
nada cerrado la tasa es **—**, no cero: un cero se leería como «no vendemos».

Los orígenes se ordenan por **alumnos conseguidos**, no por mensajes recibidos. Un canal con
cien mensajes y dos inscripciones es peor que uno con diez y cinco, y ordenar por volumen
haría gastar el presupuesto exactamente al revés.

### Duplicados: se avisa, no se bloquea

No hay índice único sobre el teléfono. En una familia el número es el mismo para los tres
hermanos, y bloquear el alta obligaría a inventar teléfonos falsos. La ficha avisa de posibles
duplicados por nombre o teléfono y decide la persona.

### El historial no se edita

Cada intento de contacto queda con su canal, su resultado y quién lo hizo, como el libro mayor
de créditos. «Ya le marqué tres veces» necesita las tres marcas, no un contador — y también es
la respuesta a «quién quedó de llamarle y no lo hizo».

## Comunicación con aprobación previa

Nada sale de la academia sin que alguien lo lea antes. Se redacta, se aprueba y entonces se
manda, y queda registrado quién hizo cada cosa.

### El texto que se aprueba es el que sale

Se guarda el mensaje **ya armado**, no la plantilla más los datos. Si se guardara la receta,
editar la plantilla después cambiaría el contenido de un mensaje ya aprobado y la aprobación
dejaría de significar nada.

Por lo mismo se revalida justo antes de aprobar: entre redactar y autorizar el texto pudo
cambiar, y lo que se autoriza es lo que va a salir.

### «Hola {{tutor}}»

Es el modo de fallar que todo el renderizado existe para impedir. Un mensaje con un hueco sin
llenar no es un mensaje incompleto: es un mensaje que no se puede mandar, y esa diferencia
tiene que ser un error, no un criterio.

Un valor **vacío** cuenta como faltante igual que el hueco: «Hola , te recordamos…» delata el
sistema exactamente igual. El hueco tampoco se borra al renderizar — se conserva para que el
error sea visible en vez de invisible.

### Redactar y aprobar son permisos distintos

El asistente prepara, el director autoriza. Cada acto deja su sello propio —quién aprobó y
cuándo, quién marcó el envío y cuándo— porque juntarlos en un campo haría imposible responder
«¿quién autorizó esto?» cuando un tutor reclame.

Un rechazo **exige motivo**: sin él, quien tiene que corregir el mensaje no sabe qué. Y un
mensaje devuelto se corrige y vuelve a la cola; no salta directo a aprobado.

### El sistema no manda por ti

No hay integración con WhatsApp, y fingir que la hay sería peor que no tenerla. El botón abre
`wa.me` con el texto ya escrito; después se marca el envío para que quede registrado. Los
teléfonos de diez dígitos se normalizan a lada 52, y un número que no alcanza a serlo devuelve
**null** en vez de fabricar un enlace roto.

## Respaldos

### Un respaldo que nadie ha abierto es una hipótesis

`npm run respaldo` copia con la **API de respaldo de SQLite**, no con `cp`: con WAL activo,
copiar el archivo a mano puede capturar una base a medio escribir. Después abre la copia, le
corre `integrity_check` y `foreign_key_check`, cuenta las filas de las tablas imprescindibles
y las compara contra el original.

**Si algo no cuadra, borra la copia y sale con error.** Un respaldo malo en la carpeta es peor
que ninguno, porque da confianza falsa.

El manifiesto guarda el SHA-256 de cada pieza. Es lo que permite comprobar años después que el
archivo no se corrompió en el disco o en la nube donde se guardó.

### Restaurar comprueba antes de tocar nada

Primero el hash, luego la integridad de la copia, luego los conteos contra el manifiesto, y
**solo entonces** la base viva. Restaurar primero y descubrir después que el archivo estaba
corrupto deja a la academia sin base y sin respaldo, que es el peor resultado posible de una
operación de rescate.

La base que se reemplaza no se borra: se copia a un lado con marca de tiempo, después de
plegarle el WAL para que esa copia no salga sin los últimos cambios.

### Hay que detener la aplicación

Esto lo encontró la prueba de navegador. Restaurar renombrando el archivo deja al proceso que
ya lo tenía abierto escribiendo en un archivo que ya nadie ve: **la restauración parece
funcionar y no hace nada**. Ahora se escribe sobre el mismo archivo y se descarta el WAL
anterior —que describe cambios que ya no existen y corrompería la recién restaurada—, y el
script dice en mayúsculas que la aplicación se detiene antes y se reinicia después.

### Retención abuelo-padre-hijo

Todos los de los últimos 14 días, uno por semana durante 8 semanas, uno por mes durante 12.
Guardar todo llena el disco; borrar por edad pierde justo el respaldo viejo que hace falta
cuando un error llevaba meses pasando inadvertido.

**Nunca se borra el único respaldo que existe**, por viejo que sea y aunque la política diga
que sobra.

El tablero avisa cuando el último respaldo tiene más de dos días. El aviso útil no es «no hay
respaldo» —eso se ve—, sino «el último es de hace demasiado», que es el que nadie nota hasta
que lo necesita.

## Inventario y préstamo de instrumentos

Cláusula 9ª, tal como ya estaba en el catálogo: los instrumentos de **gran formato no salen
de las instalaciones** y solo **Allegro Virtuoso** autoriza llevárselo a casa. El módulo no
redefine esas reglas, las lee de `instrumentos.granFormato` y `programas.permitePrestamoACasa`.

### Un ejemplar no es un instrumento

`instrumentos` dice que la academia enseña violín; `ejemplares` dice que tiene cuatro
violines, uno con el arco flojo y otro prestado desde el martes. Sin esa distinción no se
puede contestar «¿hay uno libre?», que es la única pregunta que se le hace a un inventario.
Cada ejemplar lleva su folio `INV-0001`, su medida —un violín de 1/2 no le sirve a un
adolescente— y su historia.

### El préstamo no mueve dinero

No hay depósito en garantía, y **un daño no genera cargo automático**. Queda la evidencia, el
ejemplar cambia de estado y la dirección decide qué cobrar. Cobrarle a una familia por un arco
roto sin que nadie lo haya tecleado es exactamente lo que no debe pasar solo — y la responsiva
lo dice en su cara, porque callarlo dejaría a la familia suponiendo lo contrario.

El valor de reposición se guarda, pero es informativo: sirve para el seguro y para saber
cuánto se arriesga al prestar.

### El préstamo dura lo que dura el período

Se ancla al ciclo. Cuando el período cierra sin renovar, el instrumento está en casa de
alguien que ya no toma clases, y esa es la única situación del inventario que de verdad urge:
el tablero la marca en rojo y el inventario tiene su propia sección **Por devolver**.

### El estado no lo elige quien recibe

Lo deriva la regla. Una **pérdida da de baja** el ejemplar aunque en el mostrador lo hayan
marcado «bueno» —dejarlo disponible lo pondría mañana en la lista de lo que se puede
entregar—, y un **daño lo manda a reparación** aunque la impresión del momento dijera otra
cosa: la incidencia pesa más.

Una incidencia **sin nota** no se acepta: sin ella, la dirección no puede decidir qué cobrar.

| Garantía en la base | Qué impide |
|---|---|
| `ux_prestamo_abierto` | Que el mismo violín salga dos veces a la vez |
| `ck_prestamo_devolucion_completa` | Un «devuelto» que no dice en qué estado volvió |
| `ck_prestamo_incidencia_con_nota` | Un daño reportado sin explicar qué pasó |

El índice único es el que importa: sin él, dos clics seguidos —o dos personas en recepción al
mismo tiempo— entregan el mismo instrumento a dos familias.

### Quién puede prestar

El asistente gestiona el inventario, porque quien entrega el instrumento en el mostrador es
quien tiene que registrarlo: si el permiso fuera solo del director, cada préstamo esperaría a
que él abriera su sesión. Sigue sin ver finanzas, nómina ni reportes, y sigue redactando
mensajes sin poder aprobarlos.

El maestro no entra al inventario.

### La responsiva

Mismo armazón que la nota de remisión y la credencial: caja, franja, impresión por navegador.
Son documentos de la misma casa y duplicar el armazón habría dejado tres que se separan al
primer ajuste de marca. Lo único propio son las dos firmas al pie — el préstamo es el único
documento de la academia que alguien firma a mano.

### Reportar un daño deja constancia, no un aviso

Al cerrarse el préstamo la pantalla se recarga y el mensaje de confirmación desaparece con
ella. La ficha del ejemplar muestra el incidente de forma permanente, con lo que se reportó y
un enlace al expediente del alumno: es donde hay que ir si se decide cobrar algo, y es
justo después de reportar un instrumento roto cuando hace falta recordar que **nadie va a
cobrar nada solo**.

## Recitales

### Dos manos a propósito

El maestro propone —es quien sabe qué alumno tiene una pieza lista— y la dirección confirma.

El bloqueo por adeudo se aplica **al confirmar, no al proponer**. Es la consecuencia directa de
que el maestro no vea finanzas: rechazarle una propuesta por una deuda que no puede consultar
le daría un error imposible de entender y de resolver. La dirección, que sí ve el adeudo, es
quien decide. La estructura lo refleja — `SolicitudDePropuesta` ni siquiera tiene campo de
adeudo, y hay una prueba que lo comprueba.

El requisito se mide sobre lo **vencido**. Un cargo cuyo plazo todavía no llega no es un
adeudo, y bloquear por él dejaría fuera a quien acaba de renovar el mismo día del recital.

Un rechazo **exige motivo**: el maestro necesita saber qué corregir.

### El programa se cierra una vez

Cerrar el programa es el momento en que se imprime, así que antes se comprueba que el orden
sea utilizable: sin huecos y sin repetidos. Un programa con dos números tres no se puede leer
en voz alta, y el error aparece cuando ya está en las manos del público.

| Garantía en la base | Qué impide |
|---|---|
| `ux_participacion_orden` | Dos alumnos en el mismo lugar del programa |
| `ck_participacion_rechazo_con_motivo` | Devolver una propuesta sin decir por qué |
| `ck_participacion_confirmacion_completa` | Una confirmación sin quién la autorizó |
| `ck_boleto_total_cuadra` | Que la taquilla descuadre |

### Uso de imagen

El recital es donde ese consentimiento importa de verdad: hay fotos y video. La ficha del
recital lista por nombre a quienes **no** lo autorizan, para que nadie tenga que acordarse
revisando expedientes uno por uno.

### La taquilla vive aparte de las mensualidades

Un boleto no es un cargo a un alumno: lo compra quien viene al recital, que muchas veces no es
familia de nadie. Mezclarlo con `cargos` obligaría a inventar un alumno para cada abuelo que
compra dos entradas.

El total lo comprueba la base: `total = cantidad × precio unitario`. Un total tecleado a mano
—o calculado en pesos y redondeado después— es como se cuelan los descuadres de un peso que
nadie sabe explicar al cerrar la caja.

El aforo se comprueba **dentro de la transacción**. Contarlo antes y vender después deja pasar
dos ventas simultáneas que juntas exceden la sala: son dos personas en taquilla, no una
hipótesis.

Una **cortesía** vale $0 pero cuenta para el aforo: ocupa una silla igual que un boleto
pagado. Y un boleto cancelado devuelve su lugar.

El precio vive en el recital, no en la configuración: un recital de fin de curso en un teatro
rentado no cuesta lo que una tarde de alumnos en la academia.

### El programa de mano

Es el único documento de la casa que se le da al **público** y no a una familia, así que baja
el tono administrativo: sin folios, sin cláusulas, sin totales. Solo el orden, quién toca, qué
toca y con quién estudia. Se imprime completo aunque lo abra un maestro — un programa de mano
con solo sus alumnos no es un programa de mano.

## Datos sensibles

`salud_alumno` guarda las respuestas del bloque «Consideraciones de salud y aprendizaje» del
contrato. Bajo la LFPDPPP son **datos personales sensibles**, y de menores de edad:

- tabla aparte, cifrada en reposo, con su propia llave
- permiso propio, distinto de «ver alumno»
- excluida de listados, reportes y exportaciones
- el catálogo de consultas del asistente de IA **no expone ninguna función que la lea**
- cada lectura queda en bitácora

Si se pierde `LLAVE_DATOS_SENSIBLES`, esos datos son irrecuperables. Guardarla fuera del servidor.

---

## Convenciones

- **Dinero en centavos.** `$750.00` se guarda como `75000`. Nunca coma flotante.
- **Fechas civiles como texto** `YYYY-MM-DD`. Guardar un cumpleaños como marca de tiempo lo
  adelanta un día. La edad se calcula, nunca se almacena.
- **Instantes en UTC**, presentados en `America/Mexico_City`. México eliminó el horario de
  verano en 2022, así que hoy es UTC−6 fijo — razón de más para no escribir el desplazamiento
  a mano y usar siempre el identificador IANA.
- **Origen y estado de una clase son ejes distintos.** Una clase de recuperación también se
  asiste o se falta.
- **Ningún archivo se sirve desde ruta estática.** El almacén vive fuera de `public/` y toda
  descarga pasa por un endpoint que verifica permiso.

## Estructura

```
src/
  db/schema/     catalogo · personas · acceso · academico · expediente · finanzas
  lib/dominio/   reglas puras, sin base de datos ni interfaz — aquí van las pruebas
  lib/datos/     consultas; el alcance por rol se aplica aquí, no en las pantallas
  lib/formato.ts dinero, fechas y edad en horario de la academia
  app/           pantallas
drizzle/         migraciones versionadas
respaldos/       copias verificadas (nunca se versiona)
scripts/         verificación de garantías y cuadres contra la base real
almacen/         documentos del expediente (nunca se versiona)
```

`lib/dominio/` no importa nada de `db/` a propósito: las reglas críticas —qué consume un
crédito, qué genera pago docente— se prueban sin levantar nada.
