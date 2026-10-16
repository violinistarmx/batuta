"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botón que pide confirmación en un modal antes de enviar el formulario que lo
 * contiene. Va dentro de un <form>: al confirmar, el botón de confirmar envía ese
 * mismo formulario, así que la acción del servidor no cambia.
 *
 * Usa <dialog> nativo: el foco queda atrapado dentro, la tecla Esc cierra y el
 * fondo oscuro viene del navegador. La animación está en `.confirmar` (globals.css).
 *
 * Al confirmar, el modal se cierra y el botón original muestra `pendiente` mientras
 * el servidor responde. Así un error de la acción se lee en la página, no detrás
 * del fondo del modal.
 */
export function ConfirmarAccion({
  etiqueta,
  titulo,
  descripcion,
  confirmar,
  pendiente,
  peligro = false,
  className,
}: {
  etiqueta: string;
  titulo: string;
  descripcion: string;
  confirmar: string;
  pendiente?: string;
  peligro?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  return (
    <>
      <BotonDisparador
        etiqueta={etiqueta}
        pendiente={pendiente}
        className={className}
        onAbrir={() => ref.current?.showModal()}
      />

      <dialog
        ref={ref}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        className="confirmar"
      >
        <h2 id={`${id}-titulo`} className="font-display text-lg font-semibold text-vs-tinta">
          {titulo}
        </h2>
        <p id={`${id}-texto`} className="mt-2 whitespace-pre-line text-sm text-vs-tinta-2">
          {descripcion}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-lg border border-vs-linea bg-white px-4 py-2 text-sm font-medium
                       text-vs-tinta-2 transition hover:bg-vs-crema"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={() => ref.current?.close()}
            className={
              peligro
                ? "rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100"
                : "rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta transition hover:bg-vs-naranja-claro"
            }
          >
            {confirmar}
          </button>
        </div>
      </dialog>
    </>
  );
}

/** Lee el estado del formulario padre para mostrar «pendiente» mientras responde. */
function BotonDisparador({
  etiqueta, pendiente, className, onAbrir,
}: {
  etiqueta: string;
  pendiente?: string;
  className?: string;
  onAbrir: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="button" onClick={onAbrir} disabled={pending} className={className}>
      {pending && pendiente ? pendiente : etiqueta}
    </button>
  );
}
