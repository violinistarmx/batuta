import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { hoyEnMexico } from "@/lib/zona";
import { FormularioRecital } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoRecital() {
  const sesion = await exigirPermiso("recitales.gestionar");

  return (
    <>
      <Encabezado sesion={sesion} activo="recitales" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/recitales" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Recitales
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Nuevo recital</h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          El precio del boleto se fija aquí, no en la configuración: cada evento pone el suyo.
        </p>
        <div className="mt-7"><FormularioRecital hoy={hoyEnMexico()} /></div>
      </main>
    </>
  );
}
