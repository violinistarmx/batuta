"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  alternarTarea, asignarTarea, registrarAvance, subirPlaneacion,
  type EstadoPlaneacion, type EstadoProgreso, type EstadoTarea,
} from "../acciones-academicas";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";
const etiqueta = "text-xs font-medium text-vs-tinta-2";

function Enviar({ texto, pendiente }: { texto: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                 transition hover:bg-vs-naranja-claro focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700
                 disabled:opacity-60"
    >
      {pending ? pendiente : texto}
    </button>
  );
}

function Aviso({ id, error, ok }: { id: string; error?: string; ok?: string }) {
  if (error) {
    return (
      <p id={`error-${id}`} role="alert"
         className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p id={`ok-${id}`} role="status"
         className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
        {ok}
      </p>
    );
  }
  return null;
}

export type PlaneacionActual = {
  objetivos: string | null;
  temas: string | null;
  evaluacion: string | null;
  documentoId: number | null;
  nombreArchivo: string | null;
  bytes: number | null;
} | null;

export function Planeacion({ claseId, actual }: { claseId: number; actual: PlaneacionActual }) {
  const [estado, accion] = useActionState<EstadoPlaneacion, FormData>(subirPlaneacion, {});

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="claseId" value={claseId} />
      <Aviso id="planeacion" error={estado.error} ok={estado.ok} />

      {actual?.documentoId && (
        <p className="rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-sm">
          PDF adjunto:{" "}
          <a href={`/api/documentos/${actual.documentoId}`} target="_blank" rel="noreferrer"
             className="font-medium">
            {actual.nombreArchivo}
          </a>
          <span className="ml-2 text-xs text-vs-tinta-3">
            {((actual.bytes ?? 0) / 1024).toFixed(0)} KB
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="objetivos" className={etiqueta}>Objetivos</label>
          <textarea id="objetivos" name="objetivos" rows={3} className={campo}
                    defaultValue={actual?.objetivos ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="temas" className={etiqueta}>Temas trabajados</label>
          <textarea id="temas" name="temas" rows={3} className={campo}
                    defaultValue={actual?.temas ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="evaluacion" className={etiqueta}>Evaluación</label>
          <textarea id="evaluacion" name="evaluacion" rows={3} className={campo}
                    defaultValue={actual?.evaluacion ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="archivo" className={etiqueta}>
          {actual?.documentoId ? "Reemplazar el PDF" : "Adjuntar la planeación en PDF"}
        </label>
        <input id="archivo" name="archivo" type="file" accept=".pdf,.jpg,.jpeg,.png"
               className="text-sm file:mr-3 file:rounded-lg file:border file:border-vs-linea
                          file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        <span className="text-xs text-vs-tinta-3">
          PDF, JPG o PNG, hasta 10 MB. Queda atado a este alumno, inscripción y clase, y solo
          se descarga desde el sistema.
        </span>
      </div>

      <div>
        <Enviar texto={actual ? "Actualizar planeación" : "Guardar planeación"} pendiente="Guardando…" />
      </div>
    </form>
  );
}

export type TareaFila = {
  id: number; descripcion: string; repertorio: string | null;
  fechaRevision: string | null; completadaEn: string | null;
};

export function Tareas({ claseId, tareas }: { claseId: number; tareas: TareaFila[] }) {
  const [estado, accion] = useActionState<EstadoTarea, FormData>(asignarTarea, {});
  const [, alternar] = useActionState(alternarTarea, {});

  return (
    <div className="flex flex-col gap-4">
      {tareas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tareas.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border border-vs-linea p-3">
              <form action={alternar}>
                <input type="hidden" name="tareaId" value={t.id} />
                <input type="hidden" name="claseId" value={claseId} />
                <input type="hidden" name="completada" value={t.completadaEn ? "no" : "si"} />
                <button
                  type="submit"
                  aria-label={t.completadaEn ? "Marcar como pendiente" : "Marcar como completada"}
                  className={`mt-0.5 h-4 w-4 rounded border ${
                    t.completadaEn
                      ? "border-green-700 bg-green-600 text-white"
                      : "border-vs-line-strong bg-white"
                  }`}
                >
                  {t.completadaEn ? "✓" : ""}
                </button>
              </form>
              <span className="flex-1 text-sm">
                <span className={t.completadaEn ? "text-vs-tinta-3 line-through" : ""}>
                  {t.descripcion}
                </span>
                {t.repertorio && (
                  <span className="mt-0.5 block text-xs text-vs-tinta-3">{t.repertorio}</span>
                )}
                {t.fechaRevision && (
                  <span className="mt-0.5 block text-xs text-vs-tinta-3">
                    Revisar el {t.fechaRevision}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={accion} className="flex flex-col gap-3 border-t border-vs-linea pt-4">
        <input type="hidden" name="claseId" value={claseId} />
        <Aviso id="tarea" error={estado.error} ok={estado.ok} />

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="descripcion" className={etiqueta}>Qué debe practicar</label>
            <input id="descripcion" name="descripcion" required className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repertorio" className={etiqueta}>Repertorio</label>
            <input id="repertorio" name="repertorio" className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fechaRevision" className={etiqueta}>Revisar el</label>
            <input id="fechaRevision" name="fechaRevision" type="date" className={campo} />
          </div>
        </div>

        <div>
          <Enviar texto="Asignar tarea" pendiente="Asignando…" />
        </div>
      </form>
    </div>
  );
}

const VALORACIONES = [
  { v: "requiere_apoyo", t: "Requiere apoyo" },
  { v: "en_desarrollo", t: "En desarrollo" },
  { v: "consolidado", t: "Consolidado" },
  { v: "destacado", t: "Destacado" },
] as const;

export function Avance({ claseId }: { claseId: number }) {
  const [estado, accion] = useActionState<EstadoProgreso, FormData>(registrarAvance, {});

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="claseId" value={claseId} />
      <Aviso id="avance" error={estado.error} ok={estado.ok} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="valoracion" className={etiqueta}>Cómo va</label>
        <select id="valoracion" name="valoracion" required className={campo} defaultValue="">
          <option value="" disabled>Elige…</option>
          {VALORACIONES.map((v) => <option key={v.v} value={v.v}>{v.t}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notas" className={etiqueta}>Notas del avance</label>
        <textarea id="notas" name="notas" rows={3} required className={campo} />
      </div>

      <div>
        <Enviar texto="Registrar avance" pendiente="Guardando…" />
      </div>
    </form>
  );
}
