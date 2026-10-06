"use client";

import Link from "next/link";
import { useActionState } from "react";

import { anularPagoAccion, type EstadoAnular } from "@/app/finanzas/acciones";

function BotonAnular({ reciboId }: { reciboId: number }) {
  const [estado, accion] = useActionState<EstadoAnular, FormData>(anularPagoAccion, {});

  function handleSubmit(e: { preventDefault: () => void }) {
    const ok = window.confirm(
      "¿Anular este pago?\n\n" +
      "Se eliminará el recibo y las aplicaciones. " +
      "Los cargos que cubría quedarán pendientes de nuevo.\n\n" +
      "Esta acción no se puede deshacer.",
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form action={accion} onSubmit={handleSubmit}>
      <input type="hidden" name="reciboId" value={reciboId} />
      {estado.error && (
        <p className="text-xs text-red-700">{estado.error}</p>
      )}
      <button
        type="submit"
        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold
                   text-red-700 transition hover:bg-red-50 focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        Anular pago
      </button>
    </form>
  );
}

/**
 * Barra de acciones del recibo. No se imprime: `@media print` la oculta.
 *
 * El navegador genera el PDF con «Guardar como PDF» en el diálogo de impresión.
 * Es fidelidad exacta y cero dependencias; un PDF generado en el servidor haría
 * falta cuando el sistema envíe recibos por correo solo, que llega en la fase 2.
 */
export function Imprimir({
  volverA, folio, reciboId,
}: {
  volverA: string; folio: string; reciboId: number;
}) {
  return (
    <div className="no-imprimir mx-auto flex max-w-[820px] flex-wrap items-center gap-3 px-5 pt-6">
      <Link href={volverA} className="text-xs text-vs-tinta-3 no-underline hover:underline">
        ← Volver al expediente
      </Link>

      <Link
        href={`/recibos/${reciboId}/editar`}
        className="rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm font-semibold
                   text-vs-tinta-2 transition hover:bg-vs-crema focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
      >
        Editar pago
      </Link>

      <BotonAnular reciboId={reciboId} />

      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                   transition hover:bg-vs-naranja-claro focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
      >
        Imprimir o guardar como PDF
      </button>

      <p className="w-full text-xs text-vs-tinta-3">
        Folio <strong>{folio}</strong>. En el diálogo de impresión elige «Guardar como PDF»
        para enviarlo por WhatsApp o correo.
      </p>
    </div>
  );
}
