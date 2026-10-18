import Link from "next/link";

import { cobranzaGlobal, pagosDelPeriodo } from "@/lib/datos/finanzas";
import { adeudoDe } from "@/lib/dominio/cobranza";
import { nombreDeMes } from "@/lib/finanzas/fechas";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

/**
 * Las dos cifras que se miran antes de todo lo demás, arriba de la barra lateral de Finanzas:
 * lo que ya entró este mes y lo que falta por cobrar. Son sumas directas, no el dashboard
 * completo: no encarecen cada pantalla de Finanzas.
 */
export function ResumenFinanzas() {
  const hoy = hoyEnMexico();
  const mes = hoy.slice(0, 7);
  const cobrado = pagosDelPeriodo(`${mes}-01`, hoy).reduce((s, p) => s + p.montoCentavos, 0);
  const porCobrar = cobranzaGlobal().reduce((s, c) => s + adeudoDe(c), 0);

  return (
    <dl className="grid gap-2 rounded-xl border border-vs-linea bg-vs-crema/60 p-3">
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-vs-tinta-3">Cobrado en {nombreDeMes(mes).toLowerCase()}</dt>
        <dd className="font-display text-lg font-semibold tabular-nums">{pesos(cobrado)}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-vs-tinta-3">Por cobrar</dt>
        <dd className="font-display text-lg font-semibold tabular-nums">
          <Link href="/finanzas/cobranza" className="no-underline hover:underline">{pesos(porCobrar)}</Link>
        </dd>
      </div>
    </dl>
  );
}
