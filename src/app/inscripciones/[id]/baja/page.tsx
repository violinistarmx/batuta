import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { valorEntero } from "@/lib/datos/ajustes";
import { planParaBaja } from "@/lib/datos/bajas";
import { inscripcionPorId } from "@/lib/datos/inscripciones";
import { hoyEnMexico } from "@/lib/zona";
import { FormularioBaja } from "./cliente";

export const dynamic = "force-dynamic";

export default async function Baja({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("inscripciones.baja");
  const { id } = await params;

  const inscripcionId = Number(id);
  if (!Number.isInteger(inscripcionId)) notFound();

  const insc = inscripcionPorId(inscripcionId, alcanceDe(sesion));
  if (!insc) notFound();

  const hoy = hoyEnMexico();
  const horasAviso = valorEntero("horas_aviso_baja", 72);
  const datos = planParaBaja(inscripcionId, hoy, horasAviso);
  if (!datos) notFound();

  const { situacion, impedimento } = datos;
  const { fechaAviso: _, ...sinFecha } = situacion;

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href={`/inscripciones/${inscripcionId}`}
              className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← {insc.alumno}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Dar de baja
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          {insc.alumno} · {insc.programa} de {insc.instrumento} con {insc.docente}.
          Terminar el contrato es lo que dice la cláusula 12ª, y por eso pide aviso y
          deja constancia de cuándo se dio.
        </p>

        {impedimento ? (
          <div id="no-se-puede-dar-de-baja"
               className="mt-7 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-lg font-semibold text-amber-900">
              Todavía no se puede
            </h2>
            <p className="mt-1 text-sm text-amber-900">{impedimento}</p>
            <Link href={`/inscripciones/${inscripcionId}`}
                  className="mt-4 inline-block rounded-lg border border-amber-300 bg-white px-4 py-2
                             text-sm font-medium no-underline transition hover:border-vs-naranja-700">
              Volver a la inscripción
            </Link>
          </div>
        ) : (
          <div className="mt-7">
            <FormularioBaja inscripcionId={inscripcionId} situacion={sinFecha} hoy={hoy} />
          </div>
        )}
      </main>
    </>
  );
}
