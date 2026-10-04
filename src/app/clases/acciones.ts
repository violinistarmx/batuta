"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { ciclos, configuracion } from "@/db/schema/index";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  clasePorId, conflictosDe, corregirClase, crearClase, posponerClase, registrarAsistencia,
} from "@/lib/datos/clases";
import { inscripcionPorId } from "@/lib/datos/inscripciones";
import { describirConflicto } from "@/lib/dominio/conflictos";
import { horaCivil, instanteEnMexico } from "@/lib/zona";

function parametros() {
  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );
  return {
    horasAvisoPosposicion: Number(cfg.horas_aviso_posposicion ?? 24),
    maxPosposicionesPorCiclo: Number(cfg.max_posposiciones_por_ciclo ?? 2),
  };
}

// ---------------------------------------------------------------- agendar ---

const Agendar = z.object({
  inscripcionId: z.coerce.number().int().positive(),
  cicloId: z.coerce.number().int().positive(),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  hora: z.string().trim().regex(/^\d{2}:\d{2}$/, "Elige la hora."),
  aulaId: z.coerce.number().int().nonnegative(),
  modalidad: z.enum(["presencial", "en_linea"]),
});

export type EstadoAgendar = { error?: string; conflictos?: string[] };

export async function agendar(
  _previo: EstadoAgendar,
  datos: FormData,
): Promise<EstadoAgendar> {
  const sesion = await exigirPermiso("clases.crear");

  const parsed = Agendar.safeParse({
    inscripcionId: datos.get("inscripcionId"),
    cicloId: datos.get("cicloId"),
    fecha: datos.get("fecha"),
    hora: datos.get("hora"),
    aulaId: datos.get("aulaId") || "0",
    modalidad: datos.get("modalidad") ?? "presencial",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  const insc = inscripcionPorId(d.inscripcionId, alcanceDe(sesion));
  if (!insc) return { error: "No se encontró la inscripción." };

  const ciclo = db.select().from(ciclos).where(eq(ciclos.id, d.cicloId)).get();
  if (!ciclo || ciclo.inscripcionId !== d.inscripcionId) {
    return { error: "El período no corresponde a esta inscripción." };
  }

  const iniciaEn = instanteEnMexico(d.fecha, d.hora);
  const aulaId = d.modalidad === "en_linea" ? null : (d.aulaId || null);

  if (d.modalidad === "presencial" && !aulaId) {
    return { error: "Una clase presencial necesita cubículo." };
  }

  const choques = conflictosDe({
    inscripcionId: d.inscripcionId,
    alumnoId: insc.alumnoId,
    docenteId: insc.docenteId,
    aulaId,
    iniciaEn,
    minutos: ciclo.minutosPorClase,
  });

  if (choques.length > 0) {
    return {
      error: "Hay un choque de horario.",
      conflictos: choques.map((c) => describirConflicto(c, horaCivil)),
    };
  }

  const claseId = crearClase({
    inscripcionId: d.inscripcionId,
    cicloId: ciclo.id,
    docenteId: insc.docenteId,
    aulaId,
    iniciaEn,
    minutos: ciclo.minutosPorClase,
    modalidad: d.modalidad,
  });

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "clase.crear",
    entidad: "clases",
    entidadId: claseId,
    cambios: { inscripcionId: d.inscripcionId, iniciaEn: iniciaEn.toISOString(), modalidad: d.modalidad },
  });

  revalidatePath(`/inscripciones/${d.inscripcionId}`);
  revalidatePath("/agenda");
  return {};
}

// ------------------------------------------------------------- asistencia ---

const Asistencia = z.object({
  claseId: z.coerce.number().int().positive(),
  estado: z.enum(["asistio", "falta", "falta_justificada", "cancelada"]),
  observaciones: z.string().trim().max(500).transform((s) => (s === "" ? null : s)),
});

export type EstadoAsistencia = { error?: string; ok?: string };

export async function marcarAsistencia(
  _previo: EstadoAsistencia,
  datos: FormData,
): Promise<EstadoAsistencia> {
  const sesion = await exigirPermiso("asistencia.registrar");

  const parsed = Asistencia.safeParse({
    claseId: datos.get("claseId"),
    estado: datos.get("estado"),
    observaciones: datos.get("observaciones") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  const clase = clasePorId(d.claseId, alcanceDe(sesion));
  if (!clase) return { error: "No se encontró la clase." };

  let resultado: { anterior: string; movimiento: number };
  try {
    resultado = registrarAsistencia(d.claseId, d.estado, sesion.usuarioId, d.observaciones);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "clase.asistencia",
    entidad: "clases",
    entidadId: d.claseId,
    cambios: { estado: [resultado.anterior, d.estado], movimientoCreditos: resultado.movimiento },
  });

  revalidatePath(`/clases/${d.claseId}`);
  revalidatePath(`/inscripciones/${clase.inscripcionId}`);
  revalidatePath("/agenda");

  return {
    ok: resultado.movimiento === 0
      ? "Registrado. El saldo de clases no cambió."
      : `Registrado. El saldo se movió en ${resultado.movimiento > 0 ? "+" : ""}${resultado.movimiento}.`,
  };
}

// ------------------------------------------------------------- posponer ---

const Posponer = z.object({
  claseId: z.coerce.number().int().positive(),
  avisoFecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica cuándo avisó el tutor."),
  avisoHora: z.string().trim().regex(/^\d{2}:\d{2}$/, "Indica la hora del aviso."),
  nuevaFecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la nueva fecha."),
  nuevaHora: z.string().trim().regex(/^\d{2}:\d{2}$/, "Elige la nueva hora."),
  canal: z.enum(["whatsapp", "telefono", "presencial", "correo", "otro"]),
  autorizar: z.boolean(),
  motivoExcepcion: z.string().trim().max(300).transform((s) => (s === "" ? null : s)),
});

export type EstadoPosponer = { error?: string; requiereAutorizacion?: boolean; conflictos?: string[] };

export async function posponer(
  _previo: EstadoPosponer,
  datos: FormData,
): Promise<EstadoPosponer> {
  const sesion = await exigirPermiso("clases.reprogramar");

  const parsed = Posponer.safeParse({
    claseId: datos.get("claseId"),
    avisoFecha: datos.get("avisoFecha"),
    avisoHora: datos.get("avisoHora"),
    nuevaFecha: datos.get("nuevaFecha"),
    nuevaHora: datos.get("nuevaHora"),
    canal: datos.get("canal") ?? "whatsapp",
    autorizar: datos.get("autorizar") === "on",
    motivoExcepcion: datos.get("motivoExcepcion") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  const clase = clasePorId(d.claseId, alcanceDe(sesion));
  if (!clase) return { error: "No se encontró la clase." };

  // Autorizar la excepción es facultad del director: un docente o un asistente
  // no pueden saltarse el umbral de la cláusula 4ª por su cuenta.
  if (d.autorizar) {
    await exigirPermiso("clases.autorizar_excepcion");
    if (!d.motivoExcepcion) {
      return { error: "Para autorizar fuera de plazo hace falta escribir el motivo." };
    }
  }

  const avisoEn = instanteEnMexico(d.avisoFecha, d.avisoHora);
  const nueva = instanteEnMexico(d.nuevaFecha, d.nuevaHora);

  const choques = conflictosDe({
    inscripcionId: clase.inscripcionId,
    alumnoId: clase.alumnoId,
    docenteId: clase.docenteId,
    aulaId: clase.modalidad === "en_linea" ? null : clase.aulaId,
    iniciaEn: nueva,
    minutos: clase.minutos,
    excluirClaseId: clase.id,
  });
  if (choques.length > 0) {
    return {
      error: "La nueva fecha choca con otra clase.",
      conflictos: choques.map((c) => describirConflicto(c, horaCivil)),
    };
  }

  const r = posponerClase(
    d.claseId, avisoEn, nueva, sesion.usuarioId,
    { autorizar: d.autorizar, motivoExcepcion: d.motivoExcepcion ?? undefined, canal: d.canal },
    parametros(),
  );

  if (!r.ok) {
    return { error: r.razon, requiereAutorizacion: r.requiereAutorizacion };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: d.autorizar ? "clase.autorizar_excepcion" : "clase.reprogramar",
    entidad: "clases",
    entidadId: d.claseId,
    cambios: {
      recuperacionId: r.claseRecuperacionId,
      avisoEn: avisoEn.toISOString(),
      nuevaFecha: nueva.toISOString(),
      canal: d.canal,
      motivoExcepcion: d.motivoExcepcion,
    },
  });

  revalidatePath(`/clases/${d.claseId}`);
  revalidatePath(`/inscripciones/${clase.inscripcionId}`);
  revalidatePath("/agenda");
  return {};
}

// -------------------------------------------------------------- corrección ---

const Corregir = z.object({
  claseId: z.coerce.number().int().positive(),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  hora: z.string().trim().regex(/^\d{2}:\d{2}$/, "Elige la hora."),
  aulaId: z.coerce.number().int().nonnegative(),
  modalidad: z.enum(["presencial", "en_linea"]),
});

/**
 * Corrige el horario de una clase ya programada. Solo dirección.
 *
 * No es posponer. Posponer consume una de las posposiciones del período, exige
 * 24 horas de aviso y deja una recuperación ligada a la original, porque es un
 * derecho del alumno con reglas. Esto repara un error de captura y no debe
 * gastarle nada a nadie — pero sí queda en bitácora con el antes y el después:
 * mover clases sin rastro es precisamente lo que la cláusula 4ª evita.
 *
 * El choque de horarios se valida igual que al agendar, excluyendo la propia
 * clase de la comparación para que no se detecte a sí misma.
 */
export async function corregirHorario(
  _previo: EstadoAgendar,
  datos: FormData,
): Promise<EstadoAgendar> {
  const sesion = await exigirPermiso("clases.corregir");

  const parsed = Corregir.safeParse({
    claseId: datos.get("claseId"),
    fecha: datos.get("fecha"),
    hora: datos.get("hora"),
    aulaId: datos.get("aulaId") || "0",
    modalidad: datos.get("modalidad") ?? "presencial",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  const clase = clasePorId(d.claseId, alcanceDe(sesion));
  if (!clase) return { error: "No se encontró la clase." };

  // Una clase ya tomada, faltada o cancelada es un hecho ocurrido: corregirle el
  // horario falsearía el historial de asistencia.
  if (clase.estado !== "programada") {
    return { error: "Solo se corrige una clase que sigue programada." };
  }

  const iniciaEn = instanteEnMexico(d.fecha, d.hora);
  const aulaId = d.modalidad === "en_linea" ? null : (d.aulaId || null);

  if (d.modalidad === "presencial" && !aulaId) {
    return { error: "Una clase presencial necesita cubículo." };
  }

  const choques = conflictosDe({
    inscripcionId: clase.inscripcionId,
    alumnoId: clase.alumnoId,
    docenteId: clase.docenteId,
    aulaId,
    iniciaEn,
    minutos: clase.minutos,
    excluirClaseId: clase.id,
  });

  if (choques.length > 0) {
    return {
      error: "Hay un choque de horario.",
      conflictos: choques.map((c) => describirConflicto(c, horaCivil)),
    };
  }

  try {
    corregirClase(clase.id, { iniciaEn, aulaId, modalidad: d.modalidad });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo corregir." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "clase.corregir",
    entidad: "clases",
    entidadId: clase.id,
    cambios: {
      iniciaEn: [clase.iniciaEn.toISOString(), iniciaEn.toISOString()],
      aulaId: [clase.aulaId, aulaId],
      modalidad: [clase.modalidad, d.modalidad],
    },
  });

  revalidatePath(`/clases/${clase.id}`);
  revalidatePath(`/inscripciones/${clase.inscripcionId}`);
  revalidatePath("/agenda");
  return {};
}
