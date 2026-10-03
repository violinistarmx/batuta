import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { tutoresParaVincular } from "@/lib/datos/alumnos";
import { FormularioAlta } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoAlumno() {
  const sesion = await exigirPermiso("alumnos.crear");
  const tutores = tutoresParaVincular();

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/alumnos" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Alumnos
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Nueva inscripción
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Solo el nombre es obligatorio para empezar. Si el alumno es menor de edad, el
          contrato exige registrar a su tutor. Cuando llega un hermano, elige al tutor que
          ya está en el padrón en vez de volver a escribirlo.
        </p>

        <div className="mt-7">
          <FormularioAlta tutores={tutores} />
        </div>
      </main>
    </>
  );
}
