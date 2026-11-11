"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EVENTO_FONDO, cambiarFondoPausado, fondoAnimadoPermitido, fondoPausadoGuardado } from "@/lib/fondo";

/**
 * Paisaje de fondo de toda la aplicación: un video corto en bucle detrás del contenido, con la
 * imagen fija como respaldo y un velo claro para que el texto se lea encima.
 *
 * - En celular, con «reducir movimiento» o en ahorro de datos: solo la imagen (ver lib/fondo.ts).
 * - MP4 (H.264) primero y WebM (VP9) de respaldo, para navegadores sin H.264.
 * - Hasta 1279 px de ancho carga la versión de 1280 px; desde ahí, la de 1920.
 * - El botón de pausa vive en el encabezado. En las pantallas sin encabezado (la de acceso),
 *   la escena pone el suyo en una esquina, donde no tapa nada.
 * - No se imprime: los recibos y comprobantes salen en blanco.
 */
export function FondoEscena() {
  const video = useRef<HTMLVideoElement>(null);
  const [conVideo, setConVideo] = useState(false);
  const [ancho, setAncho] = useState(1920);
  const [pausado, setPausado] = useState(false);
  const [botonPropio, setBotonPropio] = useState(false);
  const ruta = usePathname();

  useEffect(() => {
    if (!fondoAnimadoPermitido()) return;
    setAncho(window.innerWidth < 1280 ? 1280 : 1920);
    setPausado(fondoPausadoGuardado());
    setConVideo(true);
    const alCambiar = (e: Event) => setPausado((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENTO_FONDO, alCambiar);
    return () => window.removeEventListener(EVENTO_FONDO, alCambiar);
  }, []);

  // Cada pantalla decide: con encabezado, el botón va ahí; sin él, la escena pone el suyo.
  useEffect(() => {
    setBotonPropio(!document.querySelector("[data-control-fondo]"));
  }, [ruta]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (pausado) v.pause();
    else v.play().catch(() => { /* el navegador no lo dejó reproducir: queda la imagen */ });
  }, [pausado, conVideo]);

  return (
    <>
      <div aria-hidden="true" className="fondo-escena no-imprimir">
        {conVideo && (
          <video
            ref={video}
            className="fondo-escena-video"
            poster="/fondo/escena.jpg"
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={`/fondo/escena-${ancho}.mp4`} type="video/mp4" />
            <source src={`/fondo/escena-${ancho}.webm`} type="video/webm" />
          </video>
        )}
        <div className="fondo-escena-velo" />
      </div>
      {conVideo && botonPropio && (
        <button
          type="button"
          onClick={() => cambiarFondoPausado(!pausado)}
          aria-pressed={pausado}
          aria-label={pausado ? "Reanudar el fondo animado" : "Pausar el fondo animado"}
          title={pausado ? "Reanudar el fondo" : "Pausar el fondo"}
          className="no-imprimir fixed bottom-3 left-3 z-30 grid h-8 w-8 place-items-center rounded-full
                     border border-white/60 bg-white/50 text-xs text-vs-tinta-2 backdrop-blur
                     transition hover:bg-white/80"
        >
          <span aria-hidden="true">{pausado ? "▶" : "❚❚"}</span>
        </button>
      )}
    </>
  );
}
