import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import {
  candidatasParaPrestamo, ejemplarPorId, historialDeEjemplar,
} from "@/lib/datos/inventario";
import {
  NOMBRE_CONDICION, NOMBRE_ESTADO, estadoDeDevolucion,
  type Condicion, type EstadoEjemplar,
} from "@/lib/dominio/inventario";
import { pesos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";
import { Devolver, Prestar } from "./cliente";

export const dynamic = "force-dynamic";

const INCIDENCIA: Record<string, string> = {
  ninguna: "Sin incidencia", dano: "Regresó dañado", perdida: "No lo devolvió",
};

export default async function Ejemplar({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("inventario.gestionar");
  const { id } = await params;

  const ejemplarId = Number(id);
  if (!Number.isInteger(ejemplarId)) notFound();

  const e = ejemplarPorId(ejemplarId);
  if (!e) notFound();

  const hoy = hoyEnMexico();
  const historial = historialDeEjemplar(ejemplarId);
  const abierto = historial.find((p) => p.devueltoEl === null) ?? null;
  // La última devolución con incidencia se muestra de forma permanente, no como
  // aviso pasajero: al cerrarse el préstamo la pantalla se recarga y el mensaje
  // se iba justo después de reportar un instrumento roto, que es cuando hace
  // falta recordar que nadie va a cobrar nada solo.
  const ultima = historial[0];
  const incidente = ultima && ultima.devueltoEl && ultima.incidencia && ultima.incidencia !== "ninguna"
    ? ultima : null;
  const candidatas = e.estado === "disponible" ? candidatasParaPrestamo(ejemplarId) : [];

  return (
    <>
      <Encabezado sesion={sesion} activo="inventario" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/inventario" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Inventario
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{e.instrumento}</h1>
          <span id="ejemplar-codigo" className="font-mono text-sm text-vs-tinta-3">{e.codigo}</span>
          <span id="ejemplar-estado"
                className="rounded bg-vs-crema px-2 py-1 text-[11px] uppercase tracking-wider text-vs-tinta-2">
            {NOMBRE_ESTADO[e.estado as EstadoEjemplar]}
          </span>
        </div>

        <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Marca y modelo</dt>
              <dd>{[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Medida</dt>
              <dd>{e.medida ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Número de serie</dt>
              <dd className="font-mono text-xs">{e.numeroSerie ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Condición</dt>
              <dd id="ejemplar-condicion">{NOMBRE_CONDICION[e.condicion as Condicion]}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Ubicación</dt>
              <dd>{e.ubicacion ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-vs-tinta-3">Valor de reposición</dt>
              <dd className="tabular-nums">
                {e.valorCentavos !== null ? pesos(e.valorCentavos) : "—"}
              </dd>
            </div>
          </dl>
          {e.notas && (
            <p className="mt-3 border-t border-vs-linea pt-3 text-sm text-vs-tinta-2">{e.notas}</p>
          )}
          <p className="mt-3 text-xs text-vs-tinta-3">
            El valor es informativo: sirve para el seguro y para saber cuánto se arriesga al
            prestar. No genera cargos.
          </p>
        </section>

        {incidente && (
          <section id="incidencia-abierta"
                   className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-lg font-semibold">
              {incidente.incidencia === "perdida" ? "No lo devolvieron" : "Regresó dañado"}
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              {incidente.incidenciaNota}
            </p>
            <p className="mt-2 text-sm text-vs-tinta-2">
              Lo reportó quien lo recibió el {incidente.devueltoEl}. <strong>No se generó ningún
              cargo</strong>: si hay que cobrar la reparación o la reposición, decídelo tú y
              regístralo como cargo en el expediente.
            </p>
            <Link href={`/alumnos/${incidente.alumnoId}`}
                  className="mt-2 inline-block text-sm font-medium no-underline hover:underline">
              Abrir el expediente de {incidente.alumno} →
            </Link>
          </section>
        )}

        {e.granFormato && (
          <p id="aviso-gran-formato"
             className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Gran formato.</strong> No sale de las instalaciones (cláusula 9ª). Este
            ejemplar se registra para el inventario, pero no se presta.
          </p>
        )}

        {/* ------------------------------------------------ préstamo abierto */}
        {abierto && (
          <section className="mt-5 rounded-xl border border-vs-naranja bg-vs-crema p-5">
            <h2 className="font-display text-lg font-semibold">Prestado</h2>
            <p className="mt-1 text-sm text-vs-tinta-2">
              A{" "}
              <Link href={`/alumnos/${abierto.alumnoId}`} className="font-medium no-underline hover:underline">
                {abierto.alumno}
              </Link>
              {" "}desde el {abierto.entregadoEl}, en condición{" "}
              {NOMBRE_CONDICION[abierto.condicionSalida].toLowerCase()}. El período termina el{" "}
              <strong>{abierto.terminaEl}</strong>
              {estadoDeDevolucion(abierto.terminaEl, hoy) === "vencido" && " — ya venció"}.
            </p>
            <Link href={`/prestamos/${abierto.id}/responsiva`}
                  className="mt-2 inline-block text-sm no-underline hover:underline">
              Ver la responsiva →
            </Link>

            <div className="mt-4 border-t border-vs-linea pt-4">
              <h3 className="font-display text-base font-semibold">Recibirlo de vuelta</h3>
              <div className="mt-3"><Devolver prestamoId={abierto.id} hoy={hoy} /></div>
            </div>
          </section>
        )}

        {/* --------------------------------------------------- prestar ahora */}
        {!abierto && e.estado === "disponible" && !e.granFormato && (
          <section className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Prestar</h2>
            {candidatas.length === 0 ? (
              <p id="sin-candidatas" className="mt-1 text-sm text-vs-tinta-2">
                Ningún alumno puede recibirlo hoy. Hace falta estar en Allegro Virtuoso, estudiar
                este instrumento, tener período abierto y no tener ya uno prestado.
              </p>
            ) : (
              <div className="mt-3">
                <Prestar ejemplarId={e.id} candidatas={candidatas}
                         condicion={e.condicion} hoy={hoy} />
              </div>
            )}
          </section>
        )}

        {!abierto && (e.estado === "en_reparacion" || e.estado === "baja") && (
          <p id="no-prestable"
             className="mt-5 rounded-lg border border-vs-linea bg-vs-crema px-4 py-3 text-sm text-vs-tinta-2">
            {e.estado === "en_reparacion"
              ? "En reparación: no se puede prestar hasta que vuelva a estar en buen estado."
              : "Dado de baja: ya no forma parte del inventario prestable."}
          </p>
        )}

        {/* ------------------------------------------------------ historial */}
        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">
            Historial <span className="text-vs-tinta-3">({historial.length})</span>
          </h2>
          {historial.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-vs-linea bg-white p-6 text-center text-sm text-vs-tinta-3">
              Nunca se ha prestado.
            </p>
          ) : (
            <ol id="historial-prestamos" className="mt-3 flex flex-col gap-2">
              {historial.map((p) => (
                <li key={p.id} data-prestamo={p.id}
                    className="rounded-lg border border-vs-linea bg-white px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <Link href={`/alumnos/${p.alumnoId}`} className="font-medium no-underline hover:underline">
                      {p.alumno}
                    </Link>
                    <span className="tabular-nums text-vs-tinta-2">
                      {p.entregadoEl} → {p.devueltoEl ?? "sin devolver"}
                    </span>
                    {p.incidencia && p.incidencia !== "ninguna" && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        {INCIDENCIA[p.incidencia]}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-vs-tinta-3">
                    Salió {NOMBRE_CONDICION[p.condicionSalida].toLowerCase()}
                    {p.condicionRegreso && `, regresó ${NOMBRE_CONDICION[p.condicionRegreso].toLowerCase()}`}
                    {p.entregadoPor && ` · entregó ${p.entregadoPor}`}
                  </p>
                  {p.incidenciaNota && (
                    <p className="mt-1 text-sm text-vs-tinta-2">{p.incidenciaNota}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
