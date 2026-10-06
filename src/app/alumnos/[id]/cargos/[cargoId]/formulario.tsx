"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  cancelarCargoAccion,
  editarCargo,
  type EstadoCargoCancelar,
  type EstadoCargoEditar,
} from "@/app/alumnos/[id]/cargos/acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function BotonGuardar() {
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
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

function BotonCancelar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold
                 text-red-800 transition hover:bg-red-100 focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-red-500
                 disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar cargo"}
    </button>
  );
}

type Inicial = {
  descripcion: string;
  periodo: string;
  monto: string;
  venceEl: string;
};

export function FormularioEditarCargo({
  cargoId, alumnoId, inicial,
}: {
  cargoId: number;
  alumnoId: number;
  inicial: Inicial;
}) {
  const [estadoEditar, accionEditar] = useActionState<EstadoCargoEditar, FormData>(editarCargo, {});
  const [estadoCancelar, accionCancelar] = useActionState<EstadoCargoCancelar, FormData>(cancelarCargoAccion, {});

  return (
    <div className="flex flex-col gap-8">
      {/* ——— Formulario de edición ——— */}
      <form action={accionEditar} className="flex flex-col gap-4">
        <input type="hidden" name="cargoId" value={cargoId} />
        <input type="hidden" name="alumnoId" value={alumnoId} />

        {estadoEditar.error && (
          <p role="alert"
             className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {estadoEditar.error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="descripcion" className="text-xs font-medium text-vs-tinta-2">
            Descripción del cargo
          </label>
          <input
            id="descripcion" name="descripcion" required
            defaultValue={inicial.descripcion}
            className={campo}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodo" className="text-xs font-medium text-vs-tinta-2">
            Periodo <span className="font-normal text-vs-tinta-3">(opcional)</span>
          </label>
          <input
            id="periodo" name="periodo"
            placeholder="Ej: 18 sep - 17 oct 2026"
            defaultValue={inicial.periodo}
            className={campo}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="monto" className="text-xs font-medium text-vs-tinta-2">
              Monto en pesos
            </label>
            <input
              id="monto" name="monto" type="number" step="0.01" min="0.01" required
              defaultValue={inicial.monto}
              className={campo}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="venceEl" className="text-xs font-medium text-vs-tinta-2">
              Fecha de vencimiento
            </label>
            <input
              id="venceEl" name="venceEl" type="date" required
              defaultValue={inicial.venceEl}
              className={campo}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <BotonGuardar />
          <a href={`/alumnos/${alumnoId}`} className="text-sm text-vs-tinta-3 hover:underline">
            Cancelar
          </a>
        </div>
      </form>

      {/* ——— Zona peligrosa: eliminar cargo ——— */}
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h2 className="text-sm font-semibold text-red-900">Eliminar este cargo</h2>
        <p className="mt-1 text-xs text-red-700">
          El cargo se cancelará y dejará de aparecer en la cobranza activa. Los pagos ya
          aplicados quedan como saldo a favor del alumno. Esta acción no se puede deshacer
          desde la interfaz.
        </p>

        <form action={accionCancelar} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="cargoId" value={cargoId} />
          <input type="hidden" name="alumnoId" value={alumnoId} />

          {estadoCancelar.error && (
            <p role="alert"
               className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-800">
              {estadoCancelar.error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo" className="text-xs font-medium text-red-800">
              Motivo <span className="font-normal text-red-600">(opcional)</span>
            </label>
            <input
              id="motivo" name="motivo"
              placeholder="Ej: se cargó por error, monto incorrecto…"
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm
                         focus-visible:outline-2 focus-visible:outline-offset-1
                         focus-visible:outline-red-500"
            />
          </div>

          <BotonCancelar />
        </form>
      </div>
    </div>
  );
}
