import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, alumnosTutores, cargos, ciclos, clases, configuracion, docentes,
  inscripciones, mensajes, plantillas, programas, prospectos, tutores, usuarios,
} from "@/db/schema/index";
import {
  motivoParaNoEnviar, motivoParaRechazarTransicion, renderizar,
  type EstadoMensaje,
} from "@/lib/dominio/plantillas";
import { pesos } from "@/lib/formato";
import { fechaCivil, horaCivil } from "@/lib/zona";

export function plantillasActivas() {
  return db.select().from(plantillas).where(eq(plantillas.activa, true))
    .orderBy(asc(plantillas.orden)).all();
}

export function plantillaPorClave(clave: string) {
  return db.select().from(plantillas).where(eq(plantillas.clave, clave)).get();
}

/** Parámetros de la academia disponibles en toda plantilla. */
function datosDeLaAcademia(): Record<string, string> {
  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );
  return {
    academia: String(cfg.academia_nombre ?? "Academia de Música VioliniStar"),
    horas_aviso: String(cfg.horas_aviso_posposicion ?? 24),
    dias_credencial: String(cfg.dias_entrega_credencial ?? 7),
    domicilio: String(cfg.academia_domicilio ?? ""),
    telefono_academia: String(cfg.academia_telefono ?? ""),
  };
}

export type Contexto = {
  destinatario: string;
  telefono: string | null;
  datos: Record<string, string | null>;
};

/**
 * Reúne los datos de un alumno para llenar una plantilla.
 *
 * El destinatario es el tutor responsable de pago si existe; si no, el alumno
 * mayor de edad. Mandarle a un niño de siete años el aviso de adeudo es un error
 * que no debe depender de que alguien se acuerde.
 */
export function contextoDeAlumno(alumnoId: number): Contexto | null {
  const a = db.select({
    id: alumnos.id,
    nombre: alumnos.nombre,
    telefono: alumnos.telefono,
    fechaNacimiento: alumnos.fechaNacimiento,
  }).from(alumnos).where(eq(alumnos.id, alumnoId)).get();
  if (!a) return null;

  const tutor = db.select({
    nombre: tutores.nombre,
    telefono: tutores.telefono,
    whatsapp: tutores.whatsapp,
  })
    .from(alumnosTutores)
    .innerJoin(tutores, eq(tutores.id, alumnosTutores.tutorId))
    .where(eq(alumnosTutores.alumnoId, alumnoId))
    .orderBy(desc(alumnosTutores.esResponsablePago))
    .get();

  const insc = db.select({
    programa: programas.nombre,
    docente: docentes.nombre,
    terminaEl: ciclos.terminaEl,
  })
    .from(inscripciones)
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(docentes, eq(docentes.id, inscripciones.docenteId))
    .leftJoin(ciclos, and(eq(ciclos.inscripcionId, inscripciones.id), eq(ciclos.estado, "abierto")))
    .where(and(eq(inscripciones.alumnoId, alumnoId), eq(inscripciones.estado, "activa")))
    .get();

  const proxima = db.select({ iniciaEn: clases.iniciaEn, docente: docentes.nombre })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(and(eq(inscripciones.alumnoId, alumnoId), eq(clases.estado, "programada")))
    .orderBy(asc(clases.iniciaEn))
    .get();

  const adeudo = db.select({
    descripcion: cargos.descripcion,
    venceEl: cargos.venceEl,
    monto: cargos.montoCentavos,
    aplicado: sql<number>`coalesce((
      SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
    ), 0)`,
  })
    .from(cargos)
    .where(and(eq(cargos.alumnoId, alumnoId), eq(cargos.cancelado, false)))
    .orderBy(asc(cargos.venceEl))
    .all()
    .find((c) => c.monto - c.aplicado > 0);

  return {
    destinatario: tutor?.nombre ?? a.nombre,
    telefono: tutor?.whatsapp ?? tutor?.telefono ?? a.telefono,
    datos: {
      ...datosDeLaAcademia(),
      tutor: tutor?.nombre ?? a.nombre,
      alumno: a.nombre,
      programa: insc?.programa ?? null,
      maestro: proxima?.docente ?? insc?.docente ?? null,
      fecha: proxima ? fechaCivil(proxima.iniciaEn) : null,
      hora: proxima ? horaCivil(proxima.iniciaEn) : null,
      termina: insc?.terminaEl ?? null,
      concepto: adeudo?.descripcion ?? null,
      monto: adeudo ? pesos(adeudo.monto - adeudo.aplicado) : null,
      vence: adeudo?.venceEl ?? null,
    },
  };
}

export function contextoDeProspecto(prospectoId: number): Contexto | null {
  const p = db.select({
    nombre: prospectos.nombre,
    contactoNombre: prospectos.contactoNombre,
    telefono: prospectos.telefono,
    whatsapp: prospectos.whatsapp,
    claseMuestraEl: prospectos.claseMuestraEl,
    claseMuestraHora: prospectos.claseMuestraHora,
    programa: programas.nombre,
  })
    .from(prospectos)
    .leftJoin(programas, eq(programas.id, prospectos.programaInteresId))
    .where(eq(prospectos.id, prospectoId)).get();
  if (!p) return null;

  return {
    destinatario: p.contactoNombre ?? p.nombre,
    telefono: p.whatsapp ?? p.telefono,
    datos: {
      ...datosDeLaAcademia(),
      contacto: p.contactoNombre ?? p.nombre,
      nombre: p.nombre,
      alumno: p.nombre,
      tutor: p.contactoNombre ?? p.nombre,
      programa: p.programa ?? null,
      fecha: p.claseMuestraEl,
      hora: p.claseMuestraHora,
      // `mensaje` es el texto libre que escribe quien redacta.
      mensaje: null,
    },
  };
}

export type Borrador = {
  plantillaId: number | null;
  alumnoId: number | null;
  prospectoId: number | null;
  destinatario: string;
  telefono: string | null;
  canal: "whatsapp" | "correo" | "sms";
  asunto: string | null;
  cuerpo: string;
};

/**
 * Guarda un borrador, negándose si el texto todavía tiene huecos.
 *
 * Es la puerta que impide que llegue a la bandeja de aprobación un mensaje que
 * dice «Hola {{tutor}}». Si el hueco no se puede llenar, el mensaje no existe
 * todavía; aprobarlo sería aprobar un error.
 */
export function crearBorrador(b: Borrador, usuarioId: number): number {
  const motivo = motivoParaNoEnviar(b.cuerpo, b.telefono);
  if (motivo) throw new Error(motivo);

  const fila = db.insert(mensajes).values({ ...b, redactadoPor: usuarioId })
    .returning({ id: mensajes.id }).get();
  if (!fila) throw new Error("No se pudo guardar el borrador.");
  return fila.id;
}

/** Renderiza una plantilla con el contexto de un alumno o prospecto. */
export function prepararDesdePlantilla(
  plantillaId: number,
  origen: { alumnoId?: number; prospectoId?: number },
  extra: Record<string, string> = {},
) {
  const pl = db.select().from(plantillas).where(eq(plantillas.id, plantillaId)).get();
  if (!pl) throw new Error("La plantilla no existe.");

  const ctx = origen.alumnoId
    ? contextoDeAlumno(origen.alumnoId)
    : origen.prospectoId
      ? contextoDeProspecto(origen.prospectoId)
      : null;
  if (!ctx) throw new Error("No se encontró a quién dirigir el mensaje.");

  const r = renderizar(pl.cuerpo, { ...ctx.datos, ...extra });
  return { plantilla: pl, contexto: ctx, ...r };
}

export function mensajePorId(id: number) {
  return db.select({
    id: mensajes.id,
    alumnoId: mensajes.alumnoId,
    prospectoId: mensajes.prospectoId,
    destinatario: mensajes.destinatario,
    telefono: mensajes.telefono,
    canal: mensajes.canal,
    asunto: mensajes.asunto,
    cuerpo: mensajes.cuerpo,
    estado: mensajes.estado,
    motivoRechazo: mensajes.motivoRechazo,
    creadoEn: mensajes.creadoEn,
    aprobadoEn: mensajes.aprobadoEn,
    enviadoEn: mensajes.enviadoEn,
    notaEnvio: mensajes.notaEnvio,
    plantilla: plantillas.nombre,
    redactor: usuarios.nombre,
  })
    .from(mensajes)
    .leftJoin(plantillas, eq(plantillas.id, mensajes.plantillaId))
    .leftJoin(usuarios, eq(usuarios.id, mensajes.redactadoPor))
    .where(eq(mensajes.id, id))
    .get();
}

export function listarMensajes(estado?: EstadoMensaje) {
  const q = db.select({
    id: mensajes.id,
    destinatario: mensajes.destinatario,
    telefono: mensajes.telefono,
    canal: mensajes.canal,
    cuerpo: mensajes.cuerpo,
    estado: mensajes.estado,
    creadoEn: mensajes.creadoEn,
    plantilla: plantillas.nombre,
    redactor: usuarios.nombre,
    alumnoId: mensajes.alumnoId,
    prospectoId: mensajes.prospectoId,
  })
    .from(mensajes)
    .leftJoin(plantillas, eq(plantillas.id, mensajes.plantillaId))
    .leftJoin(usuarios, eq(usuarios.id, mensajes.redactadoPor));

  return (estado ? q.where(eq(mensajes.estado, estado)) : q)
    .orderBy(desc(mensajes.creadoEn))
    .limit(100)
    .all();
}

export function cuentaPorEstado(): Record<EstadoMensaje, number> {
  const base: Record<EstadoMensaje, number> = {
    borrador: 0, aprobado: 0, rechazado: 0, enviado: 0, cancelado: 0,
  };
  for (const f of db.select({ estado: mensajes.estado, n: sql<number>`count(*)` })
    .from(mensajes).groupBy(mensajes.estado).all()) {
    base[f.estado as EstadoMensaje] = f.n;
  }
  return base;
}

/**
 * Mueve un mensaje de estado, comprobando la regla dentro de la transacción.
 *
 * `aprobar` y `enviar` son actos distintos y quedan con sello propio: quién aprobó
 * y cuándo, quién marcó el envío y cuándo. Juntarlos en un solo campo haría
 * imposible responder «¿quién autorizó esto?» cuando un tutor reclame.
 */
export function moverMensaje(
  id: number,
  hacia: EstadoMensaje,
  usuarioId: number,
  extra: { motivoRechazo?: string | null; notaEnvio?: string | null } = {},
): void {
  db.transaction((tx) => {
    const m = tx.select({
      estado: mensajes.estado,
      cuerpo: mensajes.cuerpo,
      telefono: mensajes.telefono,
    }).from(mensajes).where(eq(mensajes.id, id)).get();
    if (!m) throw new Error("El mensaje no existe.");

    const motivo = motivoParaRechazarTransicion(m.estado as EstadoMensaje, hacia);
    if (motivo) throw new Error(motivo);

    if (hacia === "rechazado" && !extra.motivoRechazo) {
      throw new Error("Un rechazo sin motivo no le sirve a quien tiene que corregirlo.");
    }

    // Se revalida el texto justo antes de aprobar: entre redactar y aprobar pudo
    // editarse, y lo que se autoriza es lo que va a salir.
    if (hacia === "aprobado") {
      const problema = motivoParaNoEnviar(m.cuerpo, m.telefono);
      if (problema) throw new Error(problema);
    }

    tx.update(mensajes).set({
      estado: hacia,
      ...(hacia === "rechazado" ? { motivoRechazo: extra.motivoRechazo ?? null } : {}),
      ...(hacia === "borrador" ? { motivoRechazo: null } : {}),
      ...(hacia === "aprobado" ? { aprobadoPor: usuarioId, aprobadoEn: new Date() } : {}),
      ...(hacia === "enviado"
        ? { enviadoPor: usuarioId, enviadoEn: new Date(), notaEnvio: extra.notaEnvio ?? null }
        : {}),
    }).where(eq(mensajes.id, id)).run();
  });
}

export function editarBorrador(id: number, cuerpo: string, telefono: string | null): void {
  const m = db.select({ estado: mensajes.estado }).from(mensajes)
    .where(eq(mensajes.id, id)).get();
  if (!m) throw new Error("El mensaje no existe.");
  if (m.estado !== "borrador" && m.estado !== "rechazado") {
    throw new Error("Solo se edita un borrador: lo aprobado ya no cambia.");
  }

  const motivo = motivoParaNoEnviar(cuerpo, telefono);
  if (motivo) throw new Error(motivo);

  db.update(mensajes).set({ cuerpo, telefono, estado: "borrador", motivoRechazo: null })
    .where(eq(mensajes.id, id)).run();
}

/** Mensajes de un alumno, para su expediente. */
export function mensajesDeAlumno(alumnoId: number) {
  return db.select({
    id: mensajes.id,
    destinatario: mensajes.destinatario,
    estado: mensajes.estado,
    cuerpo: mensajes.cuerpo,
    creadoEn: mensajes.creadoEn,
    enviadoEn: mensajes.enviadoEn,
    plantilla: plantillas.nombre,
  })
    .from(mensajes)
    .leftJoin(plantillas, eq(plantillas.id, mensajes.plantillaId))
    .where(eq(mensajes.alumnoId, alumnoId))
    .orderBy(desc(mensajes.creadoEn))
    .limit(20)
    .all();
}
