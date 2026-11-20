import { notFound } from "next/navigation";

import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { reciboPorId, renglonesDeRecibo } from "@/lib/datos/finanzas";
import { integrantesDelPlan } from "@/lib/datos/inscripciones";
import { agruparClases } from "@/lib/dominio/comprobante";
import { FormularioEditarPago } from "./formulario";

export const dynamic = "force-dynamic";

export default async function EditarPago({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("pagos.registrar");
  const { id } = await params;

  const reciboId = Number(id);
  if (!Number.isInteger(reciboId)) notFound();

  const r = reciboPorId(reciboId);
  if (!r) notFound();

  const puedeDescontar = tienePermiso(sesion, "configuracion.gestionar");

  // Plan familiar: un campo de clases por alumno del plan, con lo ya guardado de cada uno. Lo
  // guardado de alguien que ya no está en el plan se conserva como un bloque más: no se pierde.
  const primera = renglonesDeRecibo(r.pagoId).find((x) => x.inscripcionId !== null);
  const plan = primera?.inscripcionId != null ? integrantesDelPlan(primera.inscripcionId) : null;
  const guardadas = agruparClases(r.clasesTexto);
  const integrantes = plan
    ? [
        ...plan.map((m) => ({
          nombre: m.alumno,
          inicial: guardadas.find((g) => g.alumno === m.alumno)?.clases.join("\n") ?? "",
        })),
        ...guardadas
          .filter((g) => g.alumno && !plan.some((m) => m.alumno === g.alumno))
          .map((g) => ({ nombre: g.alumno!, inicial: g.clases.join("\n") })),
      ]
    : undefined;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6">
        <a
          href={`/recibos/${reciboId}`}
          className="text-xs text-vs-tinta-3 no-underline hover:underline"
        >
          ← Volver al comprobante
        </a>
        <h1 className="mt-3 text-xl font-semibold text-vs-tinta">
          Editar pago · Folio {r.folio}
        </h1>
        <p className="mt-1 text-sm text-vs-tinta-3">
          Al guardar, las aplicaciones se recalculan y el comprobante refleja los nuevos datos.
          El folio <strong>{r.folio}</strong> se conserva.
        </p>
      </div>

      <FormularioEditarPago
        reciboId={reciboId}
        pagoId={r.pagoId}
        alumnoId={r.alumnoId}
        alumno={r.alumno}
        folio={r.folio}
        inicial={{
          monto: (r.montoCentavos / 100).toFixed(2),
          descuento: r.descuentoCentavos > 0 ? (r.descuentoCentavos / 100).toFixed(2) : "",
          metodo: r.metodo,
          recibidoEl: r.recibidoEl,
          referencia: r.referencia ?? "",
          descripcion: r.descripcion ?? "",
          clasesTexto: r.clasesTexto ?? "",
          nota: r.nota ?? "",
          selloPago: r.selloPago,
        }}
        puedeDescontar={puedeDescontar}
        integrantes={integrantes}
      />
    </main>
  );
}
