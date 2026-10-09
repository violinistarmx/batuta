import Link from "next/link";
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { instrumentos } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { crearInstrumento, renombrarInstrumento, toggleInstrumento } from "./acciones";
import { FilaInstrumento, FormularioNuevoInstrumento } from "./cliente";

export const dynamic = "force-dynamic";

export default async function AdminInstrumentos() {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const lista = db
    .select()
    .from(instrumentos)
    .orderBy(asc(instrumentos.orden))
    .all();

  const activos = lista.filter((i) => i.activo);
  const inactivos = lista.filter((i) => !i.activo);

  return (
    <>
      <Encabezado sesion={sesion} activo="catalogo" />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link
          href="/catalogo"
          className="text-xs text-vs-tinta-3 no-underline hover:underline"
        >
          ← Catálogo y reglas
        </Link>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Materias e instrumentos
        </h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          Todo lo que la academia puede enseñar: instrumentos musicales, materias
          artísticas o cualquier disciplina. Se usan al registrar inscripciones.
        </p>

        {/* Lista de activos */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">
            Activos <span className="font-normal text-vs-tinta-3">({activos.length})</span>
          </h2>
          {activos.length === 0 ? (
            <p className="mt-3 text-sm text-vs-tinta-3">No hay materias activas aún.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activos.map((i) => (
                <FilaInstrumento
                  key={i.id}
                  instrumento={i}
                  accionRenombrar={renombrarInstrumento}
                  accionToggle={toggleInstrumento}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Agregar nueva */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Agregar materia o instrumento</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Por ejemplo: Iniciación musical, Dibujo, Teoría musical, Saxofón…
          </p>
          <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
            <FormularioNuevoInstrumento accion={crearInstrumento} />
          </div>
        </section>

        {/* Inactivos */}
        {inactivos.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold">
              Inactivos <span className="font-normal text-vs-tinta-3">({inactivos.length})</span>
            </h2>
            <p className="mt-1 text-sm text-vs-tinta-2">
              No aparecen en el formulario de inscripción, pero el historial los conserva.
            </p>
            <ul className="mt-3 space-y-2">
              {inactivos.map((i) => (
                <FilaInstrumento
                  key={i.id}
                  instrumento={i}
                  accionRenombrar={renombrarInstrumento}
                  accionToggle={toggleInstrumento}
                />
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-xs text-vs-tinta-3">
          Los de gran formato no salen de las instalaciones (cláusula 9ª). Desactivar una materia
          la oculta en nuevas inscripciones pero no afecta contratos existentes.
        </p>
      </main>
    </>
  );
}
