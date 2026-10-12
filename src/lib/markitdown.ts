import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";

import { compactarMarkdown, limitarMarkdown, MAX_CARACTERES } from "./dominio/conversion.ts";

/**
 * Convierte un documento del expediente a Markdown con markitdown (Microsoft, MIT).
 *
 * Todo ocurre en el servidor: markitdown corre como proceso hijo y no llama a ningún
 * servicio externo. Por eso no depende de `IA_HABILITADA`: el texto nunca sale de la
 * máquina. Lo que sí saldría es una descripción de imágenes con un modelo, y esa
 * opción queda apagada a propósito: mandaría fotos de alumnos a un tercero.
 *
 * El beneficio es de tokens: un PDF de 4 páginas de texto suele pesar menos como
 * Markdown que como documento binario enviado a un modelo, y el texto se puede
 * acotar con `maxCaracteres`.
 *
 * Nunca lanza. Un fallo devuelve `{ ok: false, razon }` para que el llamador decida si
 * envía el archivo original.
 */

export type ResultadoMarkdown =
  | { ok: true; markdown: string; truncado: boolean; caracteres: number }
  | { ok: false; razon: string };

export type OpcionesMarkdown = {
  /** Ejecutable de markitdown. Por omisión, `MARKITDOWN_BIN` o `markitdown` del PATH. */
  bin?: string;
  /** Tiempo máximo de conversión. Un PDF escaneado mal formado no debe colgar al servidor. */
  timeoutMs?: number;
  /** Tope de caracteres del resultado. */
  maxCaracteres?: number;
};

const TIMEOUT_DEFECTO_MS = 60_000;
/** Salida máxima que se acepta de markitdown: 32 MB de texto son muchos más que un expediente. */
const SALIDA_MAXIMA = 32 * 1024 * 1024;

export function convertirAMarkdown(
  rutaAbsoluta: string,
  opciones: OpcionesMarkdown = {},
): Promise<ResultadoMarkdown> {
  const bin = opciones.bin ?? process.env.MARKITDOWN_BIN ?? "markitdown";

  // Una ruta relativa podría resolverse fuera del almacén según el directorio de trabajo.
  if (!isAbsolute(rutaAbsoluta)) {
    return Promise.resolve({ ok: false, razon: "La ruta del documento debe ser absoluta." });
  }

  return new Promise((resolver) => {
    execFile(
      bin,
      [rutaAbsoluta],
      {
        encoding: "utf8",
        timeout: opciones.timeoutMs ?? TIMEOUT_DEFECTO_MS,
        maxBuffer: SALIDA_MAXIMA,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          // stderr no se registra: un traceback de Python puede citar fragmentos del documento.
          if (error.code === "ENOENT") {
            resolver({ ok: false, razon: `No se encontró markitdown (${bin}). Define MARKITDOWN_BIN o instálalo.` });
          } else if (error.killed) {
            resolver({ ok: false, razon: "La conversión tardó demasiado y se canceló." });
          } else {
            console.error(`[markitdown] la conversión falló (código ${error.code ?? "desconocido"})`);
            resolver({ ok: false, razon: "No se pudo convertir el documento." });
          }
          return;
        }

        const compacto = compactarMarkdown(stdout);
        if (!compacto) {
          // Típico de una foto o un escaneo: markitdown no hace OCR. Conviene enviar el original.
          resolver({ ok: false, razon: "El documento no tiene texto extraíble (imagen o escaneo sin OCR)." });
          return;
        }

        const limitado = limitarMarkdown(compacto, opciones.maxCaracteres ?? MAX_CARACTERES);
        resolver({
          ok: true,
          markdown: limitado.texto,
          truncado: limitado.truncado,
          caracteres: compacto.length,
        });
      },
    );
  });
}
