import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TEMAS, fondoDeTema, temaValido } from "./tema.ts";

describe("tema visual", () => {
  test("acepta los dos temas", () => {
    assert.equal(temaValido("claro"), "claro");
    assert.equal(temaValido("cristal"), "cristal");
  });

  test("cualquier otro valor cae en «claro», incluida una cookie manipulada", () => {
    for (const v of [undefined, null, "", "oscuro", "CRISTAL", 1, "cristal; path=/"]) {
      assert.equal(temaValido(v), "claro", String(v));
    }
  });

  test("cada tema tiene su fondo y no se repiten", () => {
    assert.equal(fondoDeTema("claro"), "escena");
    assert.equal(fondoDeTema("cristal"), "cristal");
    assert.equal(new Set(TEMAS.map((t) => t.fondo)).size, TEMAS.length);
  });
});
