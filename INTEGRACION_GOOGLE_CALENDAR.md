# Integración Google Calendar - Batuta

## Estado Actual

✅ **Infraestructura lista:**
- Campo `eventoExternoId` en tabla `clases` (para sincronización idempotente)
- Función `sincronizarConGoogleCalendar()` en `/src/lib/datos/calendario.ts`
- Integración en acciones: crear clase, posponer, corregir
- Datos preparados: correos de docente y tutores

⏳ **Pendiente:**
- Implementación real de `crearEventoGoogleCalendar()` usando Google Calendar API

## Flujo Actual

Cuando se **agenda una clase**:

1. Sistema crea la clase en base de datos
2. Llama a `sincronizarConGoogleCalendar(claseId)`
3. Función:
   - Obtiene datos: alumno, docente, tutores, correos
   - Construye lista de asistentes (docente + tutores)
   - Genera ID único del evento: `batuta-clase-{claseId}`
   - Guarda en `clases.eventoExternoId`
   - **AQUÍ IRÍA LA LLAMADA A GOOGLE CALENDAR API** ← TODO

Cuando se **pospone o corrige** una clase:
- Se sincroniza el evento (actualiza hora, modalidad, asistentes)

## Cómo Completar la Integración

### 1. Configurar Google Calendar API

```typescript
// En tu proyecto Google Cloud:
// 1. Crear credenciales OAuth 2.0 (Cuenta de Servicio)
// 2. Descargar JSON de credenciales
// 3. Compartir calendario con correo de la cuenta de servicio
// 4. Guardar credenciales como variable de entorno
```

### 2. Implementar función de creación de evento

```typescript
// En src/lib/datos/calendario.ts
async function crearEventoGoogleCalendar(datos: {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  description: string;
}): Promise<string> {
  // Usar Google Calendar API SDK o MCP tool
  // Retornar googleCalendarEventId
}
```

### 3. Usar MCP Tool de Google Calendar

Si usas el MCP tool disponible (`mcp__Google_Calendar__*`):

```typescript
// Pseudocódigo:
const event = await mcp_create_event({
  calendar_id: "academy@googlecalendar.com",
  event: {
    summary: titulo,
    start: { dateTime: iniciaEn },
    end: { dateTime: terminaEn },
    attendees: asistentes.map(email => ({ email })),
    description: descripcion,
  },
});

return event.id;
```

### 4. Completar la sincronización en `sincronizarConGoogleCalendar()`

Reemplazar este comentario:

```typescript
// TODO: Integrar con Google Calendar API cuando la configuracion este lista
// Por ahora, solo almacenamos la intencion
```

Por la llamada real:

```typescript
const evento = await crearEventoGoogleCalendar({
  id: eventoId,
  title: tituloEvento(datos.alumnoNombre, programa, datos.docenteNombre),
  startTime: datos.iniciaEn,
  endTime: terminaEn,
  attendees: asistentes,
  description: descripcionEvento(datos.modalidad, datos.aulaId),
});
```

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
2. ⏳ Configurar Google Calendar API
3. ⏳ Implementar `crearEventoGoogleCalendar()`
4. ⏳ Probar con evento real
5. ⏳ Agregar sincronización de cambios (posponer, corregir)
6. ⏳ Manejo de eliminación de eventos (cuando se cancela clase)
