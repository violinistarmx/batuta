"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { instrumentos } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";

export type EstadoAccion = { ok: boolean; mensaje: string };

// ─── Crear instrumento / materia ─────────────────────────────────────────────

const EsquemaNuevo = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(60, "Máximo 60 caracteres."),
  granFormato: z.preprocess(
    (v: unknown) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export async function crearInstrumento(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = EsquemaNuevo.safeParse({
    nombre: datos.get("nombre"),
    granFormato: datos.get("granFormato"),
  });
  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { nombre, granFormato } = parsed.data;

  // Orden al final de la lista actual.
  const max = db
    .select({ orden: instrumentos.orden })
    .from(instrumentos)
    .orderBy(asc(instrumentos.orden))
    .all()
    .at(-1)?.orden ?? -1;

  try {
    db.insert(instrumentos).values({
      nombre,
      granFormato,
      activo: true,
      orden: max + 1,
    }).run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("ux_instrumentos_nombre")) {
      return { ok: false, mensaje: `Ya existe una materia llamada "${nombre}".` };
    }
    return { ok: false, mensaje: "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "instrumentos",
    cambios: { nombre, granFormato },
  });

  revalidatePath("/catalogo/instrumentos");
  revalidatePath("/catalogo");
  return { ok: true, mensaje: `"${nombre}" agregado.` };
}

// ─── Renombrar ────────────────────────────────────────────────────────────────

const EsquemaRenombrar = z.object({
  instrumentoId: z.coerce.number().int().positive(),
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(60, "Máximo 60 caracteres."),
  granFormato: z.preprocess(
    (v: unknown) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export async function renombrarInstrumento(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = EsquemaRenombrar.safeParse({
    instrumentoId: datos.get("instrumentoId"),
    nombre: datos.get("nombre"),
    granFormato: datos.get("granFormato"),
  });
  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { instrumentoId, nombre, granFormato } = parsed.data;

  try {
    const resultado = db
      .update(instrumentos)
      .set({ nombre, granFormato })
      .where(eq(instrumentos.id, instrumentoId))
      .run();
    if (resultado.changes === 0) return { ok: false, mensaje: "No se encontró la materia." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UNIQUE") || msg.includes("ux_instrumentos_nombre")) {
      return { ok: false, mensaje: `Ya existe una materia llamada "${nombre}".` };
    }
    return { ok: false, mensaje: "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "instrumentos",
    entidadId: instrumentoId,
    cambios: { nombre, granFormato },
  });

  revalidatePath("/catalogo/instrumentos");
  revalidatePath("/catalogo");
  return { ok: true, mensaje: "Guardado." };
}

// ─── Activar / desactivar ────────────────────────────────────────────────────

const EsquemaToggle = z.object({
  instrumentoId: z.coerce.number().int().positive(),
  activo: z.preprocess(
    (v: unknown) => v === "true" || v === true,
    z.boolean(),
  ),
});

export async function toggleInstrumento(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = EsquemaToggle.safeParse({
    instrumentoId: datos.get("instrumentoId"),
    activo: datos.get("activo"),
  });
  if (!parsed.success) {
    return { ok: false, mensaje: "Datos inválidos." };
  }

  const { instrumentoId, activo } = parsed.data;

  db.update(instrumentos)
    .set({ activo })
    .where(eq(instrumentos.id, instrumentoId))
    .run();

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "instrumentos",
    entidadId: instrumentoId,
    cambios: { activo },
  });

  revalidatePath("/catalogo/instrumentos");
  revalidatePath("/catalogo");
  return { ok: true, mensaje: activo ? "Activado." : "Desactivado." };
}
