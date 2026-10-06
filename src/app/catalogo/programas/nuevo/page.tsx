import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { hoyEnMexico } from "@/lib/zona";
import { FormularioNuevoPrograma } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoPrograma() {
  const sesion = await exigirPermiso("configuracion.gestionar");
  const hoy = hoyEnMexico();

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
          Nuevo programa
        </h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          Define la estructura del programa y su precio inicial. El nombre y el precio
          se pueden ajustar después; la estructura (clases, duración, alumnos) solo
          desde la base de datos.
        </p>

        <div className="mt-7 rounded-xl border border-vs-linea bg-white p-6">
          <FormularioNuevoPrograma hoy={hoy} />
        </div>
      </main>
    </>
  );
}
