import { notFound } from "next/navigation";
import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { gastoPorId } from "@/lib/datos/gastos";
import { editarGastoAccion, eliminarGastoAccion } from "../acciones";
import { BtnEliminar, FormularioGasto } from "../cliente";

export const dynamic = "force-dynamic";

export default async function EditarGasto({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sesion = await exigirPermiso("gastos.gestionar");
  const { id: idParam } = await searchParams;
  const gasto = gastoPorId(Number(idParam));
  if (!gasto) notFound();

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <main className="mx-auto max-w-xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}
          <Link href="/finanzas/gastos" className="no-underline hover:underline">Gastos</Link>
          {" "}›{" "}Editar
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Editar gasto</h1>
          <BtnEliminar accion={eliminarGastoAccion} gastoId={gasto.id} />
        </div>

        <FormularioGasto
          accion={editarGastoAccion}
          inicial={{
            id: gasto.id,
            categoria: gasto.categoria,
            concepto: gasto.concepto,
            montoCentavos: gasto.montoCentavos,
            fecha: gasto.fecha,
          }}
          etiquetaBoton="Guardar cambios"
        />
      </main>
    </>
  );
}
