import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { docentes, tarifasDocente, usuarios } from "@/db/schema/index";
import { diaAnterior } from "@/lib/finanzas/fechas";
import { hoyEnMexico } from "@/lib/zona";

/**
 * Tarifas por hora de los maestros, con vigencia.
 *
 * Es la fuente única de la tarifa propia: la nómina la lee por fecha de clase, así
 * que cambiar la tarifa hoy no reescribe lo que ya se impartió.
 */

/** Tarifa propia vigente en una fecha, o null si usa la del programa o la general. */
export function tarifaVigenteDe(docenteId: number, fecha: string = hoyEnMexico()): number | null {
  return db.select({ t: tarifasDocente.tarifaHoraCentavos })
    .from(tarifasDocente)
    .where(and(
      eq(tarifasDocente.docenteId, docenteId),
      lte(tarifasDocente.vigenteDesde, fecha),
      or(isNull(tarifasDocente.vigenteHasta), gte(tarifasDocente.vigenteHasta, fecha)),
    ))
    .orderBy(desc(tarifasDocente.vigenteDesde))
    .limit(1)
    .get()?.t ?? null;
}

/** Historial de un maestro, de la más reciente a la más vieja. */
export function historialTarifas(docenteId: number) {
  return db.select({
      id: tarifasDocente.id,
      tarifaHoraCentavos: tarifasDocente.tarifaHoraCentavos,
      vigenteDesde: tarifasDocente.vigenteDesde,
      vigenteHasta: tarifasDocente.vigenteHasta,
      registradoPor: usuarios.nombre,
    })
    .from(tarifasDocente)
    .leftJoin(usuarios, eq(usuarios.id, tarifasDocente.creadoPor))
    .where(eq(tarifasDocente.docenteId, docenteId))
    .orderBy(desc(tarifasDocente.vigenteDesde), desc(tarifasDocente.id))
    .all();
}

/** Todos los maestros activos con su tarifa vigente hoy (null = usa otra tarifa). */
export function tarifasActuales() {
  const hoy = hoyEnMexico();
  return db.select({ id: docentes.id, nombre: docentes.nombre })
    .from(docentes)
    .where(eq(docentes.activo, true))
    .orderBy(asc(docentes.nombre))
    .all()
    .map((d) => ({ ...d, tarifaHoraCentavos: tarifaVigenteDe(d.id, hoy) }));
}

/**
 * Cambia la tarifa a partir de `desde`. Cierra la vigente el día anterior y abre la
 * nueva. Con `tarifa = null` solo cierra: el maestro vuelve a la tarifa del programa
 * o a la general. Si la vigente empezó el mismo día, se reemplaza en lugar de dejar
 * un tramo de cero días.
 */
export function cambiarTarifa(
  docenteId: number,
  tarifa: number | null,
  desde: string,
  usuarioId: number,
): { anterior: number | null } {
  return db.transaction((tx) => {
    const abierta = tx.select().from(tarifasDocente)
      .where(and(eq(tarifasDocente.docenteId, docenteId), isNull(tarifasDocente.vigenteHasta)))
      .get();

    if (abierta && abierta.vigenteDesde > desde) {
      throw new Error(`La tarifa vigente empieza el ${abierta.vigenteDesde}; elige esa fecha o una posterior.`);
    }

    if (abierta) {
      if (abierta.vigenteDesde === desde) {
        tx.delete(tarifasDocente).where(eq(tarifasDocente.id, abierta.id)).run();
      } else {
        tx.update(tarifasDocente).set({ vigenteHasta: diaAnterior(desde) })
          .where(eq(tarifasDocente.id, abierta.id)).run();
      }
    }

    if (tarifa !== null) {
      tx.insert(tarifasDocente).values({
        docenteId, tarifaHoraCentavos: tarifa, vigenteDesde: desde, creadoPor: usuarioId,
      }).run();
    }

    return { anterior: abierta?.tarifaHoraCentavos ?? null };
  });
}
