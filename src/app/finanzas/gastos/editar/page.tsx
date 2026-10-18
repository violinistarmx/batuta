import { notFound } from "next/navigation";
import Link from "next/link";

import { exigirPermiso } from "@/lib/auth/permisos";
import { gastoPorId } from "@/lib/datos/gastos";
import { editarGastoAccion, eliminarGastoAccion } from "../acciones";
import { BtnEliminar, FormularioGasto } from "../cliente";
import { opcionesFormulario, volverSeguro } from "../opciones";

export const dynamic = "force-dynamic";

export default async function EditarGasto({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; volver?: string }>;
}) {
  const sesion = await exigirPermiso("gastos.gestionar");
  const sp = await searchParams;
  const gasto = gastoPorId(Number(sp.id));
  if (!gasto) notFound();
  const volver = volverSeguro(sp.volver);
  const opciones = opcionesFormulario();

  // Si la categoría del gasto está desactivada, se ofrece igual para no perderla al guardar.
  if (gasto.categoriaId !== null && !opciones.categorias.some((c) => c.id === gasto.categoriaId)) {
    const { categoriasDeGasto } = await import("@/lib/datos/gastos");
    const propia = categoriasDeGasto().find((c) => c.id === gasto.categoriaId);
    if (propia) opciones.categorias.push({
      id: propia.id, nombre: `${propia.nombre} (inactiva)`, color: propia.color, tipoSugerido: propia.tipoSugerido,
    });
  }

  return (
    <>
      <main className="mx-auto max-w-xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}
          <Link href="/finanzas/gastos" className="no-underline hover:underline">Gastos</Link>
          {" "}›{" "}Editar
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Editar gasto</h1>
          <BtnEliminar accion={eliminarGastoAccion} gastoId={gasto.id} volver={volver} />
        </div>

        <FormularioGasto
          accion={editarGastoAccion}
          {...opciones}
          volver={volver}
          inicial={{
            id: gasto.id,
            categoriaId: gasto.categoriaId,
            subcategoria: gasto.subcategoria,
            tipo: gasto.tipo,
            sedeId: gasto.sedeId,
            programaId: gasto.programaId,
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
