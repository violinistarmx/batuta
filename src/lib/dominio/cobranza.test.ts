import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  adeudoDe, estadoDeCargo, formatearFolio, planearAplicacion, resumirCobranza, type Cargo,
} from "./cobranza.ts";

const cargo = (id: number, monto: number, aplicado: number, venceEl: string): Cargo =>
  ({ id, montoCentavos: monto, aplicadoCentavos: aplicado, venceEl });

describe("adeudo de un cargo", () => {
  test("sin pagos, se debe todo", () => {
    assert.equal(adeudoDe({ montoCentavos: 75_000, aplicadoCentavos: 0 }), 75_000);
  });

  test("el ejemplo del brief: $750 con $500 recibidos deja $250", () => {
    assert.equal(adeudoDe({ montoCentavos: 75_000, aplicadoCentavos: 50_000 }), 25_000);
  });

  test("un sobrepago no produce adeudo negativo", () => {
    assert.equal(adeudoDe({ montoCentavos: 75_000, aplicadoCentavos: 80_000 }), 0);
  });

  test("estados", () => {
    assert.equal(estadoDeCargo({ montoCentavos: 75_000, aplicadoCentavos: 0 }), "abierto");
    assert.equal(estadoDeCargo({ montoCentavos: 75_000, aplicadoCentavos: 50_000 }), "parcial");
    assert.equal(estadoDeCargo({ montoCentavos: 75_000, aplicadoCentavos: 75_000 }), "saldado");
  });
});

describe("aplicación de pagos", () => {
  test("un pago exacto salda el cargo", () => {
    const p = planearAplicacion(75_000, [cargo(1, 75_000, 0, "2026-09-18")]);
    assert.deepEqual(p.asignaciones, [{ cargoId: 1, montoCentavos: 75_000 }]);
    assert.equal(p.aFavorCentavos, 0);
  });

  test("un pago a cuenta aplica lo que hay", () => {
    const p = planearAplicacion(50_000, [cargo(1, 75_000, 0, "2026-09-18")]);
    assert.deepEqual(p.asignaciones, [{ cargoId: 1, montoCentavos: 50_000 }]);
  });

  test("salda primero el cargo más viejo", () => {
    // Si el alumno debe septiembre y octubre y abona una mensualidad, se salda
    // septiembre. Al revés, el cargo viejo quedaría vencido para siempre.
    const p = planearAplicacion(75_000, [
      cargo(2, 75_000, 0, "2026-10-18"),
      cargo(1, 75_000, 0, "2026-09-18"),
    ]);
    assert.deepEqual(p.asignaciones, [{ cargoId: 1, montoCentavos: 75_000 }]);
  });

  test("un pago grande se reparte entre varios cargos", () => {
    const p = planearAplicacion(120_000, [
      cargo(1, 75_000, 0, "2026-09-18"),
      cargo(2, 75_000, 0, "2026-10-18"),
    ]);
    assert.deepEqual(p.asignaciones, [
      { cargoId: 1, montoCentavos: 75_000 },
      { cargoId: 2, montoCentavos: 45_000 },
    ]);
    assert.equal(p.aFavorCentavos, 0);
  });

  test("lo que sobra queda a favor del alumno", () => {
    const p = planearAplicacion(100_000, [cargo(1, 75_000, 0, "2026-09-18")]);
    assert.equal(p.aFavorCentavos, 25_000);
  });

  test("ignora cargos ya saldados", () => {
    const p = planearAplicacion(50_000, [
      cargo(1, 75_000, 75_000, "2026-09-18"),
      cargo(2, 75_000, 0, "2026-10-18"),
    ]);
    assert.deepEqual(p.asignaciones, [{ cargoId: 2, montoCentavos: 50_000 }]);
  });

  test("respeta lo ya aplicado a un cargo parcial", () => {
    const p = planearAplicacion(50_000, [cargo(1, 75_000, 50_000, "2026-09-18")]);
    assert.deepEqual(p.asignaciones, [{ cargoId: 1, montoCentavos: 25_000 }]);
    assert.equal(p.aFavorCentavos, 25_000);
  });

  test("sin cargos abiertos, todo queda a favor", () => {
    const p = planearAplicacion(75_000, []);
    assert.deepEqual(p.asignaciones, []);
    assert.equal(p.aFavorCentavos, 75_000);
  });

  test("un monto de cero no genera asignaciones", () => {
    assert.deepEqual(planearAplicacion(0, [cargo(1, 75_000, 0, "2026-09-18")]).asignaciones, []);
  });

  test("lo aplicado nunca excede lo recibido", () => {
    const cargos = [cargo(1, 75_000, 0, "2026-09-18"), cargo(2, 150_000, 0, "2026-10-18")];
    for (const monto of [1, 50_000, 75_000, 100_000, 225_000, 300_000]) {
      const p = planearAplicacion(monto, cargos);
      const suma = p.asignaciones.reduce((s, a) => s + a.montoCentavos, 0);
      assert.equal(suma + p.aFavorCentavos, monto, `con ${monto}`);
      assert.ok(suma <= monto, `con ${monto}`);
    }
  });

  test("con la misma fecha de vencimiento, gana el cargo más antiguo por id", () => {
    const p = planearAplicacion(75_000, [
      cargo(5, 75_000, 0, "2026-09-18"),
      cargo(3, 75_000, 0, "2026-09-18"),
    ]);
    assert.equal(p.asignaciones[0]?.cargoId, 3);
  });
});

describe("folio de recibo", () => {
  test("formato VS-2026-0001", () => {
    assert.equal(formatearFolio("VS", 2026, 1), "VS-2026-0001");
  });

  test("rellena a cuatro dígitos y crece más allá", () => {
    assert.equal(formatearFolio("VS", 2026, 42), "VS-2026-0042");
    assert.equal(formatearFolio("VS", 2026, 12345), "VS-2026-12345");
  });
});

describe("resumen de cobranza", () => {
  const hoy = "2026-09-18";

  test("separa lo vencido de lo por cobrar", () => {
    const r = resumirCobranza([
      { montoCentavos: 75_000, aplicadoCentavos: 0, venceEl: "2026-08-18" },   // vencido
      { montoCentavos: 75_000, aplicadoCentavos: 0, venceEl: "2026-10-18" },   // por vencer
      { montoCentavos: 75_000, aplicadoCentavos: 75_000, venceEl: "2026-07-18" }, // saldado
    ], hoy);

    assert.equal(r.porCobrarCentavos, 150_000);
    assert.equal(r.vencidoCentavos, 75_000);
    assert.equal(r.cobradoCentavos, 75_000);
  });

  test("un cargo que vence hoy todavía no está vencido", () => {
    const r = resumirCobranza([{ montoCentavos: 75_000, aplicadoCentavos: 0, venceEl: hoy }], hoy);
    assert.equal(r.vencidoCentavos, 0);
    assert.equal(r.porCobrarCentavos, 75_000);
  });

  test("sin cargos, todo en cero", () => {
    assert.deepEqual(resumirCobranza([], hoy), {
      porCobrarCentavos: 0, vencidoCentavos: 0, cobradoCentavos: 0,
    });
  });
});
