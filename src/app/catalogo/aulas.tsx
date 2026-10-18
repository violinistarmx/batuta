"use client";

import { useActionState } from "react";

import { asignarSedeAulaAccion, crearAulaAccion, type EstadoAula } from "./aulas-acciones";

/** Selector de sede de un aula. La sede de cada clase sale de su aula. */
export function SedeDeAula({
  aulaId, nombre, sedeId, sedes,
}: {
  aulaId: number; nombre: string; sedeId: number | null; sedes: { id: number; nombre: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoAula, FormData>(asignarSedeAulaAccion, {});
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2 rounded border border-vs-linea bg-white px-2.5 py-1.5 text-sm">
      <input type="hidden" name="aulaId" value={aulaId} />
      <span className="font-medium">{nombre}</span>
      <label className="sr-only" htmlFor={`sede-aula-${aulaId}`}>Sede de {nombre}</label>
      <select
        id={`sede-aula-${aulaId}`} name="sedeId" defaultValue={sedeId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={pendiente}
        className="rounded border border-vs-linea bg-white px-1.5 py-0.5 text-xs"
      >
        <option value="">Sin sede</option>
        {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      {estado.error && <span role="alert" className="text-xs text-red-700">{estado.error}</span>}
      {estado.ok && <span role="status" className="text-xs text-green-800">{estado.ok}</span>}
    </form>
  );
}

/** Alta de un aula con su sede. */
export function NuevaAula({ sedes }: { sedes: { id: number; nombre: string }[] }) {
  const [estado, enviar, pendiente] = useActionState<EstadoAula, FormData>(crearAulaAccion, {});
  return (
    <form action={enviar} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="aula-nueva-nombre">Nombre del aula</label>
      <input id="aula-nueva-nombre" name="nombre" required maxLength={60} placeholder="Ej. Aula Hueypoxtla"
             className="rounded border border-vs-linea bg-white px-2 py-1" />
      <label className="sr-only" htmlFor="aula-nueva-sede">Sede</label>
      <select id="aula-nueva-sede" name="sedeId" required defaultValue=""
              className="rounded border border-vs-linea bg-white px-1.5 py-1">
        <option value="" disabled>Sede…</option>
        {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <button type="submit" disabled={pendiente}
              className="rounded border border-vs-linea bg-white px-2.5 py-1 font-medium hover:border-vs-naranja-700 disabled:opacity-60">
        {pendiente ? "…" : "Agregar aula"}
      </button>
      {estado.error && <span role="alert" className="text-xs text-red-700">{estado.error}</span>}
      {estado.ok && <span role="status" className="text-xs text-green-800">{estado.ok}</span>}
    </form>
  );
}
