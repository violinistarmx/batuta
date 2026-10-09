import "server-only";

import { and, asc, eq, gte, lt, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, aulas, ciclos, clases, creditosClase, docentes, inscripciones,
  instrumentos, posposiciones, programas,
} from "@/db/schema/index";
import { movimientoPorCambio } from "@/lib/dominio/asistencia";
import { buscarConflictos, type ClaseAgendada, type Conflicto } from "@/lib/dominio/conflictos";
import { evaluarPosposicion, horasDeAnticipacion, type EstadoClase } from "@/lib/dominio/creditos";
import type { Alcance } from "@/lib/auth/permisos";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Clases que ocupan horario en una ventana de tiempo.
 *
 * Se traen todas las del rango y el traslape se decide en memoria con la función
 * pura. Con dos cubículos y una veintena de alumnos son unas decenas de filas, y
 * a cambio la regla queda probada sin base de datos.
 */
function agendadasEntre(desde: Date, hasta: Date): ClaseAgendada[] {
  return db
    .select({
      id: clases.id,
      alumnoId: inscripciones.alumnoId,
      docenteId: clases.docenteId,
      aulaId: clases.aulaId,
      estado: clases.estado,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .where(and(lt(clases.iniciaEn, hasta), gte(clases.terminaEn, desde)))
    .all();
}

export type Candidata = {
  inscripcionId: number;
  alumnoId: number;
  docenteId: number;
  aulaId: number | null;
  iniciaEn: Date;
  minutos: number;
  excluirClaseId?: number;
};

export function conflictosDe(c: Candidata): Conflicto[] {
  const terminaEn = new Date(c.iniciaEn.getTime() + c.minutos * 60_000);
  // Se abre la ventana un día a cada lado: basta para cubrir clases de 2 h que
  // empiecen antes o terminen después del instante buscado.
  const margen = 24 * 60 * 60_000;
  return buscarConflictos(
    { ...c, terminaEn },
    agendadasEntre(new Date(c.iniciaEn.getTime() - margen), new Date(terminaEn.getTime() + margen)),
  );
}

export type DatosClase = {
  inscripcionId: number;
  cicloId: number;
  docenteId: number;
  aulaId: number | null;
  iniciaEn: Date;
  minutos: number;
  modalidad: "presencial" | "en_linea";
  origen?: "regular" | "recuperacion" | "extra" | "cortesia";
  claseOriginalId?: number | null;
};

export function crearClase(d: DatosClase, tx?: Tx): number {
  const ejecutor = tx ?? db;
  const fila = ejecutor.insert(clases).values({
    inscripcionId: d.inscripcionId,
    cicloId: d.cicloId,
    docenteId: d.docenteId,
    // Una clase en línea no ocupa cubículo: se guarda sin aula a propósito.
    aulaId: d.modalidad === "en_linea" ? null : d.aulaId,
    iniciaEn: d.iniciaEn,
    terminaEn: new Date(d.iniciaEn.getTime() + d.minutos * 60_000),
    minutos: d.minutos,
    modalidad: d.modalidad,
    origen: d.origen ?? "regular",
    claseOriginalId: d.claseOriginalId ?? null,
  }).returning({ id: clases.id }).get();

  if (!fila) throw new Error("No se pudo crear la clase.");
  return fila.id;
}

/**
 * Registra o corrige la asistencia.
 *
 * El movimiento en el libro mayor lo decide una función pura a partir del estado
 * anterior y el nuevo: un primer registro consume, una corrección compensa, y si
 * el saldo no cambia no se escribe nada.
 */
export function registrarAsistencia(
  claseId: number,
  nuevo: EstadoClase,
  usuarioId: number,
  observaciones: string | null,
): { anterior: EstadoClase; movimiento: number } {
  return db.transaction((tx) => {
    const clase = tx.select({
      id: clases.id, cicloId: clases.cicloId, estado: clases.estado, minutos: clases.minutos,
    }).from(clases).where(eq(clases.id, claseId)).get();

    if (!clase) throw new Error("La clase no existe.");

    const anterior = clase.estado as EstadoClase;
    // Cada sesión consume exactamente 1 crédito, sin importar su duración.
    // Los minutos solo determinan el costo del docente; para el alumno una sesión
    // de 90 min de dibujo es una clase, igual que una de 60 min de violín.
    const creditosAConsumir = 1;
    const mov = movimientoPorCambio(anterior, nuevo, creditosAConsumir);

    tx.update(clases).set({
      estado: nuevo,
      observaciones,
      registradoPor: usuarioId,
      registradoEn: new Date(),
    }).where(eq(clases.id, claseId)).run();

    if (mov) {
      tx.insert(creditosClase).values({
        cicloId: clase.cicloId,
        claseId,
        delta: mov.delta,
        motivo: mov.motivo,
        nota: mov.nota,
        creadoPor: usuarioId,
      }).run();
    }

    return { anterior, movimiento: mov?.delta ?? 0 };
  });
}

export type ResultadoPosposicion =
  | { ok: true; claseRecuperacionId: number }
  | { ok: false; razon: string; requiereAutorizacion?: boolean };

/**
 * Pospone una clase y crea su recuperación.
 *
 * Cláusula 4ª: hacen falta 24 h de aviso y quedan 2 posposiciones por período.
 * El aviso se fecha con la hora en que el tutor avisó, no con la hora en que el
 * personal lo capturó — es lo único que determina si se cumplió el umbral.
 */
export function posponerClase(
  claseId: number,
  avisoEn: Date,
  nuevaFecha: Date,
  usuarioId: number,
  opciones: { autorizar?: boolean; motivoExcepcion?: string; canal?: "whatsapp" | "telefono" | "presencial" | "correo" | "otro" },
  parametros: { horasAvisoPosposicion: number; maxPosposicionesPorCiclo: number },
): ResultadoPosposicion {
  return db.transaction((tx) => {
    const clase = tx.select({
      id: clases.id, inscripcionId: clases.inscripcionId, cicloId: clases.cicloId,
      docenteId: clases.docenteId, aulaId: clases.aulaId, minutos: clases.minutos,
      modalidad: clases.modalidad, iniciaEn: clases.iniciaEn, estado: clases.estado,
      origen: clases.origen,
    }).from(clases).where(eq(clases.id, claseId)).get();

    if (!clase) return { ok: false as const, razon: "La clase no existe." };
    if (clase.estado !== "programada") {
      return { ok: false as const, razon: "Solo se puede posponer una clase que sigue programada." };
    }
    if (clase.origen === "recuperacion") {
      // Evita el diferimiento indefinido: una recuperación ya es la segunda
      // oportunidad de esa clase.
      return { ok: false as const, razon: "Una clase de recuperación no se puede volver a posponer." };
    }

    const ciclo = tx.select({
      id: ciclos.id, terminaEl: ciclos.terminaEl, posposicionesUsadas: ciclos.posposicionesUsadas,
    }).from(ciclos).where(eq(ciclos.id, clase.cicloId)).get();
    if (!ciclo) return { ok: false as const, razon: "El período no existe." };

    const horas = horasDeAnticipacion(avisoEn, clase.iniciaEn);
    const veredicto = evaluarPosposicion(horas, ciclo.posposicionesUsadas, parametros);

    if (!veredicto.permitido) {
      return { ok: false as const, razon: veredicto.razon };
    }
    if (veredicto.requiereAutorizacion && !opciones.autorizar) {
      return { ok: false as const, razon: veredicto.razon, requiereAutorizacion: true };
    }

    // Cláusula 4ª: la recuperación va dentro del mismo período.
    const fechaNueva = nuevaFecha.toISOString().slice(0, 10);
    if (fechaNueva > ciclo.terminaEl) {
      return {
        ok: false as const,
        razon: `La recuperación debe quedar dentro del período, que cierra el ${ciclo.terminaEl}.`,
      };
    }

    tx.update(clases).set({
      estado: "reprogramada",
      registradoPor: usuarioId,
      registradoEn: new Date(),
    }).where(eq(clases.id, claseId)).run();

    const recuperacionId = crearClase({
      inscripcionId: clase.inscripcionId,
      cicloId: clase.cicloId,
      docenteId: clase.docenteId,
      aulaId: clase.aulaId,
      iniciaEn: nuevaFecha,
      minutos: clase.minutos,
      modalidad: clase.modalidad,
      origen: "recuperacion",
      claseOriginalId: clase.id,
    }, tx);

    tx.insert(posposiciones).values({
      claseOriginalId: clase.id,
      claseRecuperacionId: recuperacionId,
      avisoEn,
      horasAnticipacion: horas,
      canal: opciones.canal ?? "whatsapp",
      cumplioUmbral: !veredicto.requiereAutorizacion,
      autorizadaPor: veredicto.requiereAutorizacion ? usuarioId : null,
      motivoExcepcion: opciones.motivoExcepcion ?? null,
    }).run();

    tx.update(ciclos)
      .set({ posposicionesUsadas: sql`${ciclos.posposicionesUsadas} + 1` })
      .where(eq(ciclos.id, ciclo.id)).run();

    return { ok: true as const, claseRecuperacionId: recuperacionId };
  });
}

function filtroAlcance(alcance: Alcance) {
  if (alcance.tipo === "todo") return undefined;
  if (alcance.docenteId === null) return sql`0 = 1`;
  return eq(clases.docenteId, alcance.docenteId);
}

export type ClaseEnAgenda = {
  id: number;
  iniciaEn: Date;
  terminaEn: Date;
  minutos: number;
  estado: string;
  origen: string;
  modalidad: string;
  alumnoId: number;
  alumno: string;
  alumnoCodigo: string;
  docente: string;
  aula: string | null;
  programa: string;
  instrumento: string;
  inscripcionId: number;
};

export function agendaEntre(desde: Date, hasta: Date, alcance: Alcance): ClaseEnAgenda[] {
  const filtro = filtroAlcance(alcance);
  const rango = and(gte(clases.iniciaEn, desde), lt(clases.iniciaEn, hasta));

  return db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      minutos: clases.minutos,
      estado: clases.estado,
      origen: clases.origen,
      modalidad: clases.modalidad,
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      alumnoCodigo: alumnos.codigo,
      docente: docentes.nombre,
      aula: aulas.nombre,
      programa: programas.nombre,
      instrumento: instrumentos.nombre,
      inscripcionId: clases.inscripcionId,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .leftJoin(aulas, eq(aulas.id, clases.aulaId))
    .where(filtro ? and(rango, filtro) : rango)
    .orderBy(asc(clases.iniciaEn))
    .all();
}

export function clasesDeInscripcion(inscripcionId: number) {
  return db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      minutos: clases.minutos,
      estado: clases.estado,
      origen: clases.origen,
      modalidad: clases.modalidad,
      aula: aulas.nombre,
      observaciones: clases.observaciones,
      cicloNumero: ciclos.numero,
    })
    .from(clases)
    .innerJoin(ciclos, eq(ciclos.id, clases.cicloId))
    .leftJoin(aulas, eq(aulas.id, clases.aulaId))
    .where(eq(clases.inscripcionId, inscripcionId))
    .orderBy(asc(clases.iniciaEn))
    .all();
}

export function clasePorId(id: number, alcance: Alcance) {
  const filtro = filtroAlcance(alcance);
  return db
    .select({
      id: clases.id,
      inscripcionId: clases.inscripcionId,
      cicloId: clases.cicloId,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      minutos: clases.minutos,
      estado: clases.estado,
      origen: clases.origen,
      modalidad: clases.modalidad,
      observaciones: clases.observaciones,
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      docenteId: clases.docenteId,
      docente: docentes.nombre,
      aulaId: clases.aulaId,
      aula: aulas.nombre,
      programa: programas.nombre,
      instrumento: instrumentos.nombre,
      cicloTerminaEl: ciclos.terminaEl,
      posposicionesUsadas: ciclos.posposicionesUsadas,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .innerJoin(ciclos, eq(ciclos.id, clases.cicloId))
    .leftJoin(aulas, eq(aulas.id, clases.aulaId))
    .where(filtro ? and(eq(clases.id, id), filtro) : eq(clases.id, id))
    .get();
}

export function aulasActivas() {
  return db.select({ id: aulas.id, nombre: aulas.nombre })
    .from(aulas).where(eq(aulas.activo, true)).orderBy(asc(aulas.nombre)).all();
}

export type CorreccionClase = {
  iniciaEn: Date;
  aulaId: number | null;
  modalidad: "presencial" | "en_linea";
};

/**
 * Corrección administrativa del horario de una clase ya programada.
 *
 * Deliberadamente NO toca posposiciones, créditos ni crea una recuperación: esto
 * no es posponer. Posponer es un derecho del alumno regulado por la cláusula 4ª y
 * se contabiliza; esto repara un error de captura y no debe gastarle nada a nadie.
 *
 * La duración no se toca: la fija el programa contratado, no quien corrige. Solo
 * se recalcula el fin a partir del nuevo inicio.
 */
export function corregirClase(claseId: number, d: CorreccionClase): void {
  const actual = db
    .select({ minutos: clases.minutos })
    .from(clases)
    .where(eq(clases.id, claseId))
    .get();
  if (!actual) throw new Error("No se encontró la clase.");

  db.update(clases)
    .set({
      iniciaEn: d.iniciaEn,
      terminaEn: new Date(d.iniciaEn.getTime() + actual.minutos * 60_000),
      // Una clase en línea no ocupa cubículo, igual que al agendarla.
      aulaId: d.modalidad === "en_linea" ? null : d.aulaId,
      modalidad: d.modalidad,
    })
    .where(eq(clases.id, claseId))
    .run();
}
