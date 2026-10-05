import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { alumnoPorId, situacionDescarte } from "@/lib/datos/alumnos";
import { motivoParaNoDescartar } from "@/lib/dominio/descarte";
import { FormularioDescarte } from "./cliente";

export const dynamic = "force-dynamic";

export default async function Descartar({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("alumnos.descartar");
  const { id } = await params;

  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) notFound();

  // Solo el director llega aquí, así que el alcance siempre es "todo".
  const alumno = alumnoPorId(alumnoId, { tipo: "todo" });
  if (!alumno) notFound();

  const situacion = situacionDescarte(alumnoId);
  const impedimento = motivoParaNoDescartar(situacion);

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link href={`/alumnos/${alumnoId}`}
              className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← {alumno.nombre}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Descartar alumno
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          Esto es para el error de captura —un alumno de prueba, duplicado o con datos
          equivocados— que nunca debió existir. Borra por completo el expediente de{" "}
          <strong>{alumno.nombre}</strong> ({alumno.codigo}): no es lo mismo que dar de baja, y
          no se puede deshacer.
        </p>

        {impedimento ? (
          <div id="no-se-puede-descartar"
               className="mt-7 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-lg font-semibold text-amber-900">
              Este alumno ya no se puede descartar
            </h2>
            <p className="mt-1 text-sm text-amber-900">{impedimento}</p>
            <Link href={`/alumnos/${alumnoId}`}
                  className="mt-4 inline-block rounded-lg border border-amber-300 bg-white px-4 py-2
                             text-sm font-medium no-underline transition hover:border-vs-naranja-700">
              Volver al expediente
            </Link>
          </div>
        ) : (
          <div className="mt-7 rounded-xl border-2 border-red-300 bg-red-50 p-5">
            <h2 className="font-display text-lg font-semibold text-red-900">
              Esto no se puede deshacer
            </h2>
            <p className="mt-1 text-sm text-red-900">
              Se borran el expediente, las inscripciones, la agenda y cualquier cargo sin pagar.
              No hay pagos, asistencias, préstamos ni recitales de por medio — por eso el sistema
              permite borrarlo en vez de pedir que se dé de baja.
            </p>
            <div className="mt-5">
              <FormularioDescarte alumnoId={alumnoId} nombre={alumno.nombre} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
