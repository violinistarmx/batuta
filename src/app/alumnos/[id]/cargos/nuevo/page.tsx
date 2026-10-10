import { notFound } from "next/navigation";
import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, alcanceDe } from "@/lib/auth/permisos";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { hoyEnMexico } from "@/lib/zona";
import { crearCargoAccion } from "../acciones";
import { FormularioCargoNuevo } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoCargo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await exigirPermiso("pagos.registrar");
  const { id } = await params;
  const alumno = alumnoPorId(Number(id), alcanceDe(sesion));
  if (!alumno) notFound();

  const hoy = hoyEnMexico();

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/alumnos" className="no-underline hover:underline">Alumnos</Link>
          {" "}›{" "}
          <Link href={`/alumnos/${alumno.id}`} className="no-underline hover:underline">
            {alumno.nombre}
          </Link>
          {" "}›{" "}Nuevo cargo
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Nuevo cargo</h1>
        <p className="mt-1 text-sm text-vs-tinta-3">
          Para <strong>{alumno.nombre}</strong>. La mensualidad se genera automáticamente al renovar;
          usa este formulario para inscripción, material, clase suelta u otros conceptos.
        </p>

        <FormularioCargoNuevo
          accion={crearCargoAccion}
          alumnoId={alumno.id}
          hoy={hoy}
        />
      </main>
    </>
  );
}
