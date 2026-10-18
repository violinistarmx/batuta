import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { destinoSeguro } from "./destino.ts";

describe("destino tras iniciar sesión", () => {
  test("acepta la ruta de un vale con su token", () => {
    assert.equal(destinoSeguro("/vales/AbCdEfGhIjKlMnOp_-123"), "/vales/AbCdEfGhIjKlMnOp_-123");
  });

  test("rechaza otros sitios, rutas absolutas y esquemas", () => {
    for (const malo of [
      "https://malo.example/vales/AbCdEfGhIjKlMnOp_-123",
      "//malo.example/vales/AbCdEfGhIjKlMnOp_-123",
      "/finanzas", "/", "/vales/", "/vales/corto", "javascript:alert(1)",
      "/vales/AbCdEfGhIjKlMnOp_-123/../../finanzas", "/vales/AbCdEfGhIjKlMnOp_-123?x=1",
    ]) assert.equal(destinoSeguro(malo), null, malo);
  });

  test("rechaza lo que no es texto", () => {
    assert.equal(destinoSeguro(undefined), null);
    assert.equal(destinoSeguro(null), null);
    assert.equal(destinoSeguro(42), null);
  });
});
