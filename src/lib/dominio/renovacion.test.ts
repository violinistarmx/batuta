import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { situacionRenovacion } from "./renovacion.ts";

describe("situación de renovación", () => {
  test("con más clases que el umbral no hay nada que avisar", () => {
    assert.equal(situacionRenovacion(5, 4), null);
    assert.equal(situacionRenovacion(8, 4), null);
  });

  test("en el umbral exacto se avisa que toca renovar pronto", () => {
    assert.deepEqual(situacionRenovacion(4, 4), { nivel: "pronto", restantes: 4 });
  });

  test("con una o dos clases restantes sigue siendo pronto", () => {
    assert.deepEqual(situacionRenovacion(1, 4), { nivel: "pronto", restantes: 1 });
    assert.deepEqual(situacionRenovacion(2, 4), { nivel: "pronto", restantes: 2 });
  });

  test("sin clases restantes hay que renovar ya", () => {
    assert.deepEqual(situacionRenovacion(0, 4), { nivel: "ahora", restantes: 0 });
  });

  test("un saldo negativo (clases de más) cuenta como agotado, no como restante", () => {
    assert.deepEqual(situacionRenovacion(-1, 4), { nivel: "ahora", restantes: 0 });
  });

  test("con umbral 0 solo avisa cuando ya no quedan clases", () => {
    assert.equal(situacionRenovacion(1, 0), null);
    assert.deepEqual(situacionRenovacion(0, 0), { nivel: "ahora", restantes: 0 });
  });
});
