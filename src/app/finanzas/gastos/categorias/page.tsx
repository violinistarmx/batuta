import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { categoriasDeGasto } from "@/lib/datos/gastos";
import { guardarCategoriaAccion } from "../acciones";
import { FormularioCategoria } from "../cliente";

export const dynamic = "force-dynamic";

export default async function CategoriasDeGasto() {
  const sesion = await exigirPermiso("gastos.gestionar");
  const categorias = categoriasDeGasto();

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}
          <Link href="/finanzas/gastos" className="no-underline hover:underline">Gastos</Link>
          {" "}›{" "}Categorías
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Categorías de gasto</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          El color es el que se usa en las gráficas y en la matriz. El tipo sugerido se propone al
          capturar un gasto. Una categoría con gastos no se borra: se desactiva, para que los
          reportes pasados conserven su nombre.
        </p>

        <section className="mt-6 divide-y divide-vs-linea rounded-xl border border-vs-linea bg-white px-4">
          {categorias.map((c) => (
            <div key={c.id}>
              <FormularioCategoria accion={guardarCategoriaAccion} inicial={c} />
              {c.clave === "publicidad" && (
                <p className="-mt-1 pb-2 text-xs text-vs-tinta-3">
                  Esta categoría alimenta el costo de adquisición (CAC). Puedes renombrarla; el sistema la reconoce igual.
                </p>
              )}
            </div>
          ))}
        </section>

        <h2 className="mt-8 font-display text-lg font-semibold">Agregar categoría</h2>
        <div className="mt-2 rounded-xl border border-dashed border-vs-linea bg-white px-4">
          <FormularioCategoria accion={guardarCategoriaAccion} />
        </div>
      </main>
    </>
  );
}
