"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { seccionActiva, type GrupoDeSecciones } from "@/lib/navegacion";

const LLAVE = "batuta:barra-lateral";

type Props = {
  titulo: string;
  grupos: GrupoDeSecciones[];
  /** Un bloque fijo arriba de las secciones (p. ej. las cifras del mes en Finanzas). */
  resumen?: ReactNode;
  children: ReactNode;
};

/**
 * Pantalla con barra lateral de secciones a la izquierda y el contenido a la derecha.
 *
 * Se muestra y se oculta con Ctrl + B (Cmd + B en Mac) o con el botón; la elección se recuerda en
 * este navegador. En pantallas angostas la barra es un panel que se abre encima y se cierra sola
 * al elegir una sección. El almacenamiento local puede fallar (modo privado): nada depende de él.
 */
export function EstructuraLateral({ titulo, grupos, resumen, children }: Props) {
  const ruta = usePathname();
  const activa = seccionActiva(grupos, ruta);
  const [abierta, setAbierta] = useState(true);
  const [angosta, setAngosta] = useState(false);

  // Estado inicial real: lo guardado, o cerrada en pantallas angostas.
  useEffect(() => {
    const estrecha = window.matchMedia("(max-width: 767px)").matches;
    setAngosta(estrecha);
    let guardado: string | null = null;
    try { guardado = localStorage.getItem(LLAVE); } catch { /* sin almacenamiento */ }
    setAbierta(estrecha ? false : guardado !== "cerrada");
  }, []);

  const cambiar = (valor: boolean | ((v: boolean) => boolean)) => {
    setAbierta((anterior) => {
      const nueva = typeof valor === "function" ? valor(anterior) : valor;
      try { localStorage.setItem(LLAVE, nueva ? "abierta" : "cerrada"); } catch { /* sin almacenamiento */ }
      return nueva;
    });
  };

  // Ctrl/Cmd + B. Se frena el atajo del navegador (marcadores, negritas) mientras esta pantalla está abierta.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        cambiar((v) => !v);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // En pantallas angostas, elegir una sección cierra el panel.
  useEffect(() => { if (angosta) setAbierta(false); }, [ruta, angosta]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {abierta && angosta && (
        <button type="button" aria-label="Cerrar secciones" onClick={() => cambiar(false)}
                className="fixed inset-0 z-30 bg-black/30 md:hidden" />
      )}

      <aside
        id="barra-lateral"
        aria-label={`Secciones de ${titulo}`}
        hidden={!abierta}
        className="z-40 w-64 shrink-0 overflow-y-auto border-r border-vs-linea bg-white/90
                   max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-72 max-md:shadow-xl
                   md:sticky md:top-0 md:max-h-screen md:self-start"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          <button type="button" onClick={() => cambiar(false)} title="Ocultar (Ctrl + B)"
                  className="rounded-md px-1.5 py-0.5 text-xs text-vs-tinta-3 hover:bg-vs-crema hover:text-vs-tinta">
            ‹ Ocultar
          </button>
        </div>

        {resumen && <div className="px-4 pb-3">{resumen}</div>}

        <nav className="px-2 pb-6">
          {grupos.map((g) => (
            <div key={g.titulo} className="mt-3">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-vs-tinta-3">{g.titulo}</p>
              <ul className="mt-1">
                {g.secciones.map((s) => {
                  const es = s.href === activa;
                  return (
                    <li key={s.href}>
                      <Link
                        href={s.href}
                        aria-current={es ? "page" : undefined}
                        title={s.detalle}
                        className={`block rounded-lg border-l-[3px] px-2.5 py-1.5 text-sm no-underline transition ${
                          es
                            ? "border-vs-naranja bg-vs-crema font-semibold text-vs-tinta"
                            : "border-transparent text-vs-tinta-2 hover:bg-vs-crema/70 hover:text-vs-tinta"
                        }`}
                      >
                        {s.texto}
                        {s.detalle && <span className="block text-[11px] font-normal leading-snug text-vs-tinta-3">{s.detalle}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="relative min-w-0 flex-1 overflow-x-clip">
        {!abierta && (
          <div className="px-3 pt-3 sm:px-5">
            <button type="button" onClick={() => cambiar(true)} aria-expanded={false} aria-controls="barra-lateral"
                    className="inline-flex items-center gap-2 rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-xs font-medium text-vs-tinta-2 transition hover:border-vs-naranja-700 hover:text-vs-naranja-700">
              <span aria-hidden="true">☰</span> {titulo}
              <kbd className="rounded border border-vs-linea bg-vs-crema px-1.5 py-0.5 font-mono text-[10px] text-vs-tinta-3">Ctrl B</kbd>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
