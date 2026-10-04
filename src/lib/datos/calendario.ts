import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnosTutores, clases, docentes, inscripciones, tutores, alumnos,
} from "@/db/schema/index";

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

    // TODO: Integrar con Google Calendar API cuando la configuracion este lista
    // Por ahora, solo almacenamos la intencion
    // await crearEventoGoogleCalendar({
    //   id: eventoId,
    //   title: tituloEvento(datos.alumnoNombre, ...),
    //   startTime: datos.iniciaEn,
    //   endTime: terminaEn,
    //   attendees: asistentes,
    //   description: descripcionEvento(datos.modalidad, datos.aulaId),
    // });

    // Guardar el ID del evento en la base de datos
    db.update(clases)
      .set({ eventoExternoId: eventoId })
      .where(eq(clases.id, claseId))
      .run();

    console.log(`[Calendario] Evento ${eventoId} preparado para clase ${claseId}`);
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
