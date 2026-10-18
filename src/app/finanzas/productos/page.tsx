import Link from "next/link";

import { exigirPermiso } from "@/lib/auth/permisos";
import { catalogoDeProductos } from "@/lib/datos/productos";
import { Catalogo } from "./cliente";

export const dynamic = "force-dynamic";

/**
 * Catálogo de productos de la academia. El costo y el margen NO se renderizan aquí:
 * se piden con un botón discreto y duran unos segundos en pantalla (ver `cliente.tsx`),
 * para poder mostrar el catálogo con la familia presente.
 */
export default async function Productos() {
  const sesion = await exigirPermiso("productos.gestionar");
  const productos = catalogoDeProductos();

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}Productos
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Productos</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Métodos, instrumentos, libretas y demás artículos que vende la academia. Al venderlos se
          crea un cargo con su vale de entrega. El costo sirve para calcular el margen en el
          dashboard de Finanzas; quien vende no lo ve.
        </p>

        <Catalogo productos={productos} />
      </main>
    </>
  );
}
