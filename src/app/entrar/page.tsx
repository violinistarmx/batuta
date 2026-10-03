import { redirect } from "next/navigation";

import { sesionActual } from "@/lib/auth/sesion";
import { FormularioAcceso } from "./formulario";

export const dynamic = "force-dynamic";

export default async function Entrar() {
  if (await sesionActual()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-vs-tinta-3">
            Academia de Música VioliniStar
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Batuta</h1>
          <p className="mt-2 text-sm text-vs-tinta-3">Acceso al sistema de gestión</p>
        </div>

        <div className="mt-8 rounded-xl border border-vs-linea bg-white p-6 shadow-sm">
          <FormularioAcceso />
        </div>

        <p className="mt-6 text-center text-xs text-vs-tinta-3">
          Si olvidaste tu contraseña, pídele al director que la restablezca.
        </p>
      </div>
    </main>
  );
}
