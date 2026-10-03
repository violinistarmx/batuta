import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { HASH_SENUELO, evaluarPassword, hashearPassword, verificarPassword } from "./password.ts";

describe("hash de contraseñas", () => {
  test("una contraseña correcta se verifica", async () => {
    const h = await hashearPassword("violin-en-pachuca-2026");
    assert.equal(await verificarPassword(h, "violin-en-pachuca-2026"), true);
  });

  test("una contraseña incorrecta se rechaza", async () => {
    const h = await hashearPassword("violin-en-pachuca-2026");
    assert.equal(await verificarPassword(h, "violin-en-pachuca-2025"), false);
  });

  test("el mismo texto produce hashes distintos (sal aleatoria)", async () => {
    const a = await hashearPassword("la-misma-contraseña");
    const b = await hashearPassword("la-misma-contraseña");
    assert.notEqual(a, b);
  });

  test("usa Argon2id con los parámetros de OWASP", async () => {
    const h = await hashearPassword("cualquiera");
    assert.match(h, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  test("un hash corrupto se rechaza, no revienta", async () => {
    assert.equal(await verificarPassword("esto-no-es-un-hash", "x"), false);
    assert.equal(await verificarPassword("", "x"), false);
  });
});

describe("señuelo contra enumeración de correos", () => {
  test("el señuelo es un hash Argon2id válido con los mismos parámetros", () => {
    // Si fuera un hash inventado, verify() fallaría al parsearlo en microsegundos
    // y el tiempo de respuesta delataría qué correos existen.
    assert.match(HASH_SENUELO, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  test("ninguna contraseña coincide con el señuelo", async () => {
    assert.equal(await verificarPassword(HASH_SENUELO, "password"), false);
    assert.equal(await verificarPassword(HASH_SENUELO, ""), false);
  });

  test("verificar contra el señuelo cuesta lo mismo que contra un hash real", async () => {
    const real = await hashearPassword("una-contraseña-cualquiera");

    const medir = async (h: string) => {
      const t0 = performance.now();
      await verificarPassword(h, "intento-fallido");
      return performance.now() - t0;
    };

    // Las mediciones se INTERCALAN y se toma la mediana. Medir primero un lado y
    // luego el otro deja que un pico de carga de la máquina —otra prueba, una
    // compilación en segundo plano— caiga entero sobre uno de los dos y produzca
    // un fallo que no dice nada sobre el código.
    const reales: number[] = [];
    const senuelos: number[] = [];
    for (let i = 0; i < 7; i++) {
      reales.push(await medir(real));
      senuelos.push(await medir(HASH_SENUELO));
    }

    const mediana = (xs: number[]) => {
      const o = [...xs].sort((a, b) => a - b);
      return o[Math.floor(o.length / 2)] ?? 0;
    };

    const tReal = mediana(reales);
    const tSenuelo = mediana(senuelos);
    const proporcion = Math.max(tReal, tSenuelo) / Math.min(tReal, tSenuelo);

    // Lo que esta prueba existe para atrapar es un señuelo mal formado, que falla
    // al parsearse en microsegundos y da una proporción de CIENTOS. El umbral se
    // fija en 5 para no confundir ruido con filtración: con 3 fallaba de vez en
    // cuando sin que nada estuviera mal.
    assert.ok(
      proporcion < 5,
      `Los tiempos difieren demasiado (${proporcion.toFixed(1)}x): el señuelo filtra qué correos existen.`,
    );

    // Y el señuelo tiene que costar lo que cuesta un Argon2id de verdad: si se
    // resolviera en menos de un milisegundo, es que no se está hasheando nada.
    assert.ok(
      tSenuelo > 1,
      `El señuelo se resolvió en ${tSenuelo.toFixed(2)} ms: no está haciendo el trabajo de un hash real.`,
    );
  });
});

describe("requisitos de contraseña", () => {
  test("acepta una contraseña larga y memorable", () => {
    assert.equal(evaluarPassword("violin1-pachuca-hidalgo").valida, true);
  });

  test("rechaza las cortas aunque tengan símbolos", () => {
    const r = evaluarPassword("P@ss1!");
    assert.equal(r.valida, false);
    assert.match(r.problemas.join(" "), /12 caracteres/);
  });

  test("exige al menos un número", () => {
    assert.equal(evaluarPassword("solamenteletrasaqui").valida, false);
  });

  test("pone tope superior para no abusar del hasheo", () => {
    assert.equal(evaluarPassword("a1".repeat(80)).valida, false);
  });
});
