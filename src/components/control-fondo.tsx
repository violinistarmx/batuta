"use client";

import { useEffect, useState } from "react";

import { EVENTO_FONDO, cambiarFondoPausado, fondoAnimadoPermitido, fondoPausadoGuardado } from "@/lib/fondo";

/**
 * Botón del encabezado para pausar o reanudar el paisaje animado. Todo lo que se mueve más de
 * 5 segundos debe poder detenerse; aquí no tapa contenido. Solo aparece donde hay video.
 */
export function ControlFondo() {
  const [visible, setVisible] = useState(false);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (!fondoAnimadoPermitido()) return;
    setPausado(fondoPausadoGuardado());
    setVisible(true);
    const alCambiar = (e: Event) => setPausado((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENTO_FONDO, alCambiar);
    return () => window.removeEventListener(EVENTO_FONDO, alCambiar);
  }, []);

  if (!visible) return <span data-control-fondo hidden />;

  return (
    <button
      type="button"
      data-control-fondo
      onClick={() => cambiarFondoPausado(!pausado)}
      aria-pressed={pausado}
      aria-label={pausado ? "Reanudar el fondo animado" : "Pausar el fondo animado"}
      title={pausado ? "Reanudar el fondo" : "Pausar el fondo"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs text-vs-tinta-3
                 transition hover:bg-vs-crema hover:text-vs-tinta focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-vs-naranja-700"
    >
      <span aria-hidden="true">{pausado ? "▶" : "❚❚"}</span>
    </button>
  );
}
