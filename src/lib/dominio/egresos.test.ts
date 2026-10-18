import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { conceptoEgresoNomina } from "./egresos.ts";

describe("conceptoEgresoNomina", () => {
  it("lista los números de clase del corte dentro del programa", () => {
    assert.equal(
      conceptoEgresoNomina("Rosalba Morales", "Violín inicial", [1, 2, 3]),
      "Pago a Rosalba Morales por clase número 1, 2, 3 de Violín inicial",
    );
  });

  it("funciona con una sola clase", () => {
    assert.equal(
      conceptoEgresoNomina("Sara Hernández", "Dibujo", [4]),
      "Pago a Sara Hernández por clase número 4 de Dibujo",
    );
  });
});
