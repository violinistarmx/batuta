"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { cambiarMiPassword, type EstadoPerfil } from "./acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                       transition hover:bg-vs-naranja-claro disabled:opacity-60">
      {pending ? "Cambiando…" : "Cambiar contraseña"}
    </button>
  );
}

export function CambiarPassword() {
  const [estado, accion] = useActionState<EstadoPerfil, FormData>(cambiarMiPassword, {});
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");

  // El mismo criterio que aplica el servidor, para avisar antes de enviar.
  const problemas: string[] = [];
  if (nueva && nueva.length < 12) problemas.push("Al menos 12 caracteres.");
  if (nueva && !/[a-záéíóúñ]/i.test(nueva)) problemas.push("Alguna letra.");
  if (nueva && !/[0-9]/.test(nueva)) problemas.push("Algún número.");
  const noCoinciden = repetida !== "" && nueva !== repetida;

  return (
    <form action={accion} className="flex max-w-md flex-col gap-4">
      {estado.error && (
        <p id="error-password" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p id="ok-password" role="status"
           className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {estado.ok}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="actual" className="text-xs font-medium text-vs-tinta-2">
          Contraseña actual
        </label>
        <input id="actual" name="actual" type="password" required autoComplete="current-password"
               className={campo} />
        <span className="text-xs text-vs-tinta-3">
          Se pide aunque ya tengas sesión: un teléfono olvidado abierto no debería bastar para
          quedarse con la cuenta.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nueva" className="text-xs font-medium text-vs-tinta-2">
          Contraseña nueva
        </label>
        <input id="nueva" name="nueva" type="password" required autoComplete="new-password"
               className={campo} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <span className="text-xs text-vs-tinta-3">
          Doce caracteres o más. Una frase con un número se recuerda y no se adivina:
          «violin1-pachuca-hidalgo».
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="repetida" className="text-xs font-medium text-vs-tinta-2">
          Repítela
        </label>
        <input id="repetida" name="repetida" type="password" required autoComplete="new-password"
               className={campo} value={repetida} onChange={(e) => setRepetida(e.target.value)} />
      </div>

      {problemas.length > 0 && (
        <p id="problemas-password"
           className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Falta: {problemas.join(" ")}
        </p>
      )}
      {noCoinciden && (
        <p id="no-coinciden"
           className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Las dos contraseñas nuevas no coinciden.
        </p>
      )}

      <div><Guardar /></div>
    </form>
  );
}
