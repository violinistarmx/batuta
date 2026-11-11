import { cookies } from "next/headers";

import { exigirSesionUsable } from "@/lib/auth/permisos";
import { COOKIE_TEMA, TEMAS, temaValido } from "@/lib/tema";
import { SelectorTema } from "./cliente";

export const dynamic = "force-dynamic";

/** Apariencia: el tema de esta persona en este navegador. Cualquier cuenta puede cambiar el suyo. */
export default async function Apariencia() {
  await exigirSesionUsable();
  const actual = temaValido((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">Ajustes</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Apariencia</h1>
      <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
        Elige cómo ves Batuta. Se guarda en este navegador y solo cambia tu vista: los demás siguen con el suyo.
      </p>
      <SelectorTema actual={actual} temas={TEMAS} />
      <p className="mt-6 text-xs text-vs-tinta-3">
        En el celular, con «reducir movimiento» o en ahorro de datos, el fondo es una imagen fija en lugar de video.
        Los recibos y comprobantes siempre se imprimen en blanco.
      </p>
    </main>
  );
}
