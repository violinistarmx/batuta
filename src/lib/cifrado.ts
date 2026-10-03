import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de datos personales sensibles (LFPDPPP art. 3 fr. VI).
 *
 * AES-256-GCM, que además de cifrar autentica: si alguien altera un byte del
 * texto cifrado directamente en la base, el descifrado falla en vez de devolver
 * basura silenciosamente.
 *
 * Cada valor lleva su propio IV aleatorio. Reutilizar el IV en GCM es catastrófico
 * —permite recuperar el texto plano comparando dos cifrados— así que se genera uno
 * nuevo en cada llamada y se guarda junto al resultado.
 *
 * Formato almacenado:  v1.<iv>.<tag>.<cifrado>   (las tres partes en base64url)
 * El prefijo de versión permite rotar el algoritmo después sin adivinar qué es qué.
 */

const VERSION = "v1";
const LARGO_IV = 12;   // 96 bits, el recomendado para GCM
const LARGO_TAG = 16;

let llaveCache: Buffer | null = null;

function llave(): Buffer {
  if (llaveCache) return llaveCache;

  const hex = process.env.LLAVE_DATOS_SENSIBLES;
  if (!hex) {
    throw new Error(
      "Falta LLAVE_DATOS_SENSIBLES. Genérala con: openssl rand -hex 32\n" +
      "Sin ella no se pueden leer ni escribir datos de salud.",
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(
      `LLAVE_DATOS_SENSIBLES debe ser de 32 bytes en hexadecimal (64 caracteres); ` +
      `llegó de ${buf.length} bytes.`,
    );
  }
  llaveCache = buf;
  return buf;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(LARGO_IV);
  const cipher = createCipheriv("aes-256-gcm", llave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), cifrado.toString("base64url")].join(".");
}

export function descifrar(guardado: string): string {
  const partes = guardado.split(".");
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error("El valor cifrado tiene un formato desconocido.");
  }
  const [, ivB64, tagB64, cifradoB64] = partes as [string, string, string, string];

  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== LARGO_IV || tag.length !== LARGO_TAG) {
    throw new Error("El valor cifrado está corrupto.");
  }

  const decipher = createDecipheriv("aes-256-gcm", llave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(cifradoB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Cifra solo si hay contenido: un campo vacío se guarda como NULL, no como ruido cifrado. */
export function cifrarOpcional(texto: string | null | undefined): string | null {
  const limpio = texto?.trim();
  return limpio ? cifrar(limpio) : null;
}

/**
 * Descifra tolerando fallos.
 *
 * Si la llave cambió o el dato se corrompió, el expediente debe seguir abriéndose
 * con el resto de la información en vez de quedar inaccesible por completo. El
 * problema se hace visible en pantalla, no se esconde.
 */
export function descifrarOpcional(guardado: string | null | undefined): string | null {
  if (!guardado) return null;
  try {
    return descifrar(guardado);
  } catch {
    return "⚠ No se pudo descifrar (¿cambió la llave?)";
  }
}
