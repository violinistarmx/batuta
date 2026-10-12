import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { rutaContenida, rutaRelativa, type TipoPermitido, TIPOS_PERMITIDOS } from "./dominio/archivos";

/**
 * Almacén de archivos del expediente: contratos, recibos, planeaciones.
 *
 * Vive FUERA de `public/`. Nada aquí se sirve como ruta estática: toda descarga
 * pasa por un endpoint que verifica permiso antes de abrir el archivo. Un PDF con
 * la planeación de un menor no puede quedar accesible por adivinar una URL.
 *
 * El nombre en disco lo genera el sistema, nunca el cliente. Un archivo llamado
 * `../../.env` escribiría fuera del almacén; aquí el nombre original solo se
 * guarda como metadato para mostrarlo.
 */

const RAIZ = resolve(process.env.ALMACEN_DIR ?? "./almacen");

export type ArchivoGuardado = {
  ruta: string;
  hash: string;
  bytes: number;
  extension: string;
};

export async function guardar(contenido: Buffer, tipo: TipoPermitido): Promise<ArchivoGuardado> {
  const id = randomUUID();
  const extension = TIPOS_PERMITIDOS[tipo];
  const relativa = rutaRelativa(id, extension);
  const absoluta = rutaContenida(RAIZ, relativa);

  await mkdir(dirname(absoluta), { recursive: true });
  await writeFile(absoluta, contenido);

  return {
    ruta: relativa,
    // El hash permite detectar corrupción y verificar que un respaldo restauró
    // el archivo íntegro.
    hash: createHash("sha256").update(contenido).digest("hex"),
    bytes: contenido.byteLength,
    extension,
  };
}

/**
 * Ruta absoluta de un archivo del almacén, verificada contra salirse de él.
 *
 * Para herramientas que leen el archivo por ruta, como markitdown. No devuelve
 * contenido: quien la use debe respetar los mismos permisos que la descarga.
 */
export function rutaAbsoluta(relativa: string): string {
  return rutaContenida(RAIZ, relativa);
}

export async function leer(relativa: string): Promise<Buffer> {
  return readFile(rutaContenida(RAIZ, relativa));
}

export async function borrar(relativa: string): Promise<void> {
  await unlink(rutaContenida(RAIZ, relativa)).catch(() => {
    // Si el archivo ya no está, el objetivo se cumplió igual.
  });
}
