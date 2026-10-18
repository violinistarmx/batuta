import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

/**
 * QR de la credencial del alumno.
 *
 * El código contiene únicamente un token opaco. Nada de nombre, teléfono,
 * dirección ni información académica: una credencial fotografiada o perdida no
 * revela nada por sí sola, y resolver el token exige sesión activa con permiso.
 *
 * El token tampoco es el id del alumno ni nada secuencial — si lo fuera, quien
 * viera un QR podría construir los de los demás alumnos sumando uno.
 */

/** 128 bits de aleatoriedad. Adivinarlo por fuerza bruta no es viable. */
export function generarTokenQr(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * SVG en línea, no PNG.
 *
 * Se imprime nítido a cualquier tamaño —la credencial se imprime en físico— y no
 * requiere escribir un archivo ni servirlo desde una ruta.
 */
export async function qrComoSvg(token: string, baseUrl: string): Promise<string> {
  return QRCode.toString(`${baseUrl}/qr/${token}`, {
    type: "svg",
    // Nivel Q: tolera hasta ~25 % de daño. Una credencial va en la mochila de un
    // niño durante meses; M no alcanza.
    errorCorrectionLevel: "Q",
    margin: 1,
    width: 220,
    color: { dark: "#221A0E", light: "#FFFFFF" },
  });
}

/**
 * QR del vale de entrega: la ruta del vale con su token opaco (no el código legible,
 * que es secuencial y se podría adivinar). Escanearlo no cambia nada: la ruta exige
 * sesión y la entrega es un botón aparte.
 */
export async function qrDeVale(token: string, baseUrl: string, ancho = 160): Promise<string> {
  return QRCode.toString(`${baseUrl}/vales/${token}`, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 1,
    width: ancho,
    color: { dark: "#221A0E", light: "#FFFFFF" },
  });
}

/**
 * Origen público del sistema. `URL_PUBLICA` manda sobre el host de la petición, igual que
 * en la credencial: con el host de quien mira, el QR apuntaría a una dirección interna.
 */
export function urlBase(cabeceras: Headers): string {
  if (process.env.URL_PUBLICA) return process.env.URL_PUBLICA;
  const host = cabeceras.get("host") ?? "localhost:3000";
  const protocolo = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocolo}://${host}`;
}
