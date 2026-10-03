import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { EstatusAlumno } from "@/components/estatus-alumno";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { estatusDeAlumno } from "@/lib/datos/estatus";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

/** La misma vista que da el QR, alcanzable sin escanear nada. */
export default async function Estatus({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("alumnos.leer");
  const { id } = await params;

  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) notFound();

  const hoy = hoyEnMexico();
  const verFinanzas = tienePermiso(sesion, "finanzas.leer") || tienePermiso(sesion, "pagos.registrar");
  const e = estatusDeAlumno(alumnoId, alcanceDe(sesion), verFinanzas, hoy);
  if (!e) notFound();

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link href={`/alumnos/${alumnoId}`}
              className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Expediente
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Estatus</h1>
        <p className="mt-1 text-sm text-vs-tinta-3">
          {hoy} · Es lo que aparece al escanear su credencial.
        </p>

        <div className="mt-6">
          <EstatusAlumno e={e} hoy={hoy} verFinanzas={verFinanzas} compacto />
        </div>
      </main>
    </>
  );
}
