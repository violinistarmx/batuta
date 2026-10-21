import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { renovacionesPendientes } from "@/lib/datos/tablero";
import { valorEntero } from "@/lib/datos/ajustes";

export const dynamic = "force-dynamic";

/**
 * Alumnos por renovar: los que ya no tienen clases del período y los que están por agotarlo.
 * Ordenados para trabajar de arriba hacia abajo: primero quien ya no tiene clases.
 */
export default async function Renovaciones() {
  const sesion = await exigirPermiso("renovaciones.leer");
  const umbral = valorEntero("renovacion_aviso_clases", 4);
  const filas = renovacionesPendientes(umbral);

  return (
    <>
      <Encabezado sesion={sesion} activo="renovaciones" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Por renovar</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Alumnos cuyo período está por agotarse. Cuando quedan {umbral} clases o menos, toca avisar a la
          familia; cuando ya no quedan, hay que renovar.
        </p>

        {filas.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-vs-linea bg-white px-4 py-8 text-center text-sm text-vs-tinta-3">
            Nadie por renovar por ahora.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-vs-linea bg-white">
            <table className="w-full text-sm">
              <thead className="bg-vs-crema text-left text-[11px] uppercase tracking-wider text-vs-tinta-3">
                <tr>
                  <th className="px-3 py-2 font-semibold">Alumno</th>
                  <th className="px-3 py-2 font-semibold">Programa</th>
                  <th className="px-3 py-2 font-semibold">Período termina</th>
                  <th className="px-3 py-2 text-right font-semibold">Clases restantes</th>
                  <th className="px-3 py-2 font-semibold">Qué hacer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vs-linea">
                {filas.map((f) => (
                  <tr key={f.inscripcionId}>
                    <td className="px-3 py-2">
                      <Link href={`/alumnos/${f.alumnoId}`} className="font-medium no-underline hover:underline">{f.alumno}</Link>
                    </td>
                    <td className="px-3 py-2">{f.programa}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{f.terminaEl}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.restantes}</td>
                    <td className="px-3 py-2">
                      <span className={f.nivel === "ahora" ? "font-semibold text-red-800" : "text-vs-tinta-2"}>
                        {f.nivel === "ahora" ? "Renovar ya" : "Avisar a la familia"}
                      </span>
                      {" · "}
                      <Link href={`/inscripciones/${f.inscripcionId}`} className="text-xs text-vs-naranja-700 hover:underline">
                        Ver inscripción
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
