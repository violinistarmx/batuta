import "server-only";

import { and, asc, desc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { categoriasGasto, gastos, programas, sedes, usuarios } from "@/db/schema/index";

/**
 * Gastos de la academia.
 *
 * La categoría vive en `categorias_gasto` y es editable. La columna de texto
 * `gastos.categoria` (la lista fija de antes) se sigue llenando por compatibilidad
 * con la migración reversible y con las gráficas viejas, pero ya no manda.
 */

/** Categorías de la lista fija anterior. Solo por compatibilidad. */
export type CategoriaGasto =
  | "renta"
  | "servicios"
  | "instrumentos"
  | "material"
  | "mantenimiento"
  | "publicidad"
  | "otro";

export const ETIQUETA_CATEGORIA: Record<CategoriaGasto, string> = {
  renta: "Renta",
  servicios: "Servicios",
  instrumentos: "Instrumentos",
  material: "Material",
  mantenimiento: "Mantenimiento",
  publicidad: "Publicidad",
  otro: "Otro",
};

/** De la categoría editable a la clave fija vieja, para no dejar la columna vacía. */
function categoriaLegada(nombre: string, clave: string | null): CategoriaGasto {
  if (clave === "publicidad") return "publicidad";
  const n = nombre.toLowerCase();
  if (n.includes("arrend") || n.includes("renta")) return "renta";
  if (n.includes("servicio")) return "servicios";
  if (n.includes("material")) return "material";
  if (n.includes("instrument")) return "instrumentos";
  if (n.includes("mantenim")) return "mantenimiento";
  return "otro";
}

export type DatosGasto = {
  categoriaId: number;
  subcategoria: string | null;
  tipo: "fijo" | "variable";
  sedeId: number | null;
  programaId: number | null;
  concepto: string;
  montoCentavos: number;
  fecha: string;
};

// ------------------------------------------------------------------ gastos ---

export type FiltroGastos = { categoriaId?: number | null };

/** Gastos del periodo con su categoría, sede, programa y quien los registró. */
export function gastosDelPeriodo(desde: string, hasta: string, f: FiltroGastos = {}) {
  return db
    .select({
      id: gastos.id,
      categoria: gastos.categoria,
      categoriaId: gastos.categoriaId,
      categoriaNombre: categoriasGasto.nombre,
      categoriaColor: categoriasGasto.color,
      subcategoria: gastos.subcategoria,
      tipo: gastos.tipo,
      sedeId: gastos.sedeId,
      sede: sedes.nombre,
      programaId: gastos.programaId,
      programa: programas.nombre,
      concepto: gastos.concepto,
      montoCentavos: gastos.montoCentavos,
      fecha: gastos.fecha,
      creadoEn: gastos.creadoEn,
      registradoPor: usuarios.nombre,
    })
    .from(gastos)
    .leftJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
    .leftJoin(sedes, eq(sedes.id, gastos.sedeId))
    .leftJoin(programas, eq(programas.id, gastos.programaId))
    .leftJoin(usuarios, eq(usuarios.id, gastos.registradoPor))
    .where(and(
      gte(gastos.fecha, desde),
      lte(gastos.fecha, hasta),
      f.categoriaId ? eq(gastos.categoriaId, f.categoriaId) : undefined,
    ))
    .orderBy(desc(gastos.fecha), desc(gastos.id))
    .all();
}

/** Un gasto por id. */
export function gastoPorId(id: number) {
  return db.select().from(gastos).where(eq(gastos.id, id)).get();
}

function conLegada(d: DatosGasto) {
  const cat = db.select({ nombre: categoriasGasto.nombre, clave: categoriasGasto.clave })
    .from(categoriasGasto).where(eq(categoriasGasto.id, d.categoriaId)).get();
  if (!cat) throw new Error("Elige una categoría válida.");
  return { ...d, categoria: categoriaLegada(cat.nombre, cat.clave) };
}

/** Crea un gasto y devuelve su id. */
export function registrarGasto(d: DatosGasto, usuarioId: number): number {
  const r = db
    .insert(gastos)
    .values({ ...conLegada(d), registradoPor: usuarioId })
    .returning({ id: gastos.id })
    .get();
  if (!r) throw new Error("No se pudo registrar el gasto.");
  return r.id;
}

/** Edita un gasto. */
export function actualizarGasto(id: number, d: DatosGasto): void {
  const r = db.update(gastos).set(conLegada(d)).where(eq(gastos.id, id)).run();
  if (r.changes === 0) throw new Error("No se encontró el gasto.");
}

/** Elimina un gasto. Solo dirección. */
export function eliminarGasto(id: number): void {
  db.delete(gastos).where(eq(gastos.id, id)).run();
}

/** Subcategorías ya usadas en una categoría, para sugerirlas al capturar. */
export function subcategoriasUsadas(): { categoriaId: number; subcategoria: string }[] {
  return db.selectDistinct({ categoriaId: gastos.categoriaId, subcategoria: gastos.subcategoria })
    .from(gastos)
    .where(and(isNotNull(gastos.categoriaId), isNotNull(gastos.subcategoria), ne(gastos.subcategoria, "")))
    .orderBy(asc(gastos.subcategoria))
    .all() as { categoriaId: number; subcategoria: string }[];
}

/** Totales por categoría (lista fija vieja). Lo usa la gráfica de dona heredada. */
export function gastosPorCategoria(desde: string, hasta: string): { categoria: CategoriaGasto; totalCentavos: number }[] {
  return db
    .select({
      categoria: gastos.categoria,
      totalCentavos: sql<number>`coalesce(sum(${gastos.montoCentavos}), 0)`,
    })
    .from(gastos)
    .where(and(gte(gastos.fecha, desde), lte(gastos.fecha, hasta)))
    .groupBy(gastos.categoria)
    .orderBy(sql`sum(${gastos.montoCentavos}) desc`)
    .all() as { categoria: CategoriaGasto; totalCentavos: number }[];
}

/**
 * Matriz anual categoría × mes: la base de la tabla editable de /finanzas/gastos.
 * Devuelve totales por (categoría, mes) del año.
 */
export function matrizDeGastos(anio: number) {
  return db
    .select({
      categoriaId: gastos.categoriaId,
      mes: sql<string>`substr(${gastos.fecha}, 1, 7)`,
      totalCentavos: sql<number>`coalesce(sum(${gastos.montoCentavos}), 0)`,
      cuantos: sql<number>`count(*)`,
    })
    .from(gastos)
    .where(and(gte(gastos.fecha, `${anio}-01-01`), lte(gastos.fecha, `${anio}-12-31`)))
    .groupBy(gastos.categoriaId, sql`substr(${gastos.fecha}, 1, 7)`)
    .all();
}

// -------------------------------------------------------------- categorías ---

export type DatosCategoria = {
  nombre: string;
  color: string;
  tipoSugerido: "fijo" | "variable";
  activo: boolean;
};

/** Categorías, en su orden. Con `soloActivas`, solo las que se ofrecen al capturar. */
export function categoriasDeGasto(soloActivas = false) {
  const q = db.select({
      id: categoriasGasto.id,
      nombre: categoriasGasto.nombre,
      color: categoriasGasto.color,
      tipoSugerido: categoriasGasto.tipoSugerido,
      orden: categoriasGasto.orden,
      activo: categoriasGasto.activo,
      clave: categoriasGasto.clave,
      usos: sql<number>`(SELECT count(*) FROM gastos g WHERE g.categoria_id = ${categoriasGasto.id})`,
    })
    .from(categoriasGasto);
  return (soloActivas ? q.where(eq(categoriasGasto.activo, true)) : q)
    .orderBy(asc(categoriasGasto.orden), asc(categoriasGasto.nombre))
    .all();
}

export function crearCategoria(d: DatosCategoria): number {
  const orden = db.select({ m: sql<number>`coalesce(max(${categoriasGasto.orden}), -1) + 1` })
    .from(categoriasGasto).get()?.m ?? 0;
  const r = db.insert(categoriasGasto).values({ ...d, orden }).returning({ id: categoriasGasto.id }).get();
  if (!r) throw new Error("No se pudo crear la categoría.");
  return r.id;
}

/**
 * Edita una categoría. No se borran: se desactivan, para que los gastos que ya la
 * usan sigan teniendo nombre y color en reportes pasados.
 */
export function actualizarCategoria(id: number, d: DatosCategoria): void {
  const r = db.update(categoriasGasto).set(d).where(eq(categoriasGasto.id, id)).run();
  if (r.changes === 0) throw new Error("No se encontró la categoría.");
}

// ------------------------------------------------------------ catálogos ---

export function sedesActivas() {
  return db.select({ id: sedes.id, nombre: sedes.nombre }).from(sedes)
    .where(eq(sedes.activo, true)).orderBy(asc(sedes.orden)).all();
}

export function programasParaGastos() {
  return db.select({ id: programas.id, nombre: programas.nombre }).from(programas)
    .orderBy(asc(programas.orden)).all();
}
