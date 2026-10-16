"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/** Duración visual de la intro. Debe coincidir con la animación `.bienvenida` en globals.css. */
const DURACION_MS = 2900;

/**
 * Intro de inicio de sesión: el logo aparece, saluda y se desvanece en unos
 * 3 segundos, con un efecto de sonido. Se muestra una sola vez por inicio de
 * sesión: el login redirige a `/?bienvenida=1`, y al montar se quita el parámetro
 * sin recargar la página. Así un refresh no la repite.
 *
 * Se puede saltar con un clic o con Esc; al saltar, el sonido también se detiene.
 * Con «reducir movimiento» solo se desvanece.
 *
 * El navegador puede bloquear el sonido si no hubo interacción en la página. En
 * ese caso la intro se ve igual, sin sonido.
 */
export function Bienvenida({ saludo }: { saludo: string }) {
  const [visible, setVisible] = useState(true);
  const sonidoRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      // Si el navegador no deja reescribir la URL, la intro igual se muestra.
    }

    try {
      const sonido = new Audio("/sonido-bienvenida.mp3");
      sonidoRef.current = sonido;
      sonido.play().catch(() => {
        // Bloqueado por el navegador: la intro sigue, sin sonido.
      });
    } catch {
      // Sin soporte de audio: la intro sigue, sin sonido.
    }

    const fin = window.setTimeout(() => setVisible(false), DURACION_MS);
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") saltar();
    };
    window.addEventListener("keydown", teclado);
    return () => {
      window.clearTimeout(fin);
      window.removeEventListener("keydown", teclado);
      // Si la persona se va de la página antes de que termine, el sonido también.
      sonidoRef.current?.pause();
    };
    // saltar es estable: solo usa refs y setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saltar() {
    sonidoRef.current?.pause();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" onClick={saltar} className="bienvenida">
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
