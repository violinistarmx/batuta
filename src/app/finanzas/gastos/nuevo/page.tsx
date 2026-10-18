import Link from "next/link";

import { exigirPermiso } from "@/lib/auth/permisos";
import { limitesDeMes } from "@/lib/finanzas/fechas";
import { hoyEnMexico } from "@/lib/zona";
import { registrarGastoAccion } from "../acciones";
import { FormularioGasto } from "../cliente";
import { opcionesFormulario, volverSeguro } from "../opciones";

export const dynamic = "force-dynamic";

export default async function NuevoGasto({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; mes?: string; volver?: string }>;
}) {
  const sesion = await exigirPermiso("gastos.gestionar");
  const sp = await searchParams;
  const opciones = opcionesFormulario();

  // Desde una celda de la matriz llegan la categoría y el mes: el formulario los trae puestos.
  const categoria = opciones.categorias.find((c) => c.id === Number(sp.categoria));
  const hoy = hoyEnMexico();
  const fecha = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes)
    ? (sp.mes === hoy.slice(0, 7) ? hoy : limitesDeMes(sp.mes)[0])
    : hoy;

  return (
    <>
      <main className="mx-auto max-w-xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
          {" "}›{" "}
          <Link href="/finanzas/gastos" className="no-underline hover:underline">Gastos</Link>
          {" "}›{" "}Nuevo
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Nuevo gasto</h1>
        <p className="mt-1 text-sm text-vs-tinta-3">
          Los gastos alimentan el dashboard de finanzas: margen neto, flujo de caja y punto de equilibrio.
        </p>
        <FormularioGasto
          accion={registrarGastoAccion}
          {...opciones}
          volver={volverSeguro(sp.volver)}
          inicial={{
            categoriaId: categoria?.id ?? null,
            subcategoria: null,
            tipo: categoria?.tipoSugerido ?? "variable",
            sedeId: null,
            programaId: null,
            concepto: "",
            montoCentavos: null,
            fecha,
          }}
          etiquetaBoton="Registrar gasto"
        />
      </main>
    </>
  );
}
