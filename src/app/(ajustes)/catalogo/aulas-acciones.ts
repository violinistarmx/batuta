"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { aulas } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";

export type EstadoAula = { error?: string; ok?: string };

/** Asigna la sede de un aula. Cambia la sede de todas sus clases en finanzas, también las pasadas. */
export async function asignarSedeAulaAccion(_prev: EstadoAula, datos: FormData): Promise<EstadoAula> {
  const sesion = await exigirPermiso("configuracion.gestionar");
  const aulaId = Number(datos.get("aulaId"));
  const crudo = String(datos.get("sedeId") ?? "");
  const sedeId = crudo === "" ? null : Number(crudo);
  if (!Number.isInteger(aulaId) || aulaId <= 0 || (sedeId !== null && !(sedeId > 0))) {
    return { error: "Datos inválidos." };
  }
  const antes = db.select({ sedeId: aulas.sedeId }).from(aulas).where(eq(aulas.id, aulaId)).get();
  if (!antes) return { error: "No se encontró el aula." };

  db.update(aulas).set({ sedeId }).where(eq(aulas.id, aulaId)).run();
  registrar({
    usuarioId: sesion.usuarioId, accion: "configuracion.modificar", entidad: "aulas", entidadId: aulaId,
    cambios: { sedeId: [antes.sedeId, sedeId] },
  });
  revalidatePath("/catalogo");
  revalidatePath("/finanzas");
  return { ok: "Guardado." };
}

/** Crea un aula en una sede. Las clases de esa sede se agendan en ella. */
export async function crearAulaAccion(_prev: EstadoAula, datos: FormData): Promise<EstadoAula> {
  const sesion = await exigirPermiso("configuracion.gestionar");
  const nombre = String(datos.get("nombre") ?? "").trim();
  const sedeId = Number(datos.get("sedeId"));
  if (nombre.length < 2 || nombre.length > 60) return { error: "Escribe el nombre del aula." };
  if (!Number.isInteger(sedeId) || sedeId <= 0) return { error: "Elige la sede." };
  try {
    const r = db.insert(aulas).values({ nombre, sedeId }).returning({ id: aulas.id }).get();
    registrar({
      usuarioId: sesion.usuarioId, accion: "configuracion.modificar", entidad: "aulas",
      entidadId: r?.id ?? null, cambios: { nombre, sedeId },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { error: msg.includes("UNIQUE") ? "Ya existe un aula con ese nombre." : "No se pudo crear el aula." };
  }
  revalidatePath("/catalogo");
  return { ok: `Aula «${nombre}» creada.` };
}
