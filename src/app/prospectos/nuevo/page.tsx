import Link from "next/link";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { instrumentos, programas } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { hoyEnMexico } from "@/lib/zona";
import { FormularioProspecto } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoProspecto() {
  const sesion = await exigirPermiso("prospectos.crear");
  const hoy = hoyEnMexico();

  // Siete días es el horizonte útil: más allá, la fecha se pone por poner.
  const [y = 0, m = 1, d = 1] = hoy.split("-").map(Number);
  const enSieteDias = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);

  return (
    <>
      <Encabezado sesion={sesion} activo="prospectos" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/prospectos" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Prospectos
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Nuevo prospecto
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          Solo el nombre es obligatorio. Lo demás se completa conforme avance la conversación.
        </p>

        <div className="mt-7">
          <FormularioProspecto
            programas={db.select({ id: programas.id, nombre: programas.nombre }).from(programas)
              .where(eq(programas.activo, true)).orderBy(asc(programas.orden)).all()}
            instrumentos={db.select({ id: instrumentos.id, nombre: instrumentos.nombre })
              .from(instrumentos).where(eq(instrumentos.activo, true))
              .orderBy(asc(instrumentos.orden)).all()}
            hoy={hoy}
            enSieteDias={enSieteDias}
          />
        </div>
      </main>
    </>
  );
}
