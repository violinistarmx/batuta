import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnosTutores, clases, docentes, inscripciones, tutores, alumnos,
} from "@/db/schema/index";

/**
 * Tipo para los datos del evento a crear en Google Calendar
 */
type EventoGoogleCalendar = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  description: string;
  location?: string;
};

/**
 * Datos de una clase necesarios para sincronizar con Google Calendar.
 *
 * Se obtienen en el contexto de la clase creada/modificada.
 */
export type DatosClaseParaCalendario = {
  claseId: number;
  iniciaEn: Date;
  minutos: number;
  inscripcionId: number;
  docenteId: number;
  alumnoId: number;
  modalidad: "presencial" | "en_linea";
  aulaId: number | null;
};

/**
 * Obtiene la información necesaria para crear un evento en Google Calendar.
 * Incluye correos de tutor(es) y docente.
 */
export function datosParaCalendario(claseId: number) {
  const clase = db.select({
    id: clases.id,
    iniciaEn: clases.iniciaEn,
    minutos: clases.minutos,
    inscripcionId: clases.inscripcionId,
    docenteId: clases.docenteId,
    modalidad: clases.modalidad,
    aulaId: clases.aulaId,
    alumnoId: inscripciones.alumnoId,
    alumnoNombre: alumnos.nombre,
    docenteNombre: docentes.nombre,
    docenteEmail: docentes.email,
  })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(eq(clases.id, claseId))
    .get();

  if (!clase) return null;

  // Obtener tutores del alumno
  const tutoresDelAlumno = db.select({
    email: tutores.email,
    nombre: tutores.nombre,
  })
    .from(alumnosTutores)
    .innerJoin(tutores, eq(tutores.id, alumnosTutores.tutorId))
    .where(eq(alumnosTutores.alumnoId, clase.alumnoId))
    .all();

  return {
    ...clase,
    docenteEmail: clase.docenteEmail,
    tutoresEmails: tutoresDelAlumno
      .filter((t) => t.email)
      .map((t) => ({ email: t.email!, nombre: t.nombre })),
  };
}

/**
 * Formato del titulo del evento en Google Calendar.
 *
 * Ejemplo: "Violin - Renata Garcia (Emmanuel Anizar)"
 */
function tituloEvento(alumno: string, programa: string, docente: string): string {
  return `${programa} - ${alumno} (${docente})`;
}

/**
 * Descripcion del evento en Google Calendar con detalles de la clase.
 */
function descripcionEvento(modalidad: string, aulaId: number | null): string {
  const modalidadStr = modalidad === "presencial" ? "Presencial" : "En linea";
  const ubicacion = aulaId ? ` - Cubiculo ${aulaId}` : "";
  return `${modalidadStr}${ubicacion}\n\nAgendado en VioliniStar Academia de Musica`;
}

/**
 * Obtiene la URL base de la API de Google Calendar.
 * Útil para testing y validación.
 */
function getCalendarApiUrl(): string {
  return process.env.GOOGLE_CALENDAR_API_URL ?? "https://www.googleapis.com/calendar/v3";
}

/**
 * Obtiene el ID del calendario de la academia.
 * Por defecto usa "primary" (calendario principal del usuario de la cuenta de servicio).
 */
function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

/**
 * Crea o actualiza un evento en Google Calendar.
 *
 * Utiliza la Google Calendar API v3 con credenciales de cuenta de servicio.
 * El token de acceso debe ser suministrado vía variable de entorno GOOGLE_CALENDAR_TOKEN.
 *
 * CONFIGURACIÓN NECESARIA:
 * 1. GOOGLE_CALENDAR_TOKEN: Token de acceso OAuth para la API de Google Calendar
 * 2. GOOGLE_CALENDAR_ID: ID del calendario (email o "primary")
 *
 * @param evento Datos del evento a crear/actualizar
 * @returns ID del evento creado o actualizado
 */
async function crearEventoGoogleCalendar(evento: EventoGoogleCalendar): Promise<string> {
  const token = process.env.GOOGLE_CALENDAR_TOKEN;
  if (!token) {
    console.warn(
      "[Calendario] GOOGLE_CALENDAR_TOKEN no configurado. "
      + "Configure la variable de entorno para sincronizar con Google Calendar."
    );
    // Retornar el ID local generado para poder hacer sync idempotente
    return evento.id;
  }

  const calendarId = getCalendarId();
  const apiUrl = getCalendarApiUrl();

  // Construir asistentes en formato de objetos para Google Calendar
  const attendees = evento.attendees.map((email) => ({
    email,
    responseStatus: "needsAction" as const,
  }));

  // Tiempo del evento en formato ISO 8601
  const startTime = evento.startTime.toISOString();
  const endTime = evento.endTime.toISOString();

  // Preparar el cuerpo de la solicitud
  const eventPayload = {
    id: evento.id,
    summary: evento.title,
    description: evento.description,
    location: evento.location,
    start: {
      dateTime: startTime,
      timeZone: "America/Mexico_City", // Zona horaria de México
    },
    end: {
      dateTime: endTime,
      timeZone: "America/Mexico_City",
    },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: evento.id,
        conferenceSolutionKey: {
          key: "hangoutsMeet",
        },
      },
    },
  };

  try {
    // Primero intentar actualizar (en caso de que ya exista)
    const updateUrl = `${apiUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(evento.id)}`;
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    if (updateResponse.ok) {
      const updatedEvent = await updateResponse.json() as { id: string };
      console.log(`[Calendario] Evento ${evento.id} actualizado en Google Calendar`);
      return updatedEvent.id;
    }

    // Si no existe (404), crear uno nuevo
    if (updateResponse.status === 404) {
      const createUrl = `${apiUrl}/calendars/${encodeURIComponent(calendarId)}/events?supportsAttachments=true&sendUpdates=all`;
      const createResponse = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      });

      if (createResponse.ok) {
        const createdEvent = await createResponse.json() as { id: string };
        console.log(`[Calendario] Evento ${evento.id} creado en Google Calendar`);
        return createdEvent.id;
      }

      throw new Error(
        `Error creando evento: ${createResponse.status} ${createResponse.statusText}`
      );
    }

    throw new Error(
      `Error actualizando evento: ${updateResponse.status} ${updateResponse.statusText}`
    );
  } catch (error) {
    console.error(`[Calendario] Error sincronizando evento ${evento.id}:`, error);
    // No lanzar excepción: si falla Google Calendar, la clase ya existe en la BD
    // Retornamos el ID local para poder reintentar después si es necesario
    return evento.id;
  }
}

/**
 * Sincroniza una clase con Google Calendar.
 *
 * Crea un evento si no existe, o lo actualiza si ya existe.
 * Invita automaticamente al docente y a los tutores del alumno.
 *
 * IMPORTANTE: Esta funcion requiere que Google Calendar este conectado
 * en la configuracion de la academia (correo y credenciales).
 *
 * Se implementa como una tarea diferida: se intenta pero no detiene
 * el flujo de creacion de la clase si falla.
 */
export async function sincronizarConGoogleCalendar(claseId: number): Promise<string | null> {
  try {
    const datos = datosParaCalendario(claseId);
    if (!datos) {
      console.warn(`[Calendario] Clase ${claseId} no encontrada`);
      return null;
    }

    // Validar que tengamos al menos el correo del docente
    if (!datos.docenteEmail) {
      console.warn(`[Calendario] Docente sin correo, evento no creado para clase ${claseId}`);
      return null;
    }

    // Construir asistentes
    const asistentes = construirAsistentes(datos);
    if (asistentes.length === 0) {
      console.warn(`[Calendario] Sin asistentes de correo para clase ${claseId}`);
      return null;
    }

    // Calcular hora de termino
    const terminaEn = new Date(datos.iniciaEn.getTime() + datos.minutos * 60_000);

    // El ID del evento se genera aqui y se guarda para futuras sincronizaciones
    const eventoId = `batuta-clase-${claseId}`;

    // Nombre del programa (por defecto "Música")
    const nombrePrograma = "Música";
    const ubicacionAula = datos.aulaId ? `Cubículo ${datos.aulaId}` : "En línea";

    // Crear el evento en Google Calendar (idempotente: crea o actualiza)
    await crearEventoGoogleCalendar({
      id: eventoId,
      title: tituloEvento(datos.alumnoNombre, nombrePrograma, datos.docenteNombre),
      startTime: datos.iniciaEn,
      endTime: terminaEn,
      attendees: asistentes,
      description: descripcionEvento(datos.modalidad, datos.aulaId),
      location: datos.modalidad === "presencial" ? ubicacionAula : undefined,
    });

    // Guardar el ID del evento en la base de datos para futuras referencias
    db.update(clases)
      .set({ eventoExternoId: eventoId })
      .where(eq(clases.id, claseId))
      .run();

    console.log(`[Calendario] Evento ${eventoId} sincronizado para clase ${claseId}`);
    return eventoId;
  } catch (error) {
    console.error(`[Calendario] Error sincronizando clase ${claseId}:`, error);
    // No lanzar excepcion: la creacion de la clase es lo importante
    return null;
  }
}

/**
 * Construye los asistentes del evento para Google Calendar.
 *
 * Retorna un arreglo de direcciones de correo.
 */
export function construirAsistentes(datos: ReturnType<typeof datosParaCalendario>) {
  if (!datos) return [];

  const asistentes: string[] = [];

  // Agregar docente
  if (datos.docenteEmail) {
    asistentes.push(datos.docenteEmail);
  }

  // Agregar tutores
  datos.tutoresEmails.forEach((t) => {
    if (t.email) asistentes.push(t.email);
  });

  return asistentes;
}
