import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { catalogoParaInscribir, planesFamiliaresDisponibles } from "@/lib/datos/inscripciones";
import { ZONA } from "@/lib/formato";
import { FormularioInscripcion } from "./formulario";

export const dynamic = "force-dynamic";

export default async function Inscribir({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("inscripciones.crear");
  const { id } = await params;

  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) notFound();

  const alumno = alumnoPorId(alumnoId, alcanceDe(sesion));
  if (!alumno) notFound();

  const catalogo = catalogoParaInscribir();

  // Para cada programa familiar, los planes con lugar libre a los que este alumno
  // puede sumarse. Se resuelve aquí y no al vuelo: la pantalla no debe ofrecer un
  // plan que el servidor va a rechazar.
  const planes = Object.fromEntries(
    catalogo.programas
      .filter((p) => p.alumnosIncluidos > 1)
      .map((p) => [p.id, planesFamiliaresDisponibles(alumnoId, p.id)]),
  );
  // Fecha civil en horario de la academia, no del servidor.
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href={`/alumnos/${alumno.id}`} className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← {alumno.nombre}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Nueva inscripción
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          Un alumno puede tener varias inscripciones a la vez si son instrumentos distintos.
          Cada una lleva su propio maestro, período y saldo de clases. En los planes
          familiares cada hermano recibe sus propias clases; lo que se comparte es el precio.
        </p>

        <div className="mt-7">
          <FormularioInscripcion
            alumnoId={alumno.id}
            programas={catalogo.programas}
            instrumentos={catalogo.instrumentos}
            docentes={catalogo.docentes}
            planesFamiliares={planes}
            hoy={hoy}
          />
        </div>
      </main>
    </>
  );
}
