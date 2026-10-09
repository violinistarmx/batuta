import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { gastos, usuarios } from "@/db/schema/index";

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

export type DatosGasto = {
  categoria: CategoriaGasto;
  concepto: string;
  montoCentavos: number;
  fecha: string;
};

/** Lista gastos del periodo con quien los registró. */
export function gastosDelPeriodo(desde: string, hasta: string) {
  return db
    .select({
      id: gastos.id,
      categoria: gastos.categoria,
      concepto: gastos.concepto,
      montoCentavos: gastos.montoCentavos,
      fecha: gastos.fecha,
      creadoEn: gastos.creadoEn,
      registradoPor: usuarios.nombre,
    })
    .from(gastos)
    .leftJoin(usuarios, eq(usuarios.id, gastos.registradoPor))
    .where(and(gte(gastos.fecha, desde), lte(gastos.fecha, hasta)))
    .orderBy(desc(gastos.fecha), desc(gastos.id))
    .all();
}

/** Un gasto por id. */
export function gastoPorId(id: number) {
  return db.select().from(gastos).where(eq(gastos.id, id)).get();
}

/** Crea un gasto y devuelve su id. */
export function registrarGasto(d: DatosGasto, usuarioId: number): number {
  const r = db
    .insert(gastos)
    .values({ ...d, registradoPor: usuarioId })
    .returning({ id: gastos.id })
    .get();
  if (!r) throw new Error("No se pudo registrar el gasto.");
  return r.id;
}

/** Edita concepto, categoría, monto y fecha de un gasto. */
export function actualizarGasto(id: number, d: DatosGasto): void {
  const r = db
    .update(gastos)
    .set({ categoria: d.categoria, concepto: d.concepto, montoCentavos: d.montoCentavos, fecha: d.fecha })
    .where(eq(gastos.id, id))
    .run();
  if (r.changes === 0) throw new Error("No se encontró el gasto.");
}

/** Elimina un gasto. Solo dirección. */
export function eliminarGasto(id: number): void {
  db.delete(gastos).where(eq(gastos.id, id)).run();
}

/** Totales por categoría dentro del periodo para la vista de resumen. */
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
