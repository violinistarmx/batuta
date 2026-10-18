import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { porcentajesValidos, repartoProfitFirst } from "./profit-first.ts";

const P = { ganancia: 0.05, sueldo: 0.5, impuestos: 0.15, operacion: 0.3 };

describe("Profit First", () => {
  it("los porcentajes deben sumar 100 %", () => {
    assert.equal(porcentajesValidos(P), true);
    assert.equal(porcentajesValidos({ ...P, ganancia: 0.1 }), false);
  });
  it("objetivo = ingreso × porcentaje; real reparte lo que queda tras gastar", () => {
    const c = repartoProfitFirst(1_000_000, 300_000, P);
    const op = c.find((x) => x.clave === "operacion")!;
    const ganancia = c.find((x) => x.clave === "ganancia")!;
    assert.equal(op.objetivo, 300_000);
    assert.equal(op.real, 300_000);
    assert.equal(ganancia.objetivo, 50_000);
    assert.equal(ganancia.real, 50_000);
  });
  it("si los gastos se comen el ingreso, las demás cuentas quedan en cero", () => {
    const c = repartoProfitFirst(100_000, 150_000, P);
    assert.equal(c.find((x) => x.clave === "ganancia")!.real, 0);
  });
});
