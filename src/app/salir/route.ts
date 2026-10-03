import { registrar } from "@/lib/bitacora";
import { cerrarSesion, sesionActual } from "@/lib/auth/sesion";

/**
 * Cerrar sesión es POST, no GET.
 *
 * Con GET, una imagen con src="/salir" incrustada en cualquier página cerraría la
 * sesión del director sin que él hiciera nada.
 */
export async function POST() {
  const sesion = await sesionActual();
  if (sesion) {
    registrar({
      usuarioId: sesion.usuarioId,
      accion: "sesion.cerrar",
      entidad: "usuarios",
      entidadId: sesion.usuarioId,
    });
  }
  await cerrarSesion();

  // Location relativa, no absoluta: detrás de un proxy, `request.url` trae el host
  // interno (0.0.0.0) y el navegador terminaría en una dirección inalcanzable.
  return new Response(null, { status: 303, headers: { Location: "/entrar" } });
}
