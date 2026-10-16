import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId, saludDe, tutoresDe } from "@/lib/datos/alumnos";
import { FormularioEdicion } from "./formulario";

export const dynamic = "force-dynamic";

export default async function EditarAlumno({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("alumnos.editar");
  const { id } = await params;

  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) notFound();

  const alumno = alumnoPorId(alumnoId, alcanceDe(sesion));
  if (!alumno) notFound();

  // Editar salud exige leerla y capturarla: sin lectura, guardar la ficha en blanco
  // borraría datos que el usuario nunca vio.
  const puedeEditarSalud = tienePermiso(sesion, "salud.editar") && tienePermiso(sesion, "salud.leer");
  const salud = puedeEditarSalud ? saludDe(alumno.id) : null;
  if (salud) {
    registrar({
      usuarioId: sesion.usuarioId,
      accion: "salud.leer",
      entidad: "salud_alumno",
      entidadId: alumno.id,
    });
  }

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href={`/alumnos/${alumno.id}`} className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Expediente de {alumno.nombre}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Editar datos</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Corrige lo que haga falta o agrega un tutor extra. Los cambios se guardan al
          presionar el botón de abajo.
        </p>

        <div className="mt-7">
          <FormularioEdicion
            alumno={{
              id: alumno.id,
              nombre: alumno.nombre,
              fechaNacimiento: alumno.fechaNacimiento,
              sexo: alumno.sexo,
              telefono: alumno.telefono,
              email: alumno.email,
              direccion: alumno.direccion,
              colonia: alumno.colonia,
              objetivoMusical: alumno.objetivoMusical,
              experienciaPrevia: alumno.experienciaPrevia,
              observaciones: alumno.observaciones,
            }}
            tutores={tutoresDe(alumno.id)}
            salud={salud}
            puedeEditarSalud={puedeEditarSalud}
          />
        </div>
      </main>
    </>
  );
}
