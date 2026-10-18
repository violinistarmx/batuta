import "server-only";

import { categoriasDeGasto, programasParaGastos, sedesActivas, subcategoriasUsadas } from "@/lib/datos/gastos";

/** Lo que necesita el formulario de gasto: categorías activas, sedes, programas y sugerencias. */
export function opcionesFormulario() {
  return {
    categorias: categoriasDeGasto(true).map((c) => ({
      id: c.id, nombre: c.nombre, color: c.color, tipoSugerido: c.tipoSugerido,
    })),
    sedes: sedesActivas(),
    programas: programasParaGastos(),
    subcategorias: subcategoriasUsadas(),
  };
}

/** Ruta de vuelta segura: solo dentro de /finanzas/gastos. */
export function volverSeguro(v: string | undefined): string {
  return v && v.startsWith("/finanzas/gastos") && !v.includes("//") ? v : "/finanzas/gastos";
}
