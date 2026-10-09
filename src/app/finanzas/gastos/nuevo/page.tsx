import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrarGastoAccion } from "../acciones";
import { FormularioGasto } from "../cliente";

export const dynamic = "force-dynamic";

export default async function NuevoGasto() {
  const sesion = await exigirPermiso("gastos.gestionar");

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}
          <Link href="/finanzas/gastos" className="no-underline hover:underline">Gastos</Link>
          {" "}›{" "}Nuevo
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Nuevo gasto</h1>
        <p className="mt-1 text-sm text-vs-tinta-3">
          Los gastos registrados aparecen en el resultado administrativo del periodo.
        </p>
        <FormularioGasto accion={registrarGastoAccion} etiquetaBoton="Registrar gasto" />
      </main>
    </>
  );
}
