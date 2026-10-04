"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  borrarFotoAlumno, borrarFotoDocente, subirFotoAlumno, subirFotoDocente,
  type EstadoFoto,
} from "@/app/acciones-fotos";

/**
 * Fotografía de perfil de un alumno o un maestro.
 *
 * La imagen no se sirve como archivo estático: `/api/fotos/...` verifica sesión y
 * alcance en cada petición. Si quien mira no alcanza a esa persona, la etiqueta
 * `img` recibe un 404 y no se pinta nada.
 */

type Props = {
  tipo: "alumno" | "docente";
  id: number;
  nombre: string;
  tieneFoto: boolean;
  puedeEditar: boolean;
  /** Marca de tiempo para que el navegador no reutilice la imagen anterior. */
  version?: number | null;
};

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Boton({ texto, pendiente }: { texto: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-xs font-medium
                 transition hover:bg-vs-crema focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700
                 disabled:opacity-60"
    >
      {pending ? pendiente : texto}
    </button>
  );
}

export function FotoPerfil({ tipo, id, nombre, tieneFoto, puedeEditar, version }: Props) {
  const subir = tipo === "alumno" ? subirFotoAlumno : subirFotoDocente;
  const borrar = tipo === "alumno" ? borrarFotoAlumno : borrarFotoDocente;
  const campoId = tipo === "alumno" ? "alumnoId" : "docenteId";

  const [estado, accionSubir] = useActionState<EstadoFoto, FormData>(subir, {});
  const [estadoBorrar, accionBorrar] = useActionState<EstadoFoto, FormData>(borrar, {});

  const aviso = estado.error ?? estadoBorrar.error ?? estado.ok ?? estadoBorrar.ok;
  const esError = Boolean(estado.error ?? estadoBorrar.error);

  const fuente = `/api/fotos/${tipo}/${id}${version ? `?v=${version}` : ""}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-full
                   border border-vs-linea bg-vs-crema"
      >
        {tieneFoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- la ruta exige
          // sesión y devuelve 404 fuera de alcance; el optimizador de Next no
          // puede leerla.
          <img src={fuente} alt={`Fotografía de ${nombre}`}
               className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl font-semibold text-vs-tinta-3">
            {iniciales(nombre)}
          </span>
        )}
      </div>

      {puedeEditar && (
        <div className="flex flex-col items-center gap-2">
          <form action={accionSubir} className="flex flex-col items-center gap-2">
            <input type="hidden" name={campoId} value={id} />
            <label htmlFor={`foto-${tipo}-${id}`} className="sr-only">
              Fotografía de {nombre}
            </label>
            <input
              id={`foto-${tipo}-${id}`} name="foto" type="file" accept="image/jpeg,image/png"
              className="w-48 text-xs file:mr-2 file:rounded-lg file:border file:border-vs-linea
                         file:bg-white file:px-2.5 file:py-1 file:text-xs"
            />
            <Boton texto={tieneFoto ? "Reemplazar" : "Subir fotografía"} pendiente="Guardando…" />
          </form>

          {tieneFoto && (
            <form action={accionBorrar}>
              <input type="hidden" name={campoId} value={id} />
              <Boton texto="Quitar" pendiente="Quitando…" />
            </form>
          )}

          <p className="max-w-48 text-center text-[11px] leading-snug text-vs-tinta-3">
            JPG o PNG, hasta 10 MB. Solo se ve dentro del sistema.
          </p>
        </div>
      )}

      {aviso && (
        <p role={esError ? "alert" : "status"}
           className={`max-w-48 rounded-lg px-2.5 py-1.5 text-center text-xs ${
             esError
               ? "border border-red-200 bg-red-50 text-red-800"
               : "border border-vs-linea bg-vs-crema text-vs-tinta-2"
           }`}>
          {aviso}
        </p>
      )}
    </div>
  );
}
