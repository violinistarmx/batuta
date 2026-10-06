import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnosTutores, clases, docentes, inscripciones, tutores, alumnos, programas,
} from "@/db/schema/index";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type EventoGoogleCalendar = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  description: string;
  location?: string;
};

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

// ─── Helpers de configuración ────────────────────────────────────────────────

function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

// ─── Obtención de access token con refresh token ─────────────────────────────

/**
 * Obtiene un access token vigente usando el refresh token almacenado en
 * GOOGLE_REFRESH_TOKEN (junto con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).
 *
 * El refresh token no expira (salvo revocación). El access token que devuelve
 * dura 1 hora, pero aquí lo pedimos fresco en cada llamada para no cachear
 * un token vencido entre deploys.
 */
async function obtenerAccessToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    console.warn(
      "[Calendario] Faltan variables de entorno para Google Calendar. "
      + "Necesitas: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN."
    );
    return null;
  }

  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[Calendario] Error obteniendo token: ${resp.status} ${body}`);
      return null;
    }

    const data = await resp.json() as { access_token: string };
    return data.access_token;
  } catch (err) {
    console.error("[Calendario] Error al renovar el access token:", err);
    return null;
  }
}

// ─── Datos de la clase ────────────────────────────────────────────────────────

/**
 * Obtiene la información necesaria para crear un evento en Google Calendar.
 * Incluye correos del docente y de los tutores del alumno.
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
    programaNombre: programas.nombre,
  })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .where(eq(clases.id, claseId))
    .get();

  if (!clase) return null;

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
    tutoresEmails: tutoresDelAlumno
      .filter((t: { email: string | null; nombre: string }) => t.email)
      .map((t: { email: string | null; nombre: string }) => ({ email: t.email!, nombre: t.nombre })),
  };
}

// ─── Formato del evento ───────────────────────────────────────────────────────

function tituloEvento(alumno: string, programa: string, docente: string): string {
  return `${programa} · ${alumno} (${docente})`;
}

function descripcionEvento(
  alumno: string,
  programa: string,
  docente: string,
  modalidad: string,
  aulaId: number | null,
): string {
  const mod = modalidad === "presencial" ? "Presencial" : "En línea";
  const lugar = aulaId ? `Cubículo ${aulaId}` : "Sin cubículo asignado";
  return [
    `Alumno: ${alumno}`,
    `Programa: ${programa}`,
    `Maestro: ${docente}`,
    `Modalidad: ${mod}`,
    modalidad === "presencial" ? `Lugar: ${lugar}` : "",
    "",
    "Agendado en Batuta · VioliniStar Academia de Música",
  ].filter((l) => l !== undefined).join("\n");
}

// ─── API de Google Calendar ───────────────────────────────────────────────────

async function crearOActualizarEvento(
  evento: EventoGoogleCalendar,
  token: string,
): Promise<string> {
  const calendarId = getCalendarId();
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    id: evento.id,
    summary: evento.title,
    description: evento.description,
    location: evento.location,
    start: { dateTime: evento.startTime.toISOString(), timeZone: "America/Mexico_City" },
    end: { dateTime: evento.endTime.toISOString(), timeZone: "America/Mexico_City" },
    attendees: evento.attendees.map((email) => ({ email, responseStatus: "needsAction" })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 30 },
      ],
    },
    guestsCanSeeOtherGuests: false,
    sendUpdates: "all",
  });

  // Intentar actualizar primero (idempotente)
  const putResp = await fetch(`${base}/${encodeURIComponent(evento.id)}?sendUpdates=all`, {
    method: "PUT",
    headers,
    body,
  });

  if (putResp.ok) {
    const data = await putResp.json() as { id: string };
    console.log(`[Calendario] Evento actualizado: ${evento.id}`);
    return data.id;
  }

  if (putResp.status === 404) {
    // El evento no existe, crearlo
    const postResp = await fetch(`${base}?sendUpdates=all`, {
      method: "POST",
      headers,
      body,
    });

    if (postResp.ok) {
      const data = await postResp.json() as { id: string };
      console.log(`[Calendario] Evento creado: ${evento.id}`);
      return data.id;
    }

    const err = await postResp.text();
    throw new Error(`Error creando evento (${postResp.status}): ${err}`);
  }

  const err = await putResp.text();
  throw new Error(`Error actualizando evento (${putResp.status}): ${err}`);
}

// ─── Función pública ──────────────────────────────────────────────────────────

/**
 * Sincroniza una clase con Google Calendar.
 *
 * - Obtiene un access token fresco vía refresh token.
 * - Crea o actualiza el evento, enviando invitaciones al docente y tutores.
 * - Guarda el ID del evento en clases.evento_externo_id.
 * - Si falla, registra el error en consola pero NO detiene la creación de la clase.
 *
 * Variables de entorno requeridas:
 *   GOOGLE_CLIENT_ID      — Client ID de la app OAuth
 *   GOOGLE_CLIENT_SECRET  — Client secret de la app OAuth
 *   GOOGLE_REFRESH_TOKEN  — Refresh token obtenido una vez por OAuth
 *   GOOGLE_CALENDAR_ID    — ID del calendario (email o "primary")
 */
export async function sincronizarConGoogleCalendar(claseId: number): Promise<string | null> {
  try {
    const datos = datosParaCalendario(claseId);
    if (!datos) {
      console.warn(`[Calendario] Clase ${claseId} no encontrada`);
      return null;
    }

    if (!datos.docenteEmail) {
      console.warn(`[Calendario] Docente sin correo — clase ${claseId} no sincronizada`);
      return null;
    }

    const token = await obtenerAccessToken();
    if (!token) return null;

    const asistentes = construirAsistentes(datos);
    const terminaEn = new Date(datos.iniciaEn.getTime() + datos.minutos * 60_000);
    // Google Calendar solo acepta IDs con caracteres [a-v0-9], 5-1024 chars
    const eventoId = `batutaclase${claseId}x`;

    await crearOActualizarEvento({
      id: eventoId,
      title: tituloEvento(datos.alumnoNombre, datos.programaNombre, datos.docenteNombre),
      startTime: datos.iniciaEn,
      endTime: terminaEn,
      attendees: asistentes,
      description: descripcionEvento(
        datos.alumnoNombre,
        datos.programaNombre,
        datos.docenteNombre,
        datos.modalidad,
        datos.aulaId,
      ),
      location: datos.modalidad === "presencial" && datos.aulaId
        ? `Cubículo ${datos.aulaId} — VioliniStar`
        : undefined,
    }, token);

    db.update(clases)
      .set({ eventoExternoId: eventoId })
      .where(eq(clases.id, claseId))
      .run();

    return eventoId;
  } catch (error) {
    console.error(`[Calendario] Error sincronizando clase ${claseId}:`, error);
    return null;
  }
}

/**
 * Construye la lista de correos para el evento.
 */
export function construirAsistentes(datos: ReturnType<typeof datosParaCalendario>): string[] {
  if (!datos) return [];
  const lista: string[] = [];
  if (datos.docenteEmail) lista.push(datos.docenteEmail);
  datos.tutoresEmails.forEach((t: { email: string; nombre: string }) => lista.push(t.email));
  return lista;
}
