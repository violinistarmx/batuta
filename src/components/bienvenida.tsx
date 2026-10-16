"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Duración total de la intro. Debe coincidir con la animación `.bienvenida` en globals.css. */
const DURACION_MS = 2900;

/**
 * Intro de inicio de sesión: el logo aparece, saluda y se desvanece en unos
 * 3 segundos. Se muestra una sola vez por inicio de sesión: el login redirige a
 * `/?bienvenida=1`, y al montar se quita el parámetro sin recargar la página.
 * Así un refresh no la repite.
 *
 * Se puede saltar con un clic o con Esc. Con «reducir movimiento» solo se desvanece.
 */
export function Bienvenida({ saludo }: { saludo: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      // Si el navegador no deja reescribir la URL, la intro igual se muestra.
    }

    const fin = window.setTimeout(() => setVisible(false), DURACION_MS);
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", teclado);
    return () => {
      window.clearTimeout(fin);
      window.removeEventListener("keydown", teclado);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setVisible(false)}
      className="bienvenida"
    >
      <div className="bienvenida-contenido">
        <Image
          src="/logo-violinistar.png"
          alt="VioliniStar"
          width={155}
          height={120}
          priority
          className="bienvenida-logo"
        />
        <p className="bienvenida-saludo">{saludo}</p>
      </div>
    </div>
  );
}
