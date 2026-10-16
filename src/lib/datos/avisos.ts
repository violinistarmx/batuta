import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import { avisos, avisosAdjuntos, roles, usuarios } from "@/db/schema/index";
import { guardar, type ArchivoGuardado } from "@/lib/almacen";
import type { TipoPermitido } from "@/lib/dominio/archivos";

/** Cuántos avisos no ha leído esta persona. Alimenta la campana y el banner. */
export function avisosSinLeer(usuarioId: number): number {
  const fila = db.select({ n: sql<number>`count(*)` }).from(avisos)
    .where(and(eq(avisos.destinatarioId, usuarioId), isNull(avisos.leidoEn)))
    .get();
  return fila?.n ?? 0;
}

/** La bandeja de una persona, los más recientes primero. Lee el nombre de quien lo envió. */
export function bandejaDe(usuarioId: number) {
  const remitente = alias(usuarios, "remitente");
  return db
    .select({
      id: avisos.id,
      grupo: avisos.grupo,
      asunto: avisos.asunto,
      cuerpo: avisos.cuerpo,
      creadoEn: avisos.creadoEn,
      leidoEn: avisos.leidoEn,
      remitente: remitente.nombre,
    })
    .from(avisos)
    .innerJoin(remitente, eq(remitente.id, avisos.remitenteId))
    .where(eq(avisos.destinatarioId, usuarioId))
    .orderBy(desc(avisos.creadoEn), desc(avisos.id))
    .limit(100)
    .all();
}

/** Adjuntos de varios envíos de una vez, agrupados por el grupo del envío. */
export function adjuntosDeGrupos(grupos: readonly string[]) {
  const unicos = [...new Set(grupos)];
  if (unicos.length === 0) return new Map<string, AdjuntoResumen[]>();
  const filas = db
    .select({
      id: avisosAdjuntos.id,
      grupo: avisosAdjuntos.grupo,
      nombre: avisosAdjuntos.nombreOriginal,
      tipoMime: avisosAdjuntos.tipoMime,
      bytes: avisosAdjuntos.bytes,
    })
    .from(avisosAdjuntos)
    .where(inArray(avisosAdjuntos.grupo, unicos))
    .orderBy(avisosAdjuntos.id)
    .all();
  const porGrupo = new Map<string, AdjuntoResumen[]>();
  for (const f of filas) {
    const lista = porGrupo.get(f.grupo) ?? [];
    lista.push({ id: f.id, nombre: f.nombre, tipoMime: f.tipoMime, bytes: f.bytes });
    porGrupo.set(f.grupo, lista);
  }
  return porGrupo;
}

export type AdjuntoResumen = { id: number; nombre: string; tipoMime: string; bytes: number };

/**
 * Devuelve el adjunto solo si quien pide es remitente o destinatario de su envío.
 * Si no, null: quien no participa no debe saber ni que el archivo existe.
 */
export function adjuntoDeParticipante(adjuntoId: number, usuarioId: number) {
  const adjunto = db.select().from(avisosAdjuntos)
    .where(eq(avisosAdjuntos.id, adjuntoId)).get();
  if (!adjunto) return null;
  const participa = db.select({ id: avisos.id }).from(avisos)
    .where(and(
      eq(avisos.grupo, adjunto.grupo),
      or(eq(avisos.destinatarioId, usuarioId), eq(avisos.remitenteId, usuarioId)),
    ))
    .limit(1).get();
  return participa ? adjunto : null;
}

/** Maestros con cuenta activa: los únicos a quienes se les puede escribir. */
export function docentesActivos() {
  return db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .where(and(eq(roles.clave, "docente"), eq(usuarios.activo, true)))
    .orderBy(usuarios.nombre)
    .all();
}

export type ArchivoNuevo = { nombre: string; tipo: TipoPermitido; contenido: Buffer };

/**
 * Registra un envío: un renglón por destinatario y un solo juego de adjuntos.
 *
 * Los archivos se guardan primero en el almacén y después todo el registro va en
 * una transacción. Si algo falla al escribir los renglones, no quedan avisos sin
 * su adjunto ni renglones a medias.
 */
export async function enviarAviso(input: {
  remitenteId: number;
  destinatarioIds: readonly number[];
  asunto: string;
  cuerpo: string;
  archivos: readonly ArchivoNuevo[];
}): Promise<string> {
  const grupo = randomUUID();

  const guardados: { nombre: string; tipo: TipoPermitido; archivo: ArchivoGuardado }[] = [];
  for (const a of input.archivos) {
    const archivo = await guardar(a.contenido, a.tipo);
    guardados.push({ nombre: a.nombre, tipo: a.tipo, archivo });
  }

  db.transaction((tx) => {
    for (const destinatarioId of input.destinatarioIds) {
      tx.insert(avisos).values({
        remitenteId: input.remitenteId,
        destinatarioId,
        grupo,
        asunto: input.asunto,
        cuerpo: input.cuerpo,
      }).run();
    }
    for (const g of guardados) {
      tx.insert(avisosAdjuntos).values({
        grupo,
        nombreOriginal: g.nombre,
        tipoMime: g.tipo,
        bytes: g.archivo.bytes,
        hashSha256: g.archivo.hash,
        ruta: g.archivo.ruta,
        subidoPor: input.remitenteId,
      }).run();
    }
  });

  return grupo;
}

/** Marca como leídos los avisos que todavía no lo estaban. */
export function marcarAvisosLeidos(usuarioId: number): void {
  db.update(avisos)
    .set({ leidoEn: new Date() })
    .where(and(eq(avisos.destinatarioId, usuarioId), isNull(avisos.leidoEn)))
    .run();
}
