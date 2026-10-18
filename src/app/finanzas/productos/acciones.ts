"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  activarProducto, actualizarProducto, costosDeProductos, crearProducto,
  type CostoProducto,
} from "@/lib/datos/productos";

export type EstadoProducto = { error?: string; ok?: string };

const pesosACentavos = (s: string) => Math.round(Number(s) * 100);

const Esquema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nombre: z.string().trim().min(2, "Escribe el nombre del producto.").max(120),
  codigo: z.string().trim().max(40).transform((s) => (s === "" ? null : s)),
  categoria: z.enum(["metodo", "instrumento", "accesorio", "papeleria", "otro"]),
  descripcion: z.string().trim().max(1000).transform((s) => (s === "" ? null : s)),
  precio: z.string().trim().refine((s) => Number(s) > 0 && Number(s) <= 1_000_000, "Escribe un precio de venta válido."),
  // Vacío al editar = no cambiar el costo. Al crear es obligatorio (se revisa abajo).
  costo: z.string().trim().refine((s) => s === "" || (Number(s) >= 0 && Number(s) <= 1_000_000), "Escribe un costo válido."),
});

function leer(datos: FormData) {
  return Esquema.safeParse({
    id: datos.get("id") || undefined,
    nombre: datos.get("nombre"),
    codigo: datos.get("codigo") ?? "",
    categoria: datos.get("categoria"),
    descripcion: datos.get("descripcion") ?? "",
    precio: datos.get("precio"),
    costo: datos.get("costo") ?? "",
  });
}

function mensajeDeError(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m.includes("UNIQUE") && m.includes("nombre")) return "Ya existe un producto con ese nombre.";
  if (m.includes("UNIQUE") && m.includes("codigo")) return "Ya existe un producto con ese código.";
  return m || "No se pudo guardar el producto.";
}

export async function crearProductoAccion(_previo: EstadoProducto, datos: FormData): Promise<EstadoProducto> {
  const sesion = await exigirPermiso("productos.gestionar");
  const p = leer(datos);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisa los datos." };
  if (p.data.costo === "") return { error: "Escribe el costo del producto (lo que le cuesta a la academia)." };

  try {
    const id = crearProducto({
      codigo: p.data.codigo, nombre: p.data.nombre, categoria: p.data.categoria,
      descripcion: p.data.descripcion, precioCentavos: pesosACentavos(p.data.precio),
      costoCentavos: pesosACentavos(p.data.costo),
    }, sesion.usuarioId);
    // El costo nunca entra a la bitácora: la leen más personas que el catálogo.
    registrar({
      usuarioId: sesion.usuarioId, accion: "producto.crear", entidad: "productos", entidadId: id,
      cambios: { nombre: p.data.nombre, precioCentavos: pesosACentavos(p.data.precio) },
    });
  } catch (e) {
    return { error: mensajeDeError(e) };
  }
  revalidatePath("/finanzas/productos");
  return { ok: `«${p.data.nombre}» agregado al catálogo.` };
}

export async function editarProductoAccion(_previo: EstadoProducto, datos: FormData): Promise<EstadoProducto> {
  const sesion = await exigirPermiso("productos.gestionar");
  const p = leer(datos);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisa los datos." };
  if (!p.data.id) return { error: "No se encontró el producto." };

  const costoCambiado = p.data.costo !== "";
  try {
    actualizarProducto(p.data.id, {
      codigo: p.data.codigo, nombre: p.data.nombre, categoria: p.data.categoria,
      descripcion: p.data.descripcion, precioCentavos: pesosACentavos(p.data.precio),
      costoCentavos: costoCambiado ? pesosACentavos(p.data.costo) : undefined,
    });
    registrar({
      usuarioId: sesion.usuarioId, accion: "producto.editar", entidad: "productos", entidadId: p.data.id,
      cambios: { nombre: p.data.nombre, precioCentavos: pesosACentavos(p.data.precio), costoCambiado },
    });
  } catch (e) {
    return { error: mensajeDeError(e) };
  }
  revalidatePath("/finanzas/productos");
  return { ok: "Cambios guardados. Las ventas anteriores conservan el costo que tenían." };
}

export async function activarProductoAccion(id: number, activo: boolean): Promise<EstadoProducto> {
  const sesion = await exigirPermiso("productos.gestionar");
  try {
    activarProducto(id, activo);
  } catch (e) {
    return { error: mensajeDeError(e) };
  }
  registrar({
    usuarioId: sesion.usuarioId, accion: "producto.editar", entidad: "productos", entidadId: id,
    cambios: { activo },
  });
  revalidatePath("/finanzas/productos");
  return {};
}

/**
 * Costos y márgenes del catálogo, solo cuando se piden. La página no los incluye al
 * renderizar: no viajan al navegador hasta que alguien con permiso pulsa el botón, y
 * cada vez queda en la bitácora.
 */
export async function revelarCostosAccion(): Promise<{ costos?: CostoProducto[]; error?: string }> {
  const sesion = await exigirPermiso("productos.gestionar");
  registrar({
    usuarioId: sesion.usuarioId, accion: "producto.ver_costos", entidad: "productos", entidadId: null,
  });
  return { costos: costosDeProductos() };
}
