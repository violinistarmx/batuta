import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { listarParametros } from "@/lib/datos/ajustes";
import {
  CANDADOS, EXPLICACION_GRUPO, NOMBRE_GRUPO, OPCIONES, esDinero, esEditable, grupoDe,
  type Grupo,
} from "@/lib/dominio/ajustes";
import { pesos } from "@/lib/formato";
import { fechaCivil, horaCivil } from "@/lib/zona";
import { Ajuste } from "./cliente";

export const dynamic = "force-dynamic";

const ORDEN: Grupo[] = ["contrato", "direccion", "institucional"];

/** Cómo se lee un valor bajo candado, que se muestra pero no se edita. */
function mostrar(clave: string, valor: string, tipo: string): string {
  if (esDinero(clave)) return pesos(Number(valor));
  if (tipo === "booleano") return valor === "true" ? "Sí" : "No";
  const o = OPCIONES[clave]?.find((x) => x.valor === valor);
  return o ? o.texto : valor;
}

export default async function Ajustes() {
  const sesion = await exigirPermiso("configuracion.gestionar");
  const todos = listarParametros();

  return (
    <>
      <Encabezado sesion={sesion} activo="ajustes" />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Ajustes</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Las reglas con las que opera la academia. Ninguna está escrita dentro del
          programa: viven aquí, con la cláusula de la que salieron, y por eso se pueden
          cambiar sin que nadie toque el código. Cada cambio queda en la{" "}
          <Link href="/bitacora" className="no-underline hover:underline">bitácora</Link>{" "}
          con quién lo hizo y cuándo.
        </p>

        {ORDEN.map((grupo) => {
          const del = todos.filter((p) => grupoDe(p) === grupo);
          if (del.length === 0) return null;

          const editables = del.filter((p) => esEditable(p.clave));
          const bajoCandado = del.filter((p) => !esEditable(p.clave));

          return (
            <section key={grupo} id={`grupo-${grupo}`} className="mt-8">
              <h2 className="font-display text-xl font-semibold">{NOMBRE_GRUPO[grupo]}</h2>
              <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
                {EXPLICACION_GRUPO[grupo]}
              </p>

              {editables.length > 0 && (
                <div className="mt-3 rounded-xl border border-vs-linea bg-white">
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
            </section>
          );
        })}

        <p className="mt-8 text-xs text-vs-tinta-3">
          Cambiar un ajuste no recalcula lo que ya ocurrió. Los cortes de nómina, los
          cargos y los recibos ya emitidos conservan las reglas que estaban vigentes
          cuando se hicieron, que es lo que permite defenderlos meses después.
        </p>
      </main>
    </>
  );
}
