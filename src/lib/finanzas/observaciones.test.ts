import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { observaciones, type Corte } from "./observaciones.ts";

const METAS = {
  costoDocenteMax: 0.45, margenNetoMin: 0.2, margenBrutoMin: 0.45, cobranzaMin: 0.9,
  retencionMin: 0.9, cacMaxCentavos: 50_000, tolerancia: 0.1,
};

const base: Corte = {
  etiqueta: "septiembre", ingresos: 10_000_000, costoDocentePct: 0.39, margenNeto: 0.25,
  cobranza: 0.95, retencion: 0.95, cac: 30_000, alumnosActivos: 40, alumnosMinimos: 30,
};

describe("observaciones", () => {
  it("costo docente subió 6 pts vs el mes anterior", () => {
    const o = observaciones({ ...base, etiqueta: "octubre", costoDocentePct: 0.45 }, base, METAS);
    assert.ok(o.some((x) => x.startsWith("El costo docente subió 6 pts vs septiembre")), o.join("\n"));
  });
  it("avisa metas incumplidas y distancia al equilibrio", () => {
    const o = observaciones({ ...base, margenNeto: 0.1, cobranza: 0.7, alumnosActivos: 25 }, null, METAS);
    assert.ok(o.some((x) => x.includes("por debajo de la meta de 20 %")));
    assert.ok(o.some((x) => x.includes("Se cobró el 70 %")));
    assert.ok(o.some((x) => x.startsWith("Faltan 5 alumnos")));
  });
  it("señala programas con margen negativo", () => {
    const o = observaciones(base, null, METAS, [
      { nombre: "Allegro Virtuoso", margen: 500_000, margenPct: 0.4 },
      { nombre: "Clase única", margen: -10_000, margenPct: -0.2 },
    ]);
    assert.ok(o.some((x) => x.startsWith("Allegro Virtuoso es el programa que más aporta")));
    assert.ok(o.some((x) => x.startsWith("Clase única tiene margen negativo")));
  });
  it("sin movimientos no inventa nada", () => {
    const o = observaciones({ ...base, ingresos: 0, alumnosActivos: 0 }, null, METAS);
    assert.equal(o.length, 1);
  });
});
