import Image from "next/image";
import Link from "next/link";

import { Campana } from "@/components/campana";
import { permisosDe } from "@/lib/auth/permisos";
import type { Sesion } from "@/lib/auth/sesion";
import { avisosSinLeer } from "@/lib/datos/avisos";
import { rutaInicialDeAjustes, rutaInicialDeFinanzas } from "@/lib/navegacion";

const TITULO_ROL = { director: "Director", docente: "Maestro", asistente: "Asistente" } as const;

/**
 * `soloSalir` vacía el menú.
 *
 * Lo usa `/perfil` cuando la cuenta todavía tiene la contraseña que generó el
 * sistema: todas las demás pantallas rebotan de vuelta aquí, y un menú lleno de
 * enlaces que regresan al mismo sitio se ve averiado, no exigente.
 */
export function Encabezado(
  { sesion, activo, soloSalir = false }:
  { sesion: Sesion; activo?: string; soloSalir?: boolean },
) {
  // El menú se arma con lo que la cuenta realmente alcanza: mostrar un enlace que
  // lleva a un 404 hace parecer roto al sistema.
  const permisos = permisosDe(sesion.usuarioId);
  const rutaFinanzas = rutaInicialDeFinanzas((p) => permisos.has(p));
  const rutaAjustes = rutaInicialDeAjustes((p) => permisos.has(p));
  const enlaces = (soloSalir ? [] : [
    { href: "/", texto: "Tablero", clave: "tablero" },
    { href: "/agenda", texto: "Agenda", clave: "agenda" },
    { href: "/alumnos", texto: "Alumnos", clave: "alumnos" },
    rutaFinanzas
      ? { href: rutaFinanzas, texto: "Finanzas", clave: "finanzas" }
      : permisos.has("nomina.leer_propia")
        ? { href: "/finanzas/nomina", texto: "Mi nómina", clave: "finanzas" }
        : null,
    permisos.has("prospectos.leer")
      ? { href: "/prospectos", texto: "Prospectos", clave: "prospectos" }
      : null,
    permisos.has("comunicacion.redactar")
      ? { href: "/comunicacion", texto: "Mensajes", clave: "comunicacion" }
      : null,
    permisos.has("recitales.leer")
      ? { href: "/recitales", texto: "Recitales", clave: "recitales" }
      : null,
    permisos.has("inventario.gestionar")
      ? { href: "/inventario", texto: "Inventario", clave: "inventario" }
      : null,
    permisos.has("vales.entregar")
      ? { href: "/entregas", texto: "Entregas", clave: "entregas" }
      : null,
    permisos.has("renovaciones.leer")
      ? { href: "/renovaciones", texto: "Por renovar", clave: "renovaciones" }
      : null,
    // Cuentas, bitácora y catálogo viven dentro de Ajustes; reportes, dentro de Finanzas.
    // Quien no tiene nada de Ajustes conserva un acceso directo al catálogo, que es de todos.
    rutaAjustes
      ? { href: rutaAjustes, texto: "Ajustes", clave: "ajustes" }
      : { href: "/catalogo", texto: "Catálogo", clave: "ajustes" },
  ]).filter((e) => e !== null);

  return (
    <header className="border-b border-vs-linea bg-white/70 backdrop-blur">
      {/* Fila superior: logo + nombre + salir */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-3">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="VioliniStar Batuta — tablero">
          <Image
            src="/logo-violinistar.png"
            alt="VioliniStar"
            width={38}
            height={29}
            className="shrink-0"
            priority
          />
          <span className="font-display text-lg font-semibold tracking-tight leading-none">
            Batuta
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Campana sinLeer={avisosSinLeer(sesion.usuarioId)} />
          <Link href="/perfil"
                className="text-xs text-vs-tinta-3 no-underline hover:underline">
            {TITULO_ROL[sesion.rol]} {sesion.nombre}
          </Link>
          <form action="/salir" method="post">
            <button
              type="submit"
              className="rounded-lg border border-vs-linea px-2.5 py-1 text-xs font-medium
                         transition hover:border-vs-naranja-700 hover:text-vs-naranja-700
                         focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-vs-naranja-700"
            >
              Salir
            </button>
          </form>
        </div>
      </div>

      {/* Fila de navegación: scroll horizontal en móvil */}
      <nav className="scrollbar-none overflow-x-auto">
        <div className="mx-auto flex max-w-5xl gap-1 px-4 pb-2 pt-1 text-sm">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activo === e.clave ? "page" : undefined}
              className={`shrink-0 rounded-md px-2.5 py-1 no-underline transition ${
                activo === e.clave
                  ? "bg-vs-amarillo-suave font-medium text-vs-tinta"
                  : "text-vs-tinta-2 hover:bg-vs-crema"
              }`}
            >
              {e.texto}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
