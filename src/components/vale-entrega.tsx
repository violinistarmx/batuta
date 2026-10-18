import { pesosExactos } from "@/lib/formato";
import { evaluarEntrega } from "@/lib/dominio/vales";

type Vale = {
  codigo: string;
  estado: "pendiente" | "entregado";
  concepto: string;
  montoCentavos: number;
  aplicadoCentavos: number;
  cancelado: boolean;
};

/** Cómo va el pago del cargo del vale, en una palabra. */
export function estadoDePago(v: Pick<Vale, "montoCentavos" | "aplicadoCentavos">): "pagado" | "parcial" | "sin_pagar" {
  if (v.aplicadoCentavos >= v.montoCentavos) return "pagado";
  return v.aplicadoCentavos > 0 ? "parcial" : "sin_pagar";
}

const PAGO = {
  pagado: { texto: "Pagado", clase: "bg-green-50 text-green-800" },
  parcial: { texto: "Pago parcial", clase: "bg-amber-50 text-amber-900" },
  sin_pagar: { texto: "Sin pagar", clase: "bg-red-50 text-red-800" },
} as const;

export function InsigniaPago({ v }: { v: Pick<Vale, "montoCentavos" | "aplicadoCentavos"> }) {
  const p = PAGO[estadoDePago(v)];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.clase}`}>{p.texto}</span>;
}

/**
 * Vale de entrega con su código y su QR. Lo usan la página del cargo y el comprobante de
 * pago. Muestra el concepto y el estado; nunca el costo del producto.
 */
export function ValeEntrega({ vale, qrSvg, claseExtra = "" }: { vale: Vale; qrSvg: string; claseExtra?: string }) {
  const decision = evaluarEntrega(vale.estado, vale);
  const leyenda = vale.estado === "entregado"
    ? "Producto entregado."
    : vale.cancelado
      ? "Cargo cancelado: este vale ya no sirve."
      : decision.permitida
        ? "Pagado. Presenta este vale para recoger el producto."
        : "Se entrega cuando el cargo esté pagado.";

  return (
    <section className={`vale-entrega flex items-center gap-4 rounded-xl border border-vs-linea bg-white p-4 ${claseExtra}`}
             aria-label="Vale de entrega">
      <div className="h-[120px] w-[120px] shrink-0 [&>svg]:h-full [&>svg]:w-full"
           role="img" aria-label={`Código QR del vale ${vale.codigo}`}
           dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">Vale de entrega</p>
        <p className="font-mono text-lg font-semibold tabular-nums">{vale.codigo}</p>
        <p className="truncate text-sm text-vs-tinta-2">{vale.concepto}</p>
        <p className="mt-1 text-xs text-vs-tinta-3">
          {vale.estado === "entregado" ? "Entregado" : "Pendiente de entrega"} · {pesosExactos(vale.montoCentavos)}
        </p>
        <p className="mt-1 text-xs text-vs-tinta-2">{leyenda}</p>
      </div>
    </section>
  );
}
