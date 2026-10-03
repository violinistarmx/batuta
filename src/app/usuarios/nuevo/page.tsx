import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { docentesSinCuenta } from "@/lib/datos/usuarios";
import { FormularioCuenta } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevaCuenta() {
  const sesion = await exigirPermiso("usuarios.gestionar");

  return (
    <>
      <Encabezado sesion={sesion} activo="usuarios" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/usuarios" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Cuentas
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Nueva cuenta
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          La contraseña la genera Batuta y se muestra una sola vez, en esta pantalla.
          No se pide por formulario a propósito: si la escribiera quien da de alta,
          la conocerían dos personas desde el primer minuto y la bitácora dejaría de
          poder distinguir quién hizo qué.
        </p>

        <div className="mt-7">
          <FormularioCuenta docentes={docentesSinCuenta()} />
        </div>
      </main>
    </>
  );
}
