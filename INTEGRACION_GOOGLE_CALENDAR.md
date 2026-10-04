# Integración Google Calendar - Batuta

## Estado Actual

✅ **Infraestructura lista:**
- Campo `eventoExternoId` en tabla `clases` (para sincronización idempotente)
- Función `sincronizarConGoogleCalendar()` en `/src/lib/datos/calendario.ts`
- Función `crearEventoGoogleCalendar()` implementada con Google Calendar API
- Integración en acciones: crear clase, posponer, corregir
- Datos preparados: correos de docente y tutores

✅ **Implementación lista:**
- API de Google Calendar integrada (v3)
- Creación y actualización de eventos idempotente
- Soporte para múltiples tutores
- Invitaciones automáticas a docentes y tutores
- Manejo de errores sin bloquear creación de clases

⏳ **Pendiente:**
- Configurar credenciales de Google Calendar (token OAuth)

## Flujo Actual

Cuando se **agenda una clase**:

1. Sistema crea la clase en base de datos
2. Llama a `sincronizarConGoogleCalendar(claseId)` (en background)
3. Función:
   - Obtiene datos: alumno, docente, tutores, correos
   - Construye lista de asistentes (docente + tutores)
   - Genera ID único del evento: `batuta-clase-{claseId}`
   - ✅ **Llama a Google Calendar API** para crear/actualizar evento
   - Guarda en `clases.eventoExternoId`
   - Invita automáticamente a docentes y tutores
4. Si falla Google Calendar, la clase se crea igual en la BD

Cuando se **pospone o corrige** una clase:
- Se sincroniza el evento (actualiza hora, modalidad, asistentes)
- La API reconoce el ID del evento y lo actualiza (idempotente)

## Cómo Completar la Integración

### 1. Obtener Token de Google Calendar

La función `crearEventoGoogleCalendar()` está **lista y implementada**. Solo necesita el token de acceso OAuth 2.0.

**Opción A: Usar Cuenta de Servicio (recomendado para producción)**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto nuevo o seleccionar uno existente
3. Habilitar "Google Calendar API"
4. Crear credenciales → Cuenta de Servicio
5. Descargar JSON con las credenciales
6. Obtener el token de acceso (ver paso 2)

**Opción B: Usar OAuth 2.0 del usuario**

1. Si el usuario de VioliniStar ya tiene una cuenta Google
2. Obtener un token de acceso OAuth 2.0 con permisos en `calendar`
3. El token dura ~1 hora, implementar refresh si es necesario

### 2. Generar Token de Acceso

Con una cuenta de servicio:
```bash
# Usar la herramienta gcloud del Google Cloud SDK
gcloud auth application-default print-access-token
```

O usar una librería Node.js como `google-auth-library-nodejs`:
```typescript
const {GoogleAuth} = require('google-auth-library');
const auth = new GoogleAuth({
  keyFile: 'path/to/service-account-key.json',
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const accessToken = await auth.getAccessToken();
```

### 3. Configurar Variables de Entorno

En tu `.env.local` o en Railway:

```env
# Token de acceso OAuth 2.0 para Google Calendar API
GOOGLE_CALENDAR_TOKEN=ya29.a0AfH6SMBx...

# ID del calendario (opcional, por defecto "primary")
GOOGLE_CALENDAR_ID=academy@violinistar.com

# URL de la API (opcional, por defecto es la oficial)
GOOGLE_CALENDAR_API_URL=https://www.googleapis.com/calendar/v3
```

### 4. Compartir Calendario con la Cuenta de Servicio (si aplica)

1. Abrir Google Calendar
2. Buscar el calendario "VioliniStar Academia"
3. Configuración → Compartir con otros
4. Agregar correo de la cuenta de servicio: `tu-servicio@tu-proyecto.iam.gserviceaccount.com`
5. Permisos: "Cambiar eventos"

### 5. Probar la Integración

```bash
# Ver logs de sincronización:
docker logs batuta-app 2>&1 | grep "\[Calendario\]"

# Crear una clase de prueba en la interfaz
# Verificar que se cree el evento en Google Calendar
# Verificar que se envíen invitaciones al docente y tutores
```

### Implementación Actual

La función está **lista en `src/lib/datos/calendario.ts`**:

- ✅ Sincronización idempotente (create or update)
- ✅ Incluye docente + todos los tutores como asistentes
- ✅ Genera Google Meet automático
- ✅ Manejo de errores sin bloquear clases
- ✅ Timestamps en zona horaria México
- ✅ Logging detallado para debugging

## Estructura de Datos

### Correos que se incluyen:

- **Docente:** `docentes.email`
- **Tutor(es) del alumno:** `tutores.email` (puede haber múltiples)

### Información del evento:

| Campo | Valor | Ejemplo |
|-------|-------|---------|
| Título | `{Programa} - {Alumno} ({Docente})` | `Violín - Renata García (Emmanuel)` |
| Inicio | `clases.iniciaEn` | `2026-10-15 15:30:00` |
| Fin | Inicio + minutos | `2026-10-15 16:30:00` |
| Descripción | Modalidad + cubículo | `Presencial - Cubículo 2` |
| Asistentes | Docente + tutores | `maestro@email.com, papa@email.com` |

## Validaciones

✅ Ya implementadas:
- Verifica que docente tenga correo
- Verifica que haya al menos un asistente
- No lanza excepción si falla (no rompe el flujo)
- Registra en logs si hay errores

## Testing

Para probar sin Google Calendar:

```bash
# Ver logs de sincronización:
docker logs batuta-app 2>&1 | grep "\[Calendario\]"

# Verificar que eventoExternoId se guarda:
sqlite3 data/batuta.db "SELECT id, evento_externo_id FROM clases;"
```

## Campos en DB

```typescript
clases {
  eventoExternoId: text  // ID único del evento: "batuta-clase-{claseId}"
  iniciaEn: timestamp
  terminaEn: timestamp
  minutos: integer
  modalidad: "presencial" | "en_linea"
  aulaId: integer (nullable)
}
```

## Próximos Pasos

1. ✅ Infraestructura lista
2. ✅ Implementar `crearEventoGoogleCalendar()` con Google Calendar API v3
3. ✅ Integración en crear clase, posponer y corregir
4. ⏳ Obtener token OAuth 2.0 de Google Calendar
5. ⏳ Configurar `GOOGLE_CALENDAR_TOKEN` en variables de entorno
6. ⏳ Probar con evento real en producción
7. ⏳ Manejo de eliminación de eventos (cuando se cancela clase)
8. ⏳ Implementar refresh automático de tokens si caducan
