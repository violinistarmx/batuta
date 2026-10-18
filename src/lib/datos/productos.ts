import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { productos } from "@/db/schema/index";
import { margenDe } from "@/lib/dominio/productos";

/**
 * Catálogo de productos.
 *
 * El costo y el margen están en funciones APARTE (`costosDeProductos`) a propósito: las
 * listas que usa el flujo de venta —lo que ve la familia frente al mostrador— no
 * seleccionan esas columnas, así que no hay forma de que lleguen a esa pantalla.
 */

export type CategoriaProducto = "metodo" | "instrumento" | "accesorio" | "papeleria" | "otro";

export const CATEGORIAS_PRODUCTO: { valor: CategoriaProducto; etiqueta: string }[] = [
  { valor: "metodo", etiqueta: "Método" },
  { valor: "instrumento", etiqueta: "Instrumento" },
  { valor: "accesorio", etiqueta: "Accesorio" },
  { valor: "papeleria", etiqueta: "Papelería" },
  { valor: "otro", etiqueta: "Otro" },
];

/** Lo que ve quien vende: nombre y precio. Nada de costo. */
export function productosParaVenta() {
  return db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      nombre: productos.nombre,
      categoria: productos.categoria,
      precioCentavos: productos.precioCentavos,
    })
    .from(productos)
    .where(eq(productos.activo, true))
    .orderBy(asc(productos.nombre))
    .all();
}

/** Catálogo completo para la pantalla de administración. Sin costo. */
export function catalogoDeProductos() {
  return db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      nombre: productos.nombre,
      categoria: productos.categoria,
      descripcion: productos.descripcion,
      precioCentavos: productos.precioCentavos,
      activo: productos.activo,
    })
    .from(productos)
    .orderBy(asc(productos.nombre))
    .all();
}

export function productoPorId(id: number) {
  return db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      nombre: productos.nombre,
      categoria: productos.categoria,
      descripcion: productos.descripcion,
      precioCentavos: productos.precioCentavos,
      activo: productos.activo,
    })
    .from(productos)
    .where(eq(productos.id, id))
    .get();
}

export type CostoProducto = {
  id: number;
  costoCentavos: number;
  margenCentavos: number;
  margenPct: number | null;
};

/**
 * Costo y margen de cada producto. SOLO para quien tenga `productos.gestionar`: quien
 * la llama debe haber exigido el permiso antes.
 */
export function costosDeProductos(): CostoProducto[] {
  return db
    .select({ id: productos.id, costo: productos.costoCentavos, precio: productos.precioCentavos })
    .from(productos)
    .all()
    .map((p) => ({ id: p.id, costoCentavos: p.costo, ...margenDe(p.precio, p.costo) }));
}

/** El costo de un producto, para precargarlo al editar. Mismo requisito de permiso. */
export function costoDeProducto(id: number): number | null {
  return db.select({ costo: productos.costoCentavos }).from(productos)
    .where(eq(productos.id, id)).get()?.costo ?? null;
}

export type DatosProducto = {
  codigo: string | null;
  nombre: string;
  categoria: CategoriaProducto;
  descripcion: string | null;
  /** Al editar, `undefined` deja el costo como está: no se muestra para precargarlo. */
  costoCentavos?: number;
  precioCentavos: number;
};

export function crearProducto(d: DatosProducto & { costoCentavos: number }, usuarioId: number): number {
  const r = db.insert(productos).values({ ...d, creadoPor: usuarioId })
    .returning({ id: productos.id }).get();
  if (!r) throw new Error("No se pudo crear el producto.");
  return r.id;
}

export function actualizarProducto(id: number, d: DatosProducto): void {
  const r = db.update(productos).set(d).where(eq(productos.id, id)).run();
  if (r.changes === 0) throw new Error("No se encontró el producto.");
}

export function activarProducto(id: number, activo: boolean): void {
  const r = db.update(productos).set({ activo }).where(eq(productos.id, id)).run();
  if (r.changes === 0) throw new Error("No se encontró el producto.");
}
