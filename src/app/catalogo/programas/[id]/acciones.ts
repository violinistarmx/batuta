"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { actualizarEstructuraPrograma, actualizarNombrePrograma, actualizarPrecioPrograma, programaPorId } from "@/lib/datos/catalogo";

export type EstadoAccion = { ok: boolean; mensaje: string };

// ─── Editar nombre y descripción ────────────────────────────────────────────

const EsquemaNombre = z.object({
  programaId: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(1, "El nombre no puede estar vacío.").max(80),
  descripcion: z.string().trim().min(1, "La descripción no puede estar vacía.").max(200),
});

export async function guardarNombrePrograma(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = EsquemaNombre.safeParse({
    programaId: datos.get("programaId"),
    nombre: datos.get("nombre"),
    descripcion: datos.get("descripcion"),
  });
  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { programaId, nombre, descripcion } = parsed.data;

  const antes = programaPorId(programaId);
  if (!antes) return { ok: false, mensaje: "El programa no existe." };

  try {
    actualizarNombrePrograma(programaId, { nombre, descripcion });
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "programas",
    entidadId: programaId,
    cambios: { nombreAntes: antes.nombre, descripcionAntes: antes.descripcion, nombre, descripcion },
  });

  revalidatePath("/catalogo");
  return { ok: true, mensaje: "Nombre actualizado." };
}

// ─── Cambiar precio (con versionamiento histórico) ──────────────────────────

const EsquemaPrecio = z.object({
  programaId: z.coerce.number().int().positive(),
  precioPesos: z.coerce
    .number({ invalid_type_error: "Escribe el precio en pesos." })
    .positive("El precio debe ser mayor a cero.")
    .multipleOf(0.5, "El precio solo puede tener hasta 50 centavos de precisión."),
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
});

export async function guardarPrecioPrograma(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = EsquemaPrecio.safeParse({
    programaId: datos.get("programaId"),
    precioPesos: datos.get("precioPesos"),
    vigenteDesde: datos.get("vigenteDesde"),
  });
  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { programaId, precioPesos, vigenteDesde } = parsed.data;
  const precioCentavos = Math.round(precioPesos * 100);

  const antes = programaPorId(programaId);
  if (!antes) return { ok: false, mensaje: "El programa no existe." };

  if (precioCentavos === antes.precioCentavos) {
    return { ok: false, mensaje: "El precio nuevo es igual al actual. No hay nada que cambiar." };
  }

  try {
    actualizarPrecioPrograma(programaId, precioCentavos, vigenteDesde);
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "programas",
    entidadId: programaId,
    cambios: {
      precioAntesCentavos: antes.precioCentavos,
      precioDespuesCentavos: precioCentavos,
      vigenteDesde,
    },
  });

  revalidatePath("/catalogo");
  return { ok: true, mensaje: "Precio actualizado. Entra en vigor el " + vigenteDesde + "." };
}

// ─── Editar estructura (clave, clases/ciclo, min/clase) ─────────────────────

const EsquemaEstructura = z.object({
  programaId: z.coerce.number().int().positive(),
  clave: z
    .string()
    .trim()
    .min(2, "La clave debe tener al menos 2 caracteres.")
    .max(30, "Máximo 30 caracteres.")
    .regex(/^[a-z0-9_-]+$/, "Solo letras minúsculas, números, guiones y guiones bajos."),
  clasesPorCiclo: z.coerce.number().int().min(1, "Al menos 1 clase por ciclo.").max(31),
  minutosPorClase: z.coerce.number().int().min(15).max(180),
});

export async function guardarEstructuraPrograma(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = EsquemaEstructura.safeParse({
    programaId: datos.get("programaId"),
    clave: datos.get("clave"),
    clasesPorCiclo: datos.get("clasesPorCiclo"),
    minutosPorClase: datos.get("minutosPorClase"),
  });
  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { programaId, clave, clasesPorCiclo, minutosPorClase } = parsed.data;

  const antes = programaPorId(programaId);
  if (!antes) return { ok: false, mensaje: "El programa no existe." };

  try {
    actualizarEstructuraPrograma(programaId, { clave, clasesPorCiclo, minutosPorClase });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo guardar.";
    if (msg.includes("UNIQUE") || msg.includes("ux_programas_clave")) {
      return { ok: false, mensaje: `La clave "${clave}" ya existe. Elige otra.` };
    }
    return { ok: false, mensaje: msg };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "programas",
    entidadId: programaId,
    cambios: {
      claveAntes: antes.clave, clavesDespues: clave,
      clasesPorCicloAntes: antes.clasesPorCiclo, clasesPorCicloDespues: clasesPorCiclo,
      minutosPorClaseAntes: antes.minutosPorClase, minutosPorClaseDespues: minutosPorClase,
    },
  });

  revalidatePath(`/catalogo/programas/${programaId}`);
  revalidatePath("/catalogo");
  return { ok: true, mensaje: "Estructura actualizada." };
}
