import { randomBytes } from "node:crypto";
import { hash, verify, type Algorithm } from "@node-rs/argon2";

/** Algorithm.Argon2id. Se escribe el literal porque el enum de la librería es
 *  `const enum` y no sobrevive a `isolatedModules`. */
const ARGON2ID = 2 as Algorithm;

/**
 * Argon2id con los parámetros recomendados por OWASP (2024): 19 MiB de memoria,
 * 2 iteraciones, paralelismo 1. El costo en memoria es lo que hace cara la fuerza
 * bruta con GPU; bajarlo para "que el login sea más rápido" anula el propósito.
 */
const OPCIONES = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash con el que comparar cuando el correo no existe.
 *
 * Sin esto, un login con correo inexistente responde en microsegundos y uno con
 * correo real tarda ~50 ms: la diferencia permite averiguar qué correos están
 * dados de alta. Se gasta el mismo trabajo en ambos casos.
 *
 * Tiene que ser un hash REAL y con estos mismos parámetros. Uno inventado falla al
 * parsearse en microsegundos, que es exactamente la fuga que se quería tapar. La
 * contraseña que lo generó fue aleatoria y se descartó.
 */
export const HASH_SENUELO =
  "$argon2id$v=19$m=19456,t=2,p=1$IoxPPu42yUfYn7yHx/HeCQ$Vd4CcFE++ilAGFa+hgtwIr+4zXrMf6QTpLV3a/z7I3w";

export async function hashearPassword(password: string): Promise<string> {
  return hash(password, OPCIONES);
}

export async function verificarPassword(hashGuardado: string, password: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, password, OPCIONES);
  } catch {
    // Hash corrupto o con formato desconocido: se trata como credencial inválida,
    // nunca como acceso concedido.
    return false;
  }
}

export type FuerzaPassword = { valida: boolean; problemas: string[] };

/**
 * Requisitos mínimos. Se prefiere longitud sobre símbolos obligatorios: una
 * contraseña larga y memorable protege más que "P@ss1!" y se olvida menos.
 */
export function evaluarPassword(password: string): FuerzaPassword {
  const problemas: string[] = [];
  if (password.length < 12) problemas.push("Debe tener al menos 12 caracteres.");
  if (password.length > 128) problemas.push("No puede exceder 128 caracteres.");
  if (!/[a-záéíóúñ]/i.test(password)) problemas.push("Debe incluir alguna letra.");
  if (!/[0-9]/.test(password)) problemas.push("Debe incluir algún número.");
  return { valida: problemas.length === 0, problemas };
}

/**
 * Contraseña legible para un primer acceso: cuatro bloques de cuatro caracteres,
 * sin vocales —para no formar palabras por accidente— ni caracteres que se
 * confundan al dictarla (0/O, 1/l/I).
 *
 * Vive aquí y no en el script del CLI porque la usan los dos: el alta por terminal
 * y el alta por pantalla. Dos copias del mismo alfabeto se separan a la primera.
 */
export function generarPasswordInicial(): string {
  const alfabeto = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
