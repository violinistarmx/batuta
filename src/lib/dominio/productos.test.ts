import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { costoReconocido, margenDe } from "./productos.ts";

describe("margen de un producto", () => {
  test("vende en 600 y cuesta 399: margen de 201, 33.5 % del precio", () => {
    const m = margenDe(60_000, 39_900);
    assert.equal(m.margenCentavos, 20_100);
    assert.equal(Math.round((m.margenPct ?? 0) * 1000) / 10, 33.5);
  });

  test("un costo mayor al precio da margen negativo, no error", () => {
    assert.equal(margenDe(10_000, 12_000).margenCentavos, -2_000);
  });

  test("sin precio no hay porcentaje", () => {
    assert.equal(margenDe(0, 0).margenPct, null);
  });
});

describe("costo reconocido por lo cobrado", () => {
  test("cobro completo: todo el costo", () => {
    assert.equal(costoReconocido(39_900, 60_000, 60_000), 39_900);
  });

  test("la mitad cobrada: la mitad del costo", () => {
    assert.equal(costoReconocido(40_000, 60_000, 30_000), 20_000);
  });

  test("sin cobro o sin costo: cero", () => {
    assert.equal(costoReconocido(39_900, 60_000, 0), 0);
    assert.equal(costoReconocido(0, 60_000, 60_000), 0);
  });

  test("una condonación salda el cargo: el costo se reconoce completo y el margen baja", () => {
    // Venta de 600 con 100 condonados: entran 500, el cargo se salda (aplicado = 600).
    assert.equal(costoReconocido(39_900, 60_000, 60_000), 39_900);
    assert.equal(50_000 - costoReconocido(39_900, 60_000, 60_000), 10_100);
  });

  test("lo cobrado de más no reconoce más costo que el que hay", () => {
    assert.equal(costoReconocido(39_900, 60_000, 90_000), 39_900);
  });
});
