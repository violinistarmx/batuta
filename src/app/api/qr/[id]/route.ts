import QRCode from "qrcode";

import { alcanceDe, exigirSesionUsable, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";

/**
 * El QR del alumno como PNG, para mandarlo por WhatsApp.
 *
 * Existe aparte del SVG que se dibuja en pantalla porque son dos usos distintos:
 * el SVG se ve e imprime, el PNG se comparte. WhatsApp no manda SVG, y pedirle a
 * recepción que le tome captura de pantalla a la pantalla produce códigos cortados
 * que no escanean.
 *
 * La ruta exige sesión y respeta el alcance: sin eso, conocer el id de un alumno
 * bastaría para fabricar su credencial.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await exigirSesionUsable();
  if (!tienePermiso(sesion, "alumnos.leer")) {
    return new Response("No encontrado", { status: 404 });
  }

  const { id } = await params;
  const alumnoId = Number(id);
  if (!Number.isInteger(alumnoId)) return new Response("No encontrado", { status: 404 });

  const alumno = alumnoPorId(alumnoId, alcanceDe(sesion));
  if (!alumno) return new Response("No encontrado", { status: 404 });

  const base = process.env.URL_PUBLICA ?? new URL(_peticion.url).origin;

  const png = await QRCode.toBuffer(`${base}/qr/${alumno.qrToken}`, {
    type: "png",
    // Nivel Q tolera ~25 % de daño: el código va a vivir en la galería de un
    // teléfono, recomprimido por WhatsApp y mostrado con la pantalla sucia.
    errorCorrectionLevel: "Q",
    margin: 2,
    width: 720,
    color: { dark: "#221A0E", light: "#FFFFFF" },
  });

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.consultar_qr",
    entidad: "alumnos",
    entidadId: alumno.id,
    cambios: { descarga: "png" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // El nombre del archivo se sanea: el código del alumno es nuestro y no trae
      // comillas ni saltos, pero la cabecera se arma igual sin confiar en eso.
      "Content-Disposition":
        `attachment; filename="VioliniStar-${alumno.codigo.replace(/[^A-Za-z0-9-]/g, "")}.png"`,
      "X-Content-Type-Options": "nosniff",
      // Una credencial no se guarda en cachés intermedias.
      "Cache-Control": "private, no-store",
    },
  });
}
