"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { entrar, type EstadoAcceso } from "./acciones";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-vs-naranja px-4 py-2.5 text-sm font-semibold
                 text-vs-tinta transition hover:bg-vs-naranja-claro
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-vs-naranja-700 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioAcceso() {
  const [estado, accion] = useActionState<EstadoAcceso, FormData>(entrar, {});

  return (
    <form action={accion} className="flex flex-col gap-4">
      {estado.error && (
        <p
          id="error-acceso"
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-vs-tinta-2">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={estado.email ?? ""}
          className="rounded-lg border border-vs-linea px-3 py-2 text-sm
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-vs-naranja-700"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-vs-tinta-2">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-vs-linea px-3 py-2 text-sm
                     focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-vs-naranja-700"
        />
      </div>

      <Boton />
    </form>
  );
}
