"use client";

import { useActionState, useState } from "react";
import { ConfirmarAccion } from "@/components/confirmar-accion";
import type { EstadoGasto } from "./acciones";

type Opcion = { id: number; nombre: string };
type Categoria = Opcion & { color: string; tipoSugerido: "fijo" | "variable" };

type Props = {
  accion: (prev: EstadoGasto, datos: FormData) => Promise<EstadoGasto>;
  categorias: Categoria[];
  sedes: Opcion[];
  programas: Opcion[];
  subcategorias: { categoriaId: number; subcategoria: string }[];
  inicial?: {
    id?: number;
    categoriaId: number | null;
    subcategoria: string | null;
    tipo: "fijo" | "variable";
    sedeId: number | null;
    programaId: number | null;
    concepto: string;
    montoCentavos: number | null;
    fecha: string;
  };
  /** Ruta de gastos a la que se vuelve al guardar (por ejemplo, la celda de la matriz). */
  volver?: string;
  etiquetaBoton?: string;
};

const campo = "mt-1.5 w-full rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus:outline-2 focus:outline-vs-naranja-700";
const etiqueta = "block text-sm font-medium text-vs-tinta";

/** Formulario para registrar y editar gastos. */
export function FormularioGasto({
  accion, categorias, sedes, programas, subcategorias, inicial, volver, etiquetaBoton = "Guardar gasto",
}: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const [categoriaId, setCategoriaId] = useState<number | null>(inicial?.categoriaId ?? null);
  const [tipo, setTipo] = useState<"fijo" | "variable">(inicial?.tipo ?? "variable");
  // Si la persona eligió el tipo a mano, cambiar de categoría ya no lo pisa.
  const [tipoTocado, setTipoTocado] = useState(Boolean(inicial?.id));

  const sugeridas = subcategorias.filter((s) => s.categoriaId === categoriaId).map((s) => s.subcategoria);

  return (
    <form action={enviar} className="mt-6 space-y-5 rounded-xl border border-vs-linea bg-white p-6">
      {inicial?.id && <input type="hidden" name="id" value={inicial.id} />}
      {volver && <input type="hidden" name="volver" value={volver} />}

      {estado.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{estado.error}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="categoriaId" className={etiqueta}>Categoría <span aria-hidden="true">*</span></label>
          <select
            id="categoriaId" name="categoriaId" required className={campo}
            value={categoriaId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              setCategoriaId(id);
              const cat = categorias.find((c) => c.id === id);
              if (cat && !tipoTocado) setTipo(cat.tipoSugerido);
            }}
          >
            <option value="" disabled>Elige…</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="subcategoria" className={etiqueta}>Subcategoría</label>
          <input
            id="subcategoria" name="subcategoria" type="text" maxLength={80} list="subcategorias-sugeridas"
            defaultValue={inicial?.subcategoria ?? ""} placeholder="Ej. Luz, Instagram, Cuerdas…" className={campo}
          />
          <datalist id="subcategorias-sugeridas">
            {sugeridas.map((s) => <option key={s} value={s} />)}
          </datalist>
          <p className="mt-1 text-xs text-vs-tinta-3">
            En publicidad, escribe el canal (Instagram, Facebook, Google…): así se calcula el costo por alumno de cada canal.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="concepto" className={etiqueta}>Concepto <span aria-hidden="true">*</span></label>
        <input
          id="concepto" name="concepto" type="text" required maxLength={200}
          defaultValue={inicial?.concepto ?? ""} placeholder="Ej. Renta octubre, Cuerdas de violín…" className={campo}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="monto" className={etiqueta}>Monto (pesos) <span aria-hidden="true">*</span></label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vs-tinta-3">$</span>
            <input
              id="monto" name="monto" type="number" required min="0.01" max="10000000" step="0.01"
              inputMode="decimal"
              defaultValue={inicial?.montoCentavos ? (inicial.montoCentavos / 100).toFixed(2) : ""}
              placeholder="0.00"
              className="w-full rounded-lg border border-vs-linea bg-white py-2 pl-7 pr-3 text-sm focus:outline-2 focus:outline-vs-naranja-700"
            />
          </div>
        </div>
        <div>
          <label htmlFor="fecha" className={etiqueta}>Fecha <span aria-hidden="true">*</span></label>
          <input id="fecha" name="fecha" type="date" required defaultValue={inicial?.fecha} className={campo} />
        </div>
      </div>

      <fieldset>
        <legend className={etiqueta}>Tipo <span aria-hidden="true">*</span></legend>
        <div className="mt-1.5 inline-flex rounded-lg border border-vs-linea p-0.5 text-sm">
          {(["fijo", "variable"] as const).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-md px-4 py-1.5 transition ${
                tipo === t ? "bg-vs-naranja font-semibold text-vs-tinta" : "text-vs-tinta-2 hover:text-vs-tinta"
              }`}
            >
              <input
                type="radio" name="tipo" value={t} checked={tipo === t} className="sr-only"
                onChange={() => { setTipo(t); setTipoTocado(true); }}
              />
              {t === "fijo" ? "Fijo" : "Variable"}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-vs-tinta-3">
          Fijo: se paga igual haya los alumnos que haya (renta, contador). Entra al punto de equilibrio.
        </p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sedeId" className={etiqueta}>Sede</label>
          <select id="sedeId" name="sedeId" defaultValue={inicial?.sedeId ?? ""} className={campo}>
            <option value="">General (toda la academia)</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="programaId" className={etiqueta}>Programa</label>
          <select id="programaId" name="programaId" defaultValue={inicial?.programaId ?? ""} className={campo}>
            <option value="">Ninguno en particular</option>
            {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit" disabled={pendiente}
          className="rounded-lg bg-vs-naranja px-5 py-2 text-sm font-semibold text-vs-tinta transition
                     hover:bg-vs-naranja-700 hover:text-white disabled:opacity-60
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
        >
          {pendiente ? "Guardando…" : etiquetaBoton}
        </button>
        <a href={volver ?? "/finanzas/gastos"} className="text-sm text-vs-tinta-3 hover:underline">Cancelar</a>
      </div>
    </form>
  );
}

/** Botón de eliminación con confirmación inline. */
export function BtnEliminar({
  accion, gastoId, volver,
}: {
  accion: (prev: EstadoGasto, datos: FormData) => Promise<EstadoGasto>;
  gastoId: number;
  volver?: string;
}) {
  const [estado, enviar] = useActionState(accion, {});

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={gastoId} />
      {volver && <input type="hidden" name="volver" value={volver} />}
      {estado.error && <p className="mb-2 text-xs text-red-600">{estado.error}</p>}
      <ConfirmarAccion
        etiqueta="Eliminar"
        pendiente="Eliminando…"
        titulo="¿Eliminar este gasto?"
        descripcion="Se quitará del registro y de los totales del periodo. La acción no se puede deshacer."
        confirmar="Sí, eliminar"
        peligro
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700
                   transition hover:bg-red-50 disabled:opacity-60"
      />
    </form>
  );
}

/** Fila editable de una categoría de gasto. */
export function FormularioCategoria({
  accion, inicial,
}: {
  accion: (prev: EstadoGasto, datos: FormData) => Promise<EstadoGasto>;
  inicial?: { id: number; nombre: string; color: string; tipoSugerido: "fijo" | "variable"; activo: boolean; usos: number };
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2 py-2.5">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <label className="sr-only" htmlFor={`color-${inicial?.id ?? "nueva"}`}>Color</label>
      <input
        id={`color-${inicial?.id ?? "nueva"}`} name="color" type="color" defaultValue={inicial?.color ?? "#94a3b8"}
        className="h-9 w-11 cursor-pointer rounded-lg border border-vs-linea bg-white p-1"
      />
      <label className="sr-only" htmlFor={`nombre-${inicial?.id ?? "nueva"}`}>Nombre</label>
      <input
        id={`nombre-${inicial?.id ?? "nueva"}`} name="nombre" required maxLength={60}
        defaultValue={inicial?.nombre ?? ""} placeholder="Nueva categoría"
        className="min-w-0 flex-1 rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm"
      />
      <label className="sr-only" htmlFor={`tipo-${inicial?.id ?? "nueva"}`}>Tipo sugerido</label>
      <select
        id={`tipo-${inicial?.id ?? "nueva"}`} name="tipoSugerido" defaultValue={inicial?.tipoSugerido ?? "variable"}
        className="rounded-lg border border-vs-linea bg-white px-2 py-2 text-sm"
      >
        <option value="fijo">Fijo</option>
        <option value="variable">Variable</option>
      </select>
      <label className="flex items-center gap-1.5 text-sm text-vs-tinta-2">
        <input type="checkbox" name="activo" defaultChecked={inicial?.activo ?? true} />
        Activa
      </label>
      <button
        type="submit" disabled={pendiente}
        className="rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm font-medium transition
                   hover:border-vs-naranja-700 hover:text-vs-naranja-700 disabled:opacity-60"
      >
        {pendiente ? "…" : inicial ? "Guardar" : "Agregar"}
      </button>
      {inicial && (
        <span className="text-xs text-vs-tinta-3">{inicial.usos} gasto{inicial.usos === 1 ? "" : "s"}</span>
      )}
      {estado.error && <span role="alert" className="basis-full text-xs text-red-700">{estado.error}</span>}
      {estado.ok && <span role="status" className="basis-full text-xs text-green-800">{estado.ok}</span>}
    </form>
  );
}
