import { notFound } from "next/navigation";
import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso, alcanceDe } from "@/lib/auth/permisos";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { hoyEnMexico } from "@/lib/zona";
import { productosParaVenta } from "@/lib/datos/productos";
import { sedesActivas } from "@/lib/datos/vales";
import { crearCargoAccion, crearCargoProductoAccion } from "../acciones";
import { FormularioCargoNuevo } from "./formulario";
import { FormularioCargoProducto } from "./formulario-producto";

export const dynamic = "force-dynamic";

export default async function NuevoCargo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const sesion = await exigirPermiso("pagos.registrar");
  const { id } = await params;
  const esProducto = (await searchParams).tipo === "producto";
  const alumno = alumnoPorId(Number(id), alcanceDe(sesion));
  if (!alumno) notFound();

  const hoy = hoyEnMexico();

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          <Link href="/alumnos" className="no-underline hover:underline">Alumnos</Link>
          {" "}›{" "}
          <Link href={`/alumnos/${alumno.id}`} className="no-underline hover:underline">
            {alumno.nombre}
          </Link>
          {" "}›{" "}Nuevo cargo
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Nuevo cargo</h1>

        <nav aria-label="Tipo de cargo" className="mt-4 inline-flex rounded-lg border border-vs-linea bg-white p-0.5 text-sm">
          {[
            [false, `/alumnos/${alumno.id}/cargos/nuevo`, "Cargo"],
            [true, `/alumnos/${alumno.id}/cargos/nuevo?tipo=producto`, "Producto"],
          ].map(([activo, href, texto]) => (
            <Link key={String(href)} href={String(href)} aria-current={esProducto === activo ? "page" : undefined}
                  className={`rounded-md px-4 py-1.5 no-underline ${esProducto === activo ? "bg-vs-naranja font-semibold text-vs-tinta" : "text-vs-tinta-2 hover:text-vs-tinta"}`}>
              {texto}
            </Link>
          ))}
        </nav>

        {esProducto ? (
          <>
            <p className="mt-3 text-sm text-vs-tinta-3">
              Venta de un producto a <strong>{alumno.nombre}</strong>. Genera un cargo y su vale de entrega.
            </p>
            <FormularioCargoProducto
              accion={crearCargoProductoAccion}
              alumnoId={alumno.id}
              hoy={hoy}
              productos={productosParaVenta()}
              sedes={sedesActivas()}
            />
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-vs-tinta-3">
              Para <strong>{alumno.nombre}</strong>. La mensualidad se genera automáticamente al renovar;
              usa este formulario para inscripción, material, clase suelta u otros conceptos.
            </p>
            <FormularioCargoNuevo
              accion={crearCargoAccion}
              alumnoId={alumno.id}
              hoy={hoy}
            />
          </>
        )}
      </main>
    </>
  );
}
