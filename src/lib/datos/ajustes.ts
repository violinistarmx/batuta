import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { esEditable, type Parametro } from "@/lib/dominio/ajustes";

export function listarParametros(): Parametro[] {
  return db.select().from(configuracion).orderBy(asc(configuracion.clave)).all() as Parametro[];
}

export function parametro(clave: string): Parametro | undefined {
  return db.select().from(configuracion).where(eq(configuracion.clave, clave)).get() as
    Parametro | undefined;
}

/**
 * Guarda un parámetro y devuelve el valor anterior, para la bitácora.
 *
 * El candado se vuelve a verificar aquí, no solo en la pantalla: una acción de
 * servidor recibe lo que le manden, y «el formulario no lo mostraba» nunca ha
 * sido una defensa.
 */
export function guardarParametro(clave: string, valor: string): { antes: string } {
  const actual = parametro(clave);
  if (!actual) throw new Error("Ese parámetro no existe.");
  if (!esEditable(clave)) throw new Error("Ese parámetro no se edita desde aquí.");

  db.update(configuracion)
    .set({ valor, actualizadoEn: new Date() })
    .where(eq(configuracion.clave, clave))
    .run();

  return { antes: actual.valor };
}

/**
 * Un parámetro numérico, con omisión si falta o si alguien lo dejó ilegible.
 *
 * La omisión existe para que una base a medio sembrar no tire una pantalla; no
 * es la regla. La regla está en `configuracion`, que es donde se puede cambiar
 * sin programar.
 */
export function valorEntero(clave: string, omision: number): number {
  const v = parametro(clave)?.valor;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : omision;
}
