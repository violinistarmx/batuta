"use client";

import { useState } from "react";

/**
 * La contraseña recién generada, visible una sola vez.
 *
 * No se guarda en ninguna parte —la base solo tiene su hash— y no viaja por la
 * URL. Si esta pantalla se recarga, se pierde: por eso el panel insiste en
 * anotarla antes de seguir, y por eso no hay un «volver a verla».
 */
export function Credencial(
  { c }: { c: { nombre: string; email: string; rol: string; password: string } },
) {
  const [copiado, setCopiado] = useState(false);

  return (
    <section id="credencial-generada"
             className="rounded-xl border-2 border-vs-naranja bg-vs-amarillo-suave p-5">
      <h2 className="font-display text-lg font-semibold">
        Esta contraseña no se vuelve a mostrar
      </h2>
      <p className="mt-1 text-sm">
        Entrégala en persona, o por un canal distinto al correo con el que entra:
        mandar las dos cosas al mismo buzón hace que ese buzón sea la cuenta.
      </p>

      <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea">
        <div className="bg-white px-4 py-2.5">
          <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Nombre</dt>
          <dd className="mt-0.5 font-medium">{c.nombre}</dd>
        </div>
        <div className="bg-white px-4 py-2.5">
          <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Entra con</dt>
          <dd className="mt-0.5 font-mono text-sm">{c.email}</dd>
        </div>
        <div className="bg-white px-4 py-2.5">
          <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Rol</dt>
          <dd className="mt-0.5">{c.rol}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Contraseña</dt>
          <dd id="password-generada"
              className="mt-1 select-all font-mono text-xl font-semibold tracking-wide">
            {c.password}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(c.password).then(
              () => setCopiado(true),
              () => setCopiado(false),
            );
          }}
          className="rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm font-medium
                     transition hover:border-vs-naranja-700"
        >
          Copiar la contraseña
        </button>
        {copiado && (
          <span id="password-copiada" role="status" className="text-sm text-green-900">
            Copiada al portapapeles.
          </span>
        )}
      </div>

      <p className="mt-4 text-xs">
        En cuanto entre, Batuta lo manda a cambiarla y no lo deja hacer nada más hasta
        que lo haga. Si se pierde antes de eso, no hay que buscarla: se genera otra
        desde la cuenta.
      </p>
    </section>
  );
}
