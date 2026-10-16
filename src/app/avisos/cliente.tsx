"use client";

import { useActionState, useEffect, useState } from "react";

import { enviarAvisoAccion, marcarAvisosLeidosAccion, type EstadoAviso } from "./acciones";

const campo =
  "mt-1 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm text-vs-tinta " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

const MAXIMO_ARCHIVOS = 3;
const MAXIMO_MB = 10;

/** Redacción de un aviso, con adjuntos. Solo lo ve quien tiene el permiso `avisos.enviar`. */
export function FormularioAviso({
  maestros,
}: {
  maestros: { id: number; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAviso, FormData>(enviarAvisoAccion, {});
  const [archivos, setArchivos] = useState<File[]>([]);

  return (
    <form action={accion} className="mt-4 flex flex-col gap-4">
      {estado.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {estado.ok}
        </p>
      )}

      <label className="text-xs font-medium text-vs-tinta-2">
        Para
        <select name="destino" required defaultValue="" className={campo}>
          <option value="" disabled>Elige…</option>
          <option value="todos">Todos los maestros</option>
          {maestros.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium text-vs-tinta-2">
        Asunto
        <input name="asunto" required maxLength={120} className={campo} />
      </label>

      <label className="text-xs font-medium text-vs-tinta-2">
        Mensaje
        <textarea name="cuerpo" required rows={5} maxLength={2000} className={campo} />
      </label>

      <div className="text-xs font-medium text-vs-tinta-2">
        <span>Adjuntos</span>
        <input
          name="archivos"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => setArchivos(Array.from(e.target.files ?? []).slice(0, MAXIMO_ARCHIVOS))}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-vs-linea
                     file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-vs-tinta-2"
        />
        <p className="mt-1 text-[11px] font-normal text-vs-tinta-3">
          PDF, JPG o PNG. Hasta {MAXIMO_ARCHIVOS} archivos de {MAXIMO_MB} MB cada uno.
        </p>
        {archivos.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-[12px] font-normal text-vs-tinta-2">
            {archivos.map((f) => (
              <li key={f.name + f.size} className="truncate">
                {f.name} <span className="text-vs-tinta-3">· {(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta transition
                     hover:bg-vs-naranja-claro disabled:opacity-60"
        >
          {pendiente ? "Enviando…" : "Enviar aviso"}
        </button>
      </div>
    </form>
  );
}

/**
 * Se monta en la bandeja y marca como leído lo que ya se mostró. El resaltado
 * de «nuevo» sale de los datos del servidor, así que el maestro lo ve antes de
 * que esto corra.
 */
export function MarcarLeidos() {
  useEffect(() => {
    void marcarAvisosLeidosAccion();
  }, []);
  return null;
}
