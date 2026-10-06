"use client";

import Link from "next/link";

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
