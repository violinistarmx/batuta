import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { listarRecitales } from "@/lib/datos/recitales";
import { NOMBRE_RECITAL, lugaresDisponibles, type EstadoRecital } from "@/lib/dominio/recitales";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

const COLOR: Record<EstadoRecital, string> = {
  planeado: "bg-vs-crema text-vs-tinta-2",
  abierto: "bg-vs-amarillo-suave text-vs-tinta",
  programa_cerrado: "bg-green-100 text-green-900",
  realizado: "bg-vs-crema text-vs-tinta-3",
  cancelado: "bg-red-100 text-red-800",
};

export default async function Recitales() {
  const sesion = await exigirPermiso("recitales.leer");
  const hoy = hoyEnMexico();
  const lista = listarRecitales();
  const puedeCrear = tienePermiso(sesion, "recitales.gestionar");

  const proximos = lista.filter((r) => r.fecha >= hoy && r.estado !== "cancelado" && r.estado !== "realizado");
  const pasados = lista.filter((r) => !proximos.includes(r));

  const Tarjeta = ({ r }: { r: (typeof lista)[number] }) => {
    const libres = lugaresDisponibles({ capacidad: r.capacidad, vendidos: r.vendidos });
    return (
      <li>
        <Link href={`/recitales/${r.id}`}
              className="block rounded-lg border border-vs-linea bg-white px-4 py-3.5 no-underline
                         transition hover:border-vs-naranja-700">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-lg font-semibold">{r.nombre}</span>
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${COLOR[r.estado as EstadoRecital]}`}>
              {NOMBRE_RECITAL[r.estado as EstadoRecital]}
            </span>
            {r.propuestas > 0 && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                {r.propuestas} por confirmar
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-vs-tinta-2">
            {r.fecha} a las {r.hora} · {r.sede}
          </p>
          <p className="mt-0.5 text-xs text-vs-tinta-3">
            {r.confirmadas} en el programa
            {r.precioBoletoCentavos > 0 && ` · boleto ${pesos(r.precioBoletoCentavos)}`}
            {` · ${r.vendidos} boleto(s) vendidos`}
            {libres !== null && ` · quedan ${libres} lugar(es)`}
          </p>
        </Link>
      </li>
    );
  };

  return (
    <>
      <Encabezado sesion={sesion} activo="recitales" />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Recitales</h1>
            <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
              El maestro propone a quien tiene una pieza lista; la dirección confirma y arma el
              programa. Nadie entra al programa debiendo mensualidades vencidas.
            </p>
          </div>
          {puedeCrear && (
            <Link href="/recitales/nuevo"
                  className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                             no-underline transition hover:bg-vs-naranja-claro">
              Nuevo recital
            </Link>
          )}
        </div>

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">Próximos</h2>
          {proximos.length === 0 ? (
            <p id="sin-proximos"
               className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              No hay recitales programados.
            </p>
          ) : (
            <ul id="lista-proximos" className="mt-3 flex flex-col gap-2">
              {proximos.map((r) => <Tarjeta key={r.id} r={r} />)}
            </ul>
          )}
        </section>

        {pasados.length > 0 && (
          <section className="mt-9">
            <h2 className="font-display text-xl font-semibold">Anteriores</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {pasados.map((r) => <Tarjeta key={r.id} r={r} />)}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
