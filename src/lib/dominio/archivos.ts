/**
 * Reglas sobre archivos del expediente. Funciones puras, sin sistema de archivos.
 *
 * Están separadas de `lib/almacen.ts` porque son justo las que hay que probar:
 * qué tipos se aceptan, que una ruta no pueda escapar del almacén, y que un
 * nombre de archivo no pueda inyectar cabeceras. El módulo que toca el disco solo
 * las aplica.
 */

import { resolve } from "node:path";

export const TIPOS_PERMITIDOS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type TipoPermitido = keyof typeof TIPOS_PERMITIDOS;

/** 10 MB. Una planeación escaneada cabe de sobra; un video no debe entrar aquí. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export type ResultadoValidacion =
  | { ok: true; tipo: TipoPermitido }
  | { ok: false; razon: string };

export function validarArchivo(tipoMime: string, bytes: number): ResultadoValidacion {
  if (!(tipoMime in TIPOS_PERMITIDOS)) {
    return { ok: false, razon: "Solo se aceptan archivos PDF, JPG o PNG." };
  }
  if (bytes === 0) return { ok: false, razon: "El archivo está vacío." };
  if (bytes > TAMANO_MAXIMO) {
    return {
      ok: false,
      razon: `El archivo pesa ${(bytes / 1024 / 1024).toFixed(1)} MB y el máximo son ${TAMANO_MAXIMO / 1024 / 1024} MB.`,
    };
  }
  return { ok: true, tipo: tipoMime as TipoPermitido };
}

/**
 * Ruta de almacenamiento a partir de un identificador propio.
 *
 * Se reparte en subcarpetas por los dos primeros caracteres para no terminar con
 * decenas de miles de archivos en un solo directorio.
 */
export function rutaRelativa(id: string, extension: string): string {
  return `${id.slice(0, 2)}/${id}.${extension}`;
}

/**
 * Resuelve una ruta dentro del almacén y verifica que no se salga de él.
 *
 * Sin esta comprobación, un valor manipulado en la base leería cualquier archivo
 * del servidor.
 */
export function rutaContenida(raiz: string, relativa: string): string {
  const raizAbs = resolve(raiz);
  const completa = resolve(raizAbs, relativa);
  if (completa !== raizAbs && !completa.startsWith(raizAbs + "/")) {
    throw new Error("Ruta fuera del almacén.");
  }
  return completa;
}

/**
 * Nombre con el que se descarga.
 *
 * El nombre original viene del cliente y se usa solo aquí, saneado: comillas y
 * saltos de línea dentro de `Content-Disposition` permiten inyectar cabeceras.
 */
export function nombreDeDescarga(original: string, extension: string): string {
  const limpio = original
    .replace(/[\r\n"\\]/g, "")
    .replace(/[/\\]/g, "-")
    .trim()
    .slice(0, 120);
  if (!limpio) return `documento.${extension}`;
  return limpio.toLowerCase().endsWith(`.${extension}`) ? limpio : `${limpio}.${extension}`;
}
