import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { InsigniaPago } from "@/components/vale-entrega";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { sesionActual } from "@/lib/auth/sesion";
import { valePorToken } from "@/lib/datos/vales";
import { evaluarEntrega } from "@/lib/dominio/vales";
import { fechaCivil, horaCivil } from "@/lib/zona";
import { pesosExactos } from "@/lib/formato";
import { Entrega } from "./entrega";

export const dynamic = "force-dynamic";

/**
 * A donde apunta el QR del vale.
 *
 * Escanear NO entrega nada: esta ruta solo muestra el vale. Sin sesión manda a entrar y,
 * tras iniciarla, regresa aquí; la entrega se confirma con un botón y exige el permiso
 * `vales.entregar`. Quien escanea sin permiso recibe 404, igual que con cualquier ruta
 * restringida: no se confirma ni que el vale exista.
 */
export default async function Vale({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await sesionActual())) redirect(`/entrar?siguiente=${encodeURIComponent(`/vales/${token}`)}`);
  const sesion = await exigirPermiso("vales.entregar");

  const v = valePorToken(token);
  if (!v) notFound();

  const decision = evaluarEntrega(v.estado, v);
  const puedeExcepcion = tienePermiso(sesion, "vales.autorizar_excepcion");

  return (
    <>
      <Encabezado sesion={sesion} activo="entregas" />
      <main className="mx-auto max-w-lg px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/entregas" className="no-underline hover:underline">Entregas</Link>
          {" "}›{" "}Vale
        </p>
        <h1 className="mt-2 font-mono text-2xl font-semibold tabular-nums">{v.codigo}</h1>

        <dl className="mt-5 divide-y divide-vs-linea rounded-xl border border-vs-linea bg-white text-sm">
          {[
            ["Producto", v.concepto],
            ["Alumno", `${v.alumno} · ${v.alumnoCodigo}`],
            ["Sede", v.sede ?? "—"],
            ["Importe", pesosExactos(v.montoCentavos)],
          ].map(([k, valor]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-vs-tinta-3">{k}</dt>
              <dd className="text-right font-medium">{valor}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-vs-tinta-3">Pago</dt>
            <dd>{v.cancelado ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">Cargo cancelado</span> : <InsigniaPago v={v} />}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-vs-tinta-3">Estado</dt>
            <dd className="font-semibold">{v.estado === "entregado" ? "Entregado" : "Pendiente de entrega"}</dd>
          </div>
          {v.estado === "entregado" && v.entregadoEn && (
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-vs-tinta-3">Entregado</dt>
              <dd className="text-right font-medium">
                {fechaCivil(v.entregadoEn)} {horaCivil(v.entregadoEn)}<br />
                <span className="text-xs font-normal text-vs-tinta-3">por {v.entregadoPor ?? "—"}</span>
              </dd>
            </div>
          )}
          {v.excepcionMotivo && (
            <div className="px-4 py-2.5">
              <dt className="text-vs-tinta-3">Entregado con excepción</dt>
              <dd className="mt-0.5 font-medium">{v.excepcionMotivo}</dd>
            </div>
          )}
        </dl>

        <section className="mt-6" aria-label="Entrega">
          {decision.permitida ? (
            <Entrega token={token} conExcepcion={false} />
          ) : (
            <>
              <p className="rounded-lg border border-vs-linea bg-white px-4 py-3 text-sm text-vs-tinta-2">
                {decision.mensaje}
              </p>
              {decision.excepcionPosible && (
                <div className="mt-4">
                  {puedeExcepcion ? (
                    <Entrega token={token} conExcepcion />
                  ) : (
                    <p className="text-xs text-vs-tinta-3">
                      Solo el director puede autorizar la entrega sin pago completo.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <p className="mt-8 text-xs text-vs-tinta-3">
          <Link href={`/alumnos/${v.alumnoId}`} className="hover:underline">Ver expediente del alumno</Link>
        </p>
      </main>
    </>
  );
}
