import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  diaAnterior, limitesDeMes, mesAnterior, mesesDelAnio, mismoMesAnioAnterior, nombreDeMes,
  ultimosMesesHasta,
} from "./fechas.ts";

describe("fechas de finanzas", () => {
  it("día anterior cruza meses y años", () => {
    assert.equal(diaAnterior("2026-10-01"), "2026-09-30");
    assert.equal(diaAnterior("2026-01-01"), "2025-12-31");
    assert.equal(diaAnterior("2028-03-01"), "2028-02-29");
  });
  it("mes anterior y mismo mes del año pasado", () => {
    assert.equal(mesAnterior("2026-01"), "2025-12");
    assert.equal(mismoMesAnioAnterior("2026-10"), "2025-10");
  });
  it("límites de mes con bisiesto", () => {
    assert.deepEqual(limitesDeMes("2028-02"), ["2028-02-01", "2028-02-29"]);
  });
  it("meses del año y últimos meses", () => {
    assert.equal(mesesDelAnio(2026).length, 12);
    assert.deepEqual(ultimosMesesHasta("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
    assert.equal(nombreDeMes("2026-10"), "Octubre");
  });
});
