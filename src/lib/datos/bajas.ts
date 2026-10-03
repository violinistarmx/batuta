import "server-only";

import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cargos, ciclos, clases, creditosClase, inscripciones, prestamos,
} from "@/db/schema/index";
import { ajusteProporcional, fechaEfectiva, motivoParaNoDarDeBaja, planDeBaja, type Plan, type Situacion } from "@/lib/dominio/bajas";
import { finDelDiaEnMexico } from "@/lib/zona";

/**
 * Todo lo que hace falta saber para dar una baja, en una sola consulta por pieza.
 *
 * Se arma aparte del acto de darla porque la pantalla enseña el plan antes de
 * ejecutarlo: quien captura la baja tiene que poder leer qué va a pasar con el
 * dinero y con la agenda mientras todavía puede arrepentirse.
 */
export function situacionDeBaja(
  inscripcionId: number,
  fechaAviso: string,
  horasAviso: number,
): Situacion | null {
  const ins = db.select({
    id: inscripciones.id,
    estado: inscripciones.estado,
  }).from(inscripciones).where(eq(inscripciones.id, inscripcionId)).get();
  if (!ins) return null;

  const ciclo = db.select({
    id: ciclos.id,
    terminaEl: ciclos.terminaEl,
    contratadas: ciclos.clasesContratadas,
  }).from(ciclos)
    .where(and(eq(ciclos.inscripcionId, inscripcionId), eq(ciclos.estado, "abierto")))
    .orderBy(desc(ciclos.numero))
    .get();

  // El cargo del período vigente, con lo que ya se le aplicó de los pagos.
  const mensualidad = ciclo
    ? db.select({
        cargoId: cargos.id,
        montoCentavos: cargos.montoCentavos,
        aplicadoCentavos: sql<number>`coalesce((
          SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
        ), 0)`,
      }).from(cargos)
        .where(and(
          eq(cargos.cicloId, ciclo.id),
          eq(cargos.concepto, "mensualidad"),
          eq(cargos.cancelado, false),
        )).get() ?? null
    : null;

  // Las clases que ya consumieron crédito: son las que el alumno realmente tomó.
  const consumidas = ciclo
    ? Math.abs(db.select({ n: sql<number>`coalesce(sum(${creditosClase.delta}), 0)` })
        .from(creditosClase)
        .where(and(eq(creditosClase.cicloId, ciclo.id), sql`${creditosClase.delta} < 0`))
        .get()?.n ?? 0)
    : 0;

  const prestamosAbiertos = db.select({ n: sql<number>`count(*)` }).from(prestamos)
    .where(and(eq(prestamos.inscripcionId, inscripcionId), isNull(prestamos.devueltoEl)))
    .get()?.n ?? 0;

  const cubiertasActivas = db.select({ n: sql<number>`count(*)` }).from(inscripciones)
    .where(and(eq(inscripciones.cubiertaPorId, inscripcionId), eq(inscripciones.estado, "activa")))
    .get()?.n ?? 0;

  return {
    fechaAviso,
    horasAviso,
    terminaElPeriodo: ciclo?.terminaEl ?? null,
    mensualidad,
    clasesContratadas: ciclo?.contratadas ?? 0,
    clasesConsumidas: consumidas,
    estadoInscripcion: ins.estado,
    prestamosAbiertos,
    cubiertasActivas,
  };
}

export function planParaBaja(
  inscripcionId: number,
  fechaAviso: string,
  horasAviso: number,
): { situacion: Situacion; plan: Plan; impedimento: string | null } | null {
  const situacion = situacionDeBaja(inscripcionId, fechaAviso, horasAviso);
  if (!situacion) return null;
  return {
    situacion,
    plan: planDeBaja(situacion),
    impedimento: motivoParaNoDarDeBaja(situacion),
  };
}

export type ResultadoBaja = {
  fechaEfectiva: string;
  clasesCanceladas: number;
  condonadoCentavos: number;
};

/**
 * Da la baja. Una sola transacción: o queda todo, o no queda nada.
 *
 * El orden importa menos que el hecho de que sea atómico. Una baja a medias
 * —inscripción cerrada pero clases todavía ocupando cubículo, o cargo ajustado
 * sin baja— deja la academia en un estado que nadie sabe leer después.
 */
export function darDeBaja(
  inscripcionId: number,
  fechaAviso: string,
  horasAviso: number,
  motivo: string,
  usuarioId: number,
): ResultadoBaja {
  const situacion = situacionDeBaja(inscripcionId, fechaAviso, horasAviso);
  if (!situacion) throw new Error("Esa inscripción no existe.");

  // Se vuelve a verificar aquí: entre que la pantalla mostró el plan y alguien
  // apretó el botón pudo entregarse un instrumento o inscribirse un hermano.
  const impedimento = motivoParaNoDarDeBaja(situacion);
  if (impedimento) throw new Error(impedimento);

  const efectiva = fechaEfectiva(situacion);
  const ajuste = ajusteProporcional(situacion);
  const corte = finDelDiaEnMexico(efectiva);

  return db.transaction((tx) => {
    tx.update(inscripciones).set({
      estado: "finalizada",
      fechaFin: efectiva,
      avisoBajaEn: new Date(),
      // Se añade, no se reemplaza: la inscripción pudo traer una nota desde el
      // alta —«cambia de horario en vacaciones», «el tutor paga en efectivo»— y
      // borrarla para meter el motivo de la baja perdería lo que ya se sabía.
      notas: sql`coalesce(${inscripciones.notas} || ' · ', '') || ${`Baja: ${motivo}`}`,
    }).where(eq(inscripciones.id, inscripcionId)).run();

    // Las clases de ANTES de la fecha efectiva no se tocan: son las que el
    // alumno todavía tiene derecho a tomar. Las de después dejan libre el
    // cubículo, que es lo que permite ofrecérselo a alguien más.
    const canceladas = tx.update(clases).set({
      estado: "cancelada",
      observaciones: sql`coalesce(${clases.observaciones} || ' · ', '') || 'Cancelada por baja de inscripción'`,
    }).where(and(
      eq(clases.inscripcionId, inscripcionId),
      eq(clases.estado, "programada"),
      gt(clases.iniciaEn, corte),
    )).run().changes;

    if (ajuste) {
      tx.update(cargos).set({
        montoCentavos: ajuste.despuesCentavos,
        descripcion: sql`${cargos.descripcion} || ' · ajustado por baja'`,
        motivoCancelacion: `Baja al ${efectiva}: ${ajuste.explicacion}`,
      }).where(eq(cargos.id, ajuste.cargoId)).run();

      // Un cargo en cero es un cargo que no existe: se marca cancelado para que
      // no salga a cobranza pidiendo cero pesos.
      if (ajuste.despuesCentavos === 0) {
        tx.update(cargos).set({ cancelado: true }).where(eq(cargos.id, ajuste.cargoId)).run();
      }
    }

    // El período NO se cierra aquí, y es deliberado.
    //
    // La baja puede surtir efecto semanas después —cuando el alumno ya pagó el
    // mes, se lo queda entero— y hasta entonces conserva el derecho a agendar y
    // tomar sus clases. Cerrar el período expiraría ese saldo de inmediato y le
    // quitaría lo que la cláusula 12ª sí le concede. El período corre hasta su
    // fecha; lo que se detuvo es la renovación, y el tablero ya filtra por
    // inscripción activa, así que un alumno dado de baja no vuelve a pedirla.

    return {
      fechaEfectiva: efectiva,
      clasesCanceladas: canceladas,
      condonadoCentavos: ajuste?.condonadoCentavos ?? 0,
    };
  });
}

/** Bajas recientes, para la pantalla de finanzas y para no perderlas de vista. */
export function bajasRecientes(limite = 20) {
  return db.select({
    id: inscripciones.id,
    alumnoId: inscripciones.alumnoId,
    fechaFin: inscripciones.fechaFin,
    avisoBajaEn: inscripciones.avisoBajaEn,
    notas: inscripciones.notas,
  }).from(inscripciones)
    .where(and(eq(inscripciones.estado, "finalizada"), isNotNull(inscripciones.avisoBajaEn)))
    .orderBy(desc(inscripciones.avisoBajaEn))
    .limit(limite)
    .all();
}
