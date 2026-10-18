"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  actualizarCategoria, actualizarGasto, crearCategoria, eliminarGasto, gastoPorId, registrarGasto,
} from "@/lib/datos/gastos";

const idOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable(),
);

const EsquemaGasto = z.object({
  categoriaId: z.coerce.number({ invalid_type_error: "Elige la categoría." }).int().positive("Elige la categoría."),
  subcategoria: z.string().trim().max(80).transform((s) => (s === "" ? null : s)),
  tipo: z.enum(["fijo", "variable"], { errorMap: () => ({ message: "Elige si el gasto es fijo o variable." }) }),
  sedeId: idOpcional,
  programaId: idOpcional,
  concepto: z.string().trim().min(1, "Escribe el concepto.").max(200),
  monto: z.coerce
    .number({ invalid_type_error: "Escribe un monto válido." })
    .positive("El monto debe ser mayor que cero.")
    .max(10_000_000, "El monto parece demasiado alto."),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del gasto."),
});

export type EstadoGasto = { error?: string; ok?: string };

function leer(datos: FormData) {
  return EsquemaGasto.safeParse({
    categoriaId: datos.get("categoriaId"),
    subcategoria: datos.get("subcategoria") ?? "",
    tipo: datos.get("tipo"),
    sedeId: datos.get("sedeId"),
    programaId: datos.get("programaId"),
    concepto: datos.get("concepto"),
    monto: datos.get("monto"),
    fecha: datos.get("fecha"),
  });
}

/** A dónde volver después de guardar. Solo rutas de gastos: nada de redirecciones abiertas. */
function destino(datos: FormData): string {
  const v = String(datos.get("volver") ?? "");
  return v.startsWith("/finanzas/gastos") && !v.includes("//") ? v : "/finanzas/gastos";
}

function revalidar() {
  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");
}

// ----------------------------------------------------------------- registrar ---

export async function registrarGastoAccion(_prev: EstadoGasto, datos: FormData): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");
  const parsed = leer(datos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { monto, ...resto } = parsed.data;
  const d = { ...resto, montoCentavos: Math.round(monto * 100) };

  let id: number;
  try {
    id = registrarGasto(d, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el gasto." };
  }

  registrar({ usuarioId: sesion.usuarioId, accion: "gasto.registrar", entidad: "gastos", entidadId: id, cambios: d });
  revalidar();
  redirect(destino(datos));
}

// ------------------------------------------------------------------- editar ---

export async function editarGastoAccion(_prev: EstadoGasto, datos: FormData): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");

  const id = Number(datos.get("id"));
  if (!id) return { error: "Gasto inválido." };
  const antes = gastoPorId(id);
  if (!antes) return { error: "No se encontró el gasto." };

  const parsed = leer(datos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { monto, ...resto } = parsed.data;
  const d = { ...resto, montoCentavos: Math.round(monto * 100) };

  try {
    actualizarGasto(id, d);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo actualizar el gasto." };
  }

  // Solo lo que cambió, como en el resto de la bitácora.
  const cambios: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(d)) {
    const previo = (antes as Record<string, unknown>)[k];
    if (previo !== v) cambios[k] = [previo, v];
  }
  registrar({ usuarioId: sesion.usuarioId, accion: "gasto.editar", entidad: "gastos", entidadId: id, cambios });
  revalidar();
  redirect(destino(datos));
}

// ------------------------------------------------------------------ eliminar ---

export async function eliminarGastoAccion(_prev: EstadoGasto, datos: FormData): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");

  const id = Number(datos.get("id"));
  if (!id) return { error: "Gasto inválido." };

  const gasto = gastoPorId(id);
  if (!gasto) return { error: "No se encontró el gasto." };

  eliminarGasto(id);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "gasto.eliminar",
    entidad: "gastos",
    entidadId: id,
    cambios: { concepto: gasto.concepto, montoCentavos: gasto.montoCentavos, fecha: gasto.fecha },
  });
  revalidar();
  redirect(destino(datos));
}

// --------------------------------------------------------------- categorías ---

const EsquemaCategoria = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre de la categoría.").max(60),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Elige un color."),
  tipoSugerido: z.enum(["fijo", "variable"]),
  activo: z.boolean(),
});

export async function guardarCategoriaAccion(_prev: EstadoGasto, datos: FormData): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");
  const parsed = EsquemaCategoria.safeParse({
    nombre: datos.get("nombre"),
    color: datos.get("color"),
    tipoSugerido: datos.get("tipoSugerido"),
    activo: datos.get("activo") === "on" || datos.get("activo") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const id = Number(datos.get("id") ?? 0);
  try {
    if (id > 0) actualizarCategoria(id, parsed.data);
    else crearCategoria(parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { error: msg.includes("UNIQUE") ? "Ya existe una categoría con ese nombre." : msg || "No se pudo guardar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "gasto.categoria",
    entidad: "categorias_gasto",
    entidadId: id > 0 ? id : null,
    cambios: parsed.data,
  });
  revalidar();
  revalidatePath("/finanzas/gastos/categorias");
  return { ok: id > 0 ? "Categoría actualizada." : "Categoría creada." };
}
