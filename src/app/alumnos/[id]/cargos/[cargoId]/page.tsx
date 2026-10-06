import { notFound } from "next/navigation";

import { exigirPermiso } from "@/lib/auth/permisos";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { cargoPorId } from "@/lib/datos/finanzas";
import { FormularioEditarCargo } from "./formulario";

export const dynamic = "force-dynamic";

export default async function EditarCargo({
  params,
}: {
  params: Promise<{ id: string; cargoId: string }>;
}) {
  await exigirPermiso("pagos.registrar");
  const { id, cargoId } = await params;

  const alumnoId = Number(id);
  const cId = Number(cargoId);
  if (!Number.isInteger(alumnoId) || !Number.isInteger(cId)) notFound();

  const alumno = alumnoPorId(alumnoId);
  if (!alumno) notFound();

  const cargo = cargoPorId(cId);
  if (!cargo || cargo.alumnoId !== alumnoId) notFound();

  const aplicado = cargo.aplicadoCentavos;
  const saldado = aplicado >= cargo.montoCentavos;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6">
        <a
          href={`/alumnos/${alumnoId}`}
          className="text-xs text-vs-tinta-3 no-underline hover:underline"
        >
          ← Volver al expediente
        </a>
        <h1 className="mt-3 text-xl font-semibold text-vs-tinta">
          Editar cargo · {alumno.nombre}
        </h1>
        <p className="mt-1 text-sm text-vs-tinta-3">
          Modifica la descripción, periodo, monto o fecha de vencimiento del cargo.
        </p>
      </div>

      {saldado && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este cargo ya está <strong>saldado</strong> (${(aplicado / 100).toLocaleString("es-MX")} aplicados).
          Puedes editarlo, pero si reduces el monto por debajo de lo ya pagado, la diferencia
          quedará como saldo a favor del alumno.
        </div>
      )}

      {aplicado > 0 && !saldado && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Este cargo tiene <strong>${(aplicado / 100).toLocaleString("es-MX")} ya abonados</strong>.
          Si cambias el monto, el saldo pendiente se recalcula automáticamente.
        </div>
      )}

      <FormularioEditarCargo
        cargoId={cId}
        alumnoId={alumnoId}
        inicial={{
          descripcion: cargo.descripcion,
          periodo: cargo.periodo ?? "",
          monto: (cargo.montoCentavos / 100).toFixed(2),
          venceEl: cargo.venceEl,
        }}
      />
    </main>
  );
}
