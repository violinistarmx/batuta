import "server-only";

import { and, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { bitacora, usuarios } from "@/db/schema/index";
import { finDelDiaEnMexico, inicioDelDiaEnMexico } from "@/lib/zona";

export type Movimiento = {
  id: number;
  creadoEn: Date;
  usuarioId: number | null;
  quien: string | null;
  accion: string;
  entidad: string;
  entidadId: number | null;
  cambios: string | null;
  ip: string | null;
};

export type Filtro = {
  desde?: string | null;
  hasta?: string | null;
  usuarioId?: number | null;
  accion?: string | null;
  /** Texto libre contra la entidad y el JSON de cambios. */
  q?: string | null;
  pagina?: number;
};

export const POR_PAGINA = 60;

function condiciones(f: Filtro): SQL[] {
  const cs: SQL[] = [];
  // Las fechas llegan como día civil mexicano y la columna guarda un instante:
  // comparar sin convertir deja fuera todo lo de la madrugada, que es justo lo
  // que una auditoría no se puede permitir perder.
  if (f.desde) cs.push(gte(bitacora.creadoEn, inicioDelDiaEnMexico(f.desde)));
  if (f.hasta) cs.push(lte(bitacora.creadoEn, finDelDiaEnMexico(f.hasta)));
  if (f.usuarioId) cs.push(eq(bitacora.usuarioId, f.usuarioId));
  if (f.accion) cs.push(eq(bitacora.accion, f.accion));
  if (f.q) {
    const t = `%${f.q.toLowerCase()}%`;
    cs.push(sql`(lower(${bitacora.entidad}) LIKE ${t} OR lower(coalesce(${bitacora.cambios}, '')) LIKE ${t})`);
  }
  return cs;
}

export function consultarBitacora(f: Filtro): { movimientos: Movimiento[]; total: number } {
  const cs = condiciones(f);
  const donde = cs.length > 0 ? and(...cs) : undefined;
  const pagina = Math.max(1, f.pagina ?? 1);

  const movimientos = db
    .select({
      id: bitacora.id,
      creadoEn: bitacora.creadoEn,
      usuarioId: bitacora.usuarioId,
      quien: usuarios.nombre,
      accion: bitacora.accion,
      entidad: bitacora.entidad,
      entidadId: bitacora.entidadId,
      cambios: bitacora.cambios,
      ip: bitacora.ip,
    })
    .from(bitacora)
    .leftJoin(usuarios, eq(usuarios.id, bitacora.usuarioId))
    .where(donde)
    .orderBy(desc(bitacora.creadoEn), desc(bitacora.id))
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA)
    .all();

  const total = db.select({ n: count() }).from(bitacora).where(donde).get()?.n ?? 0;

  return { movimientos, total };
}

/** Quién ha dejado huella alguna vez, para el filtro. */
export function quienesAparecen() {
  return db
    .selectDistinct({ id: usuarios.id, nombre: usuarios.nombre })
    .from(bitacora)
    .innerJoin(usuarios, eq(usuarios.id, bitacora.usuarioId))
    .orderBy(usuarios.nombre)
    .all();
}

/** El día del movimiento más antiguo, para no ofrecer filtros vacíos. */
export function desdeCuandoHayBitacora(): Date | null {
  const fila = db.select({ d: sql<number | null>`min(${bitacora.creadoEn})` }).from(bitacora).get();
  return fila?.d ? new Date(fila.d * 1000) : null;
}
