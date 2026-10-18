import Link from "next/link";
import { notFound } from "next/navigation";

import { exigirPermiso } from "@/lib/auth/permisos";
import { listarParametros } from "@/lib/datos/ajustes";
import {
  CANDADOS, EXPLICACION_GRUPO, NOMBRE_GRUPO, OPCIONES, esDinero, esEditable, grupoDe,
  type Grupo,
} from "@/lib/dominio/ajustes";
import { pesos } from "@/lib/formato";
import { fechaCivil, horaCivil } from "@/lib/zona";
import { Ajuste } from "../cliente";

export const dynamic = "force-dynamic";

const GRUPOS: Grupo[] = ["contrato", "direccion", "finanzas", "institucional"];
const esGrupo = (g: string): g is Grupo => (GRUPOS as string[]).includes(g);

/** Cómo se lee un valor bajo candado, que se muestra pero no se edita. */
function mostrar(clave: string, valor: string, tipo: string): string {
  if (esDinero(clave)) return pesos(Number(valor));
  if (tipo === "booleano") return valor === "true" ? "Sí" : "No";
  const o = OPCIONES[clave]?.find((x) => x.valor === valor);
  return o ? o.texto : valor;
}

/** Una sección de Ajustes: un grupo de reglas, el que se eligió en la barra lateral. */
export default async function Ajustes({ params }: { params: Promise<{ grupo: string }> }) {
  await exigirPermiso("configuracion.gestionar");
  const { grupo } = await params;
  if (!esGrupo(grupo)) notFound();

  const del = listarParametros().filter((p) => grupoDe(p) === grupo);
  const editables = del.filter((p) => esEditable(p.clave));
  const bajoCandado = del.filter((p) => !esEditable(p.clave));

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">Ajustes</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{NOMBRE_GRUPO[grupo]}</h1>
      <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">{EXPLICACION_GRUPO[grupo]}</p>
      <p className="mt-2 max-w-2xl text-xs text-vs-tinta-3">
        Ninguna regla está escrita dentro del programa: viven aquí, con la cláusula de la que salieron.
        Cada cambio queda en la{" "}
        <Link href="/bitacora" className="no-underline hover:underline">bitácora</Link>{" "}
        con quién lo hizo y cuándo.
      </p>

      {del.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-vs-linea bg-white px-4 py-8 text-center text-sm text-vs-tinta-3">
          No hay ajustes en esta sección.
        </p>
      )}

      {editables.length > 0 && (
        <div className="mt-5 rounded-xl border border-vs-linea bg-white">
          {editables.map((p) => (
            <Ajuste
              key={p.clave}
              p={p}
              actualizado={`${fechaCivil(p.actualizadoEn)} a las ${horaCivil(p.actualizadoEn)}`}
            />
          ))}
        </div>
      )}

      {bajoCandado.map((p) => (
        <div key={p.clave} data-candado={p.clave}
             className="mt-3 rounded-xl border border-vs-linea bg-vs-crema px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-medium">{p.descripcion}</span>
            <span className="font-mono text-sm">{mostrar(p.clave, p.valor, p.tipo)}</span>
          </div>
          <p className="mt-1 text-xs text-vs-tinta-2">
            <strong>No se edita desde aquí.</strong> {CANDADOS[p.clave]}
          </p>
        </div>
      ))}

      <p className="mt-8 text-xs text-vs-tinta-3">
        Cambiar un ajuste no recalcula lo que ya ocurrió. Los cortes de nómina, los cargos y los
        recibos ya emitidos conservan las reglas que estaban vigentes cuando se hicieron, que es lo
        que permite defenderlos meses después.
      </p>
    </main>
  );
}
