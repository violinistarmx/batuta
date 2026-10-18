import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  evaluarEntrega, formatearCodigoVale, puedeCancelarCargo, resolverEntrega, type CargoDelVale,
} from "./vales.ts";

const saldado: CargoDelVale = { cancelado: false, montoCentavos: 60_000, aplicadoCentavos: 60_000 };
const sinPago: CargoDelVale = { ...saldado, aplicadoCentavos: 0 };
const parcial: CargoDelVale = { ...saldado, aplicadoCentavos: 20_000 };

describe("código del vale", () => {
  test("lleva año y consecutivo de seis cifras", () => {
    assert.equal(formatearCodigoVale(2026, 123), "VE-2026-000123");
    assert.equal(formatearCodigoVale(2027, 1), "VE-2027-000001");
  });

  test("pasa de seis cifras sin truncar", () => {
    assert.equal(formatearCodigoVale(2026, 1_234_567), "VE-2026-1234567");
  });
});

describe("¿se puede entregar?", () => {
  test("pendiente y saldado: sí", () => {
    assert.deepEqual(evaluarEntrega("pendiente", saldado), { permitida: true });
  });

  test("una condonación que salda el cargo cuenta como pago completo", () => {
    assert.deepEqual(evaluarEntrega("pendiente", { ...saldado, aplicadoCentavos: 60_000 }), { permitida: true });
  });

  test("ya entregado: no, y sin excepción posible", () => {
    const d = evaluarEntrega("entregado", saldado);
    assert.equal(d.permitida, false);
    if (!d.permitida) {
      assert.equal(d.motivo, "ya_entregado");
      assert.equal(d.excepcionPosible, false);
    }
  });

  test("cargo cancelado: no, y sin excepción posible aunque esté pagado", () => {
    const d = evaluarEntrega("pendiente", { ...saldado, cancelado: true });
    assert.equal(d.permitida, false);
    if (!d.permitida) {
      assert.equal(d.motivo, "cargo_cancelado");
      assert.equal(d.excepcionPosible, false);
    }
  });

  test("sin pagar y pago parcial: bloqueados, pero admiten excepción", () => {
    const a = evaluarEntrega("pendiente", sinPago);
    const b = evaluarEntrega("pendiente", parcial);
    assert.equal(a.permitida, false);
    assert.equal(b.permitida, false);
    if (!a.permitida && !b.permitida) {
      assert.equal(a.motivo, "sin_pagar");
      assert.equal(b.motivo, "pago_parcial");
      assert.equal(a.excepcionPosible && b.excepcionPosible, true);
    }
  });

  test("ya entregado gana sobre cualquier otro motivo", () => {
    const d = evaluarEntrega("entregado", { ...sinPago, cancelado: true });
    assert.equal(d.permitida === false && d.motivo, "ya_entregado");
  });
});

describe("resolver la entrega", () => {
  const base = { estado: "pendiente" as const, puedeAutorizarExcepcion: false, motivoExcepcion: null };

  test("saldado: entrega normal, sin excepción", () => {
    assert.deepEqual(resolverEntrega({ ...base, cargo: saldado }), {
      ok: true, conExcepcion: false, motivoExcepcion: null,
    });
  });

  test("sin pagar y sin ser director: se rechaza y lo dice", () => {
    const r = resolverEntrega({ ...base, cargo: sinPago, motivoExcepcion: "es familiar" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, "excepcion_no_autorizada");
  });

  test("el director sin motivo: se rechaza", () => {
    const r = resolverEntrega({ ...base, cargo: parcial, puedeAutorizarExcepcion: true, motivoExcepcion: "  " });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, "excepcion_sin_motivo");
  });

  test("el director con motivo: entrega con excepción y el motivo queda limpio", () => {
    const r = resolverEntrega({
      ...base, cargo: sinPago, puedeAutorizarExcepcion: true, motivoExcepcion: "  Pagará el viernes  ",
    });
    assert.deepEqual(r, { ok: true, conExcepcion: true, motivoExcepcion: "Pagará el viernes" });
  });

  test("el director tampoco puede entregar un cargo cancelado ni dos veces", () => {
    const cancelado = resolverEntrega({
      ...base, cargo: { ...saldado, cancelado: true }, puedeAutorizarExcepcion: true, motivoExcepcion: "por favor",
    });
    const repetido = resolverEntrega({
      ...base, estado: "entregado", cargo: saldado, puedeAutorizarExcepcion: true, motivoExcepcion: "por favor",
    });
    assert.equal(cancelado.ok === false && cancelado.motivo, "cargo_cancelado");
    assert.equal(repetido.ok === false && repetido.motivo, "ya_entregado");
  });

  test("un motivo de excepción sobre un cargo saldado se ignora", () => {
    const r = resolverEntrega({ ...base, cargo: saldado, puedeAutorizarExcepcion: true, motivoExcepcion: "no hace falta" });
    assert.deepEqual(r, { ok: true, conExcepcion: false, motivoExcepcion: null });
  });
});

describe("cancelar un cargo con vale", () => {
  test("sin vale o con vale pendiente: se puede", () => {
    assert.deepEqual(puedeCancelarCargo(null), { permitido: true });
    assert.deepEqual(puedeCancelarCargo("pendiente"), { permitido: true });
  });

  test("con vale entregado: no", () => {
    assert.equal(puedeCancelarCargo("entregado").permitido, false);
  });
});
