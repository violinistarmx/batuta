import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  fechaCivil, finDelDiaEnMexico, horaCivil, hoyEnMexico, inicioDelDiaEnMexico,
  instanteEnMexico,
} from "./zona.ts";

describe("hora local de la academia", () => {
  test("las 16:00 en Pachuca son las 22:00 UTC", () => {
    // México es UTC−6 fijo desde que se eliminó el horario de verano en 2022.
    assert.equal(instanteEnMexico("2026-09-21", "16:00").toISOString(), "2026-09-21T22:00:00.000Z");
  });

  test("en enero también, porque ya no hay horario de verano", () => {
    assert.equal(instanteEnMexico("2026-01-15", "16:00").toISOString(), "2026-01-15T22:00:00.000Z");
  });

  test("una clase a las 19:00 no se cruza de día", () => {
    assert.equal(instanteEnMexico("2026-09-21", "19:00").toISOString(), "2026-09-22T01:00:00.000Z");
  });

  test("la conversión es reversible", () => {
    for (const [f, h] of [
      ["2026-09-21", "16:00"], ["2026-01-01", "09:00"],
      ["2026-06-30", "20:30"], ["2026-12-31", "07:15"],
    ] as const) {
      const i = instanteEnMexico(f, h);
      assert.equal(fechaCivil(i), f, `fecha de ${f} ${h}`);
      assert.equal(horaCivil(i), h, `hora de ${f} ${h}`);
    }
  });

  test("medianoche se mantiene en su día", () => {
    const i = instanteEnMexico("2026-09-21", "00:00");
    assert.equal(fechaCivil(i), "2026-09-21");
    assert.equal(horaCivil(i), "00:00");
  });

  test("rechaza formatos inválidos en vez de inventar una fecha", () => {
    assert.throws(() => instanteEnMexico("21/09/2026", "16:00"));
    assert.throws(() => instanteEnMexico("2026-09-21", "4pm"));
  });
});

describe("fecha de hoy", () => {
  test("a las 23:00 UTC ya es el mismo día en México, no el siguiente", () => {
    // 23:00 UTC = 17:00 en Pachuca del mismo día. Usar el reloj del servidor
    // adelantaría el día y las clases de la tarde aparecerían en la agenda
    // equivocada.
    assert.equal(hoyEnMexico(new Date("2026-09-21T23:00:00Z")), "2026-09-21");
  });

  test("a las 03:00 UTC todavía es el día anterior en México", () => {
    assert.equal(hoyEnMexico(new Date("2026-09-22T03:00:00Z")), "2026-09-21");
  });

  test("a las 06:00 UTC ya cambió el día", () => {
    assert.equal(hoyEnMexico(new Date("2026-09-22T06:00:00Z")), "2026-09-22");
  });
});

describe("los bordes de un día civil mexicano", () => {
  test("el día empieza a las 06:00 UTC, no a medianoche UTC", () => {
    assert.equal(inicioDelDiaEnMexico("2026-09-01").toISOString(), "2026-09-01T06:00:00.000Z");
  });

  test("y termina justo antes del comienzo del siguiente", () => {
    const fin = finDelDiaEnMexico("2026-09-01");
    assert.equal(fin.toISOString(), "2026-09-02T05:59:59.999Z");
    assert.equal(fin.getTime() + 1, inicioDelDiaEnMexico("2026-09-02").getTime());
  });

  test("un movimiento de la madrugada cae dentro de su propio día", () => {
    // 01:30 del 1 de septiembre en Pachuca es 07:30Z del mismo día.
    const madrugada = instanteEnMexico("2026-09-01", "01:30");
    assert.ok(madrugada >= inicioDelDiaEnMexico("2026-09-01"));
    assert.ok(madrugada <= finDelDiaEnMexico("2026-09-01"));
    assert.ok(madrugada > finDelDiaEnMexico("2026-08-31"));
  });
});
