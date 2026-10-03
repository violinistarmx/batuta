import Link from "next/link";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { instrumentos } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { hoyEnMexico } from "@/lib/zona";
import { FormularioEjemplar } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoEjemplar() {
  const sesion = await exigirPermiso("inventario.gestionar");

  return (
    <>
      <Encabezado sesion={sesion} activo="inventario" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/inventario" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Inventario
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Nuevo ejemplar
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          Un ejemplar es un instrumento físico concreto, no un tipo: cuatro violines son
          cuatro ejemplares, cada uno con su folio y su historia.
        </p>

        <div className="mt-7">
          <FormularioEjemplar
            instrumentos={db.select({
              id: instrumentos.id, nombre: instrumentos.nombre,
              granFormato: instrumentos.granFormato,
            }).from(instrumentos).where(eq(instrumentos.activo, true))
              .orderBy(asc(instrumentos.orden)).all()}
            hoy={hoyEnMexico()}
          />
        </div>
      </main>
    </>
  );
}
