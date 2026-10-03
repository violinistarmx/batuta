import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import {
  contextoDeAlumno, contextoDeProspecto, plantillasActivas,
} from "@/lib/datos/comunicacion";
import { renderizar } from "@/lib/dominio/plantillas";
import { Redactor } from "./cliente";

export const dynamic = "force-dynamic";

export default async function Redactar({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string; prospecto?: string }>;
}) {
  const sesion = await exigirPermiso("comunicacion.redactar");
  const { alumno, prospecto } = await searchParams;

  const alumnoId = alumno && /^\d+$/.test(alumno) ? Number(alumno) : null;
  const prospectoId = prospecto && /^\d+$/.test(prospecto) ? Number(prospecto) : null;
  if (alumnoId === null && prospectoId === null) notFound();

  const ctx = alumnoId !== null ? contextoDeAlumno(alumnoId) : contextoDeProspecto(prospectoId!);
  if (!ctx) notFound();

  // Se renderizan TODAS las plantillas de una vez: así la pantalla puede avisar de
  // entrada cuáles quedarían con huecos, en vez de descubrirlo al elegirlas.
  const versiones = plantillasActivas().map((p) => {
    const r = renderizar(p.cuerpo, ctx.datos);
    return { plantillaId: p.id, nombre: p.nombre, texto: r.texto, faltantes: r.faltantes };
  });

  return (
    <>
      <Encabezado sesion={sesion} activo="comunicacion" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href={alumnoId !== null ? `/alumnos/${alumnoId}` : `/prospectos/${prospectoId}`}
          className="text-xs text-vs-tinta-3 no-underline hover:underline"
        >
          ← Volver
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Escribir a {ctx.destinatario}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-vs-tinta-2">
          Los datos del expediente ya están puestos. Revisa el texto y mándalo a aprobación.
        </p>

        <div className="mt-7">
          <Redactor
            versiones={versiones}
            alumnoId={alumnoId}
            prospectoId={prospectoId}
            destinatario={ctx.destinatario}
            telefono={ctx.telefono}
          />
        </div>
      </main>
    </>
  );
}
