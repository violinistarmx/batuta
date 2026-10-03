import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { cuentaPorEstado, listarMensajes } from "@/lib/datos/comunicacion";
import type { EstadoMensaje } from "@/lib/dominio/plantillas";
import { hora } from "@/lib/formato";

export const dynamic = "force-dynamic";

const NOMBRE: Record<EstadoMensaje, string> = {
  borrador: "Por aprobar", aprobado: "Listos para mandar", rechazado: "Devueltos",
  enviado: "Enviados", cancelado: "Cancelados",
};

const COLOR: Record<EstadoMensaje, string> = {
  borrador: "border-amber-300 bg-amber-50",
  aprobado: "border-green-300 bg-green-50",
  rechazado: "border-red-300 bg-red-50",
  enviado: "border-vs-linea bg-white",
  cancelado: "border-vs-linea bg-white",
};

export default async function Comunicacion({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const sesion = await exigirPermiso("comunicacion.redactar");
  const { estado } = await searchParams;

  const estados: EstadoMensaje[] = ["borrador", "aprobado", "rechazado", "enviado", "cancelado"];
  const filtro = (estados.includes(estado as EstadoMensaje)
    ? estado as EstadoMensaje
    : "borrador");

  const cuenta = cuentaPorEstado();
  const filas = listarMensajes(filtro);
  const puedeAprobar = tienePermiso(sesion, "comunicacion.aprobar");

  return (
    <>
      <Encabezado sesion={sesion} activo="comunicacion" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Comunicación</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Nada sale de la academia sin que alguien lo lea antes. Se redacta, se aprueba y
          entonces se manda — y queda registrado quién hizo cada cosa.
        </p>

        {cuenta.borrador > 0 && puedeAprobar && (
          <p id="aviso-por-aprobar"
             className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Hay <strong>{cuenta.borrador}</strong> mensaje{cuenta.borrador === 1 ? "" : "s"} esperando
            tu aprobación. Mientras tanto no los recibe nadie.
          </p>
        )}

        <nav className="mt-6 flex flex-wrap gap-1.5 text-sm">
          {estados.map((e) => (
            <Link
              key={e}
              href={`/comunicacion?estado=${e}`}
              aria-current={filtro === e ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 no-underline transition ${
                filtro === e
                  ? "border-vs-naranja bg-vs-amarillo-suave font-medium"
                  : "border-vs-linea bg-white hover:border-vs-naranja-700"
              }`}
            >
              {NOMBRE[e]} <span className="text-vs-tinta-3">({cuenta[e]})</span>
            </Link>
          ))}
        </nav>

        {filas.length === 0 ? (
          <p id="sin-mensajes"
             className="mt-5 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
            Nada en esta bandeja.
          </p>
        ) : (
          <ul id="lista-mensajes" className="mt-5 flex flex-col gap-2">
            {filas.map((m) => (
              <li key={m.id} data-estado={m.estado}>
                <Link
                  href={`/comunicacion/${m.id}`}
                  className={`block rounded-lg border px-4 py-3 no-underline transition
                              hover:border-vs-naranja-700 ${COLOR[m.estado as EstadoMensaje]}`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium">{m.destinatario}</span>
                    <span className="text-xs text-vs-tinta-3">
                      {m.plantilla ?? "Mensaje suelto"}
                      {m.redactor ? ` · redactó ${m.redactor}` : ""}
                      {` · ${hora(m.creadoEn)}`}
                    </span>
                    {!m.telefono && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        sin teléfono
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-vs-tinta-2">
                    {m.cuerpo.split("\n")[0]}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-vs-tinta-3">
          El texto que se aprueba es el que sale: se guarda ya armado, no la plantilla más los
          datos. Si se guardara la receta, editar la plantilla después cambiaría el contenido de
          un mensaje ya aprobado y la aprobación dejaría de significar nada.
        </p>
      </main>
    </>
  );
}
