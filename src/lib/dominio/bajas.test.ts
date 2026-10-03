import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ajusteProporcional, estaPagada, fechaEfectiva, minimoPorAviso,
  motivoParaNoDarDeBaja, planDeBaja, type Situacion,
} from "./bajas.ts";

/** Un alumno de Allegro Andante: cuatro clases de $750 al mes. */
const base: Situacion = {
  fechaAviso: "2026-09-10",
  horasAviso: 72,
  terminaElPeriodo: "2026-09-30",
  mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 0 },
  clasesContratadas: 4,
  clasesConsumidas: 2,
  estadoInscripcion: "activa",
  prestamosAbiertos: 0,
  cubiertasActivas: 0,
};

const con = (cambios: Partial<Situacion>): Situacion => ({ ...base, ...cambios });

describe("baja · el aviso de 72 horas", () => {
  it("setenta y dos horas son tres días desde el aviso", () => {
    assert.equal(minimoPorAviso("2026-09-10", 72), "2026-09-13");
  });

  it("se cuenta desde que avisó el tutor, no desde que se capturó", () => {
    // Si recepción lo teclea tres días después, el plazo ya corrió: el tutor
    // puede enseñar su mensaje con fecha, y eso es lo que vale.
    assert.equal(minimoPorAviso("2026-09-01", 72), "2026-09-04");
  });

  it("cruza el fin de mes sin inventar días", () => {
    assert.equal(minimoPorAviso("2026-09-29", 72), "2026-10-02");
  });

  it("si mañana el contrato dice otra cosa, el plazo sale de la configuración", () => {
    assert.equal(minimoPorAviso("2026-09-10", 24), "2026-09-11");
    assert.equal(minimoPorAviso("2026-09-10", 168), "2026-09-17");
  });
});

describe("baja · cuándo deja de estar inscrito", () => {
  it("si NO pagó el período, a las 72 horas del aviso", () => {
    assert.equal(fechaEfectiva(base), "2026-09-13");
  });

  it("si YA pagó el período, cuando el período termina", () => {
    const s = con({ mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 75000 } });
    assert.equal(fechaEfectiva(s), "2026-09-30");
  });

  it("pagó, pero el período termina antes de que se cumpla el aviso: manda el aviso", () => {
    // El contrato pide las dos cosas, no la que salga primero.
    const s = con({
      fechaAviso: "2026-09-29",
      terminaElPeriodo: "2026-09-30",
      mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 75000 },
    });
    assert.equal(fechaEfectiva(s), "2026-10-02");
  });

  it("un pago parcial no cuenta como período pagado", () => {
    const s = con({ mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 40000 } });
    assert.equal(estaPagada(s.mensualidad), false);
    assert.equal(fechaEfectiva(s), "2026-09-13");
  });

  it("sin período abierto, la baja es a las 72 horas y ya", () => {
    assert.equal(fechaEfectiva(con({ terminaElPeriodo: null, mensualidad: null })), "2026-09-13");
  });
});

describe("baja · el cargo que no se alcanzó a cobrar", () => {
  it("dos de cuatro clases: se le cobra la mitad", () => {
    const a = ajusteProporcional(base)!;
    assert.equal(a.antesCentavos, 75000);
    assert.equal(a.despuesCentavos, 37500);
    assert.equal(a.condonadoCentavos, 37500);
  });

  it("si ya pagó, no se toca nada: la cláusula 12ª no devuelve", () => {
    const s = con({ mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 75000 } });
    assert.equal(ajusteProporcional(s), null);
  });

  it("nunca se ajusta por debajo de lo que el tutor ya entregó", () => {
    // Pagó $600 de $750 y solo tomó una clase. La prorrata daría $187.50, pero
    // bajar ahí obligaría a devolverle $412.50, y eso no existe en el contrato.
    const s = con({
      clasesConsumidas: 1,
      mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 60000 },
    });
    const a = ajusteProporcional(s)!;
    assert.equal(a.despuesCentavos, 60000);
    assert.equal(a.condonadoCentavos, 15000);
    assert.match(a.explicacion, /no devuelve/);
  });

  it("si ya tomó todas las clases, no hay nada que condonar", () => {
    assert.equal(ajusteProporcional(con({ clasesConsumidas: 4 })), null);
  });

  it("si no tomó ninguna, el cargo se va a cero", () => {
    const a = ajusteProporcional(con({ clasesConsumidas: 0 }))!;
    assert.equal(a.despuesCentavos, 0);
    assert.equal(a.condonadoCentavos, 75000);
  });

  it("tomar más clases de las contratadas no cobra de más", () => {
    // Una recuperación mal contada no puede convertirse en un sobrecargo.
    assert.equal(ajusteProporcional(con({ clasesConsumidas: 9 })), null);
  });

  it("ocho clases de Allegro Virtuoso, tres tomadas: se reparte sin perder centavos", () => {
    const s = con({
      clasesContratadas: 8, clasesConsumidas: 3,
      mensualidad: { cargoId: 9, montoCentavos: 140000, aplicadoCentavos: 0 },
    });
    const a = ajusteProporcional(s)!;
    assert.equal(a.despuesCentavos + a.condonadoCentavos, 140000);
    assert.equal(a.despuesCentavos, 52500);
  });

  it("sin mensualidad no hay ajuste", () => {
    assert.equal(ajusteProporcional(con({ mensualidad: null })), null);
  });

  it("un período sin clases contratadas no divide entre cero", () => {
    assert.equal(ajusteProporcional(con({ clasesContratadas: 0 })), null);
  });
});

describe("baja · lo que la impide", () => {
  it("una inscripción que ya no está activa no se da de baja dos veces", () => {
    assert.match(motivoParaNoDarDeBaja(con({ estadoInscripcion: "finalizada" }))!, /ya no está activa/);
  });

  it("un instrumento de la academia sin devolver la detiene", () => {
    const m = motivoParaNoDarDeBaja(con({ prestamosAbiertos: 1 }))!;
    assert.match(m, /sin devolver/);
  });

  it("y lo dice en plural cuando son varios", () => {
    assert.match(motivoParaNoDarDeBaja(con({ prestamosAbiertos: 2 }))!, /2 instrumentos/);
  });

  it("el hermano que paga no se va dejando a los demás sin cobro", () => {
    const m = motivoParaNoDarDeBaja(con({ cubiertasActivas: 1 }))!;
    assert.match(m, /plan familiar/);
  });

  it("una baja normal no tiene impedimento", () => {
    assert.equal(motivoParaNoDarDeBaja(base), null);
  });
});

describe("baja · lo que se le explica a quien la captura", () => {
  it("dice la fecha, el dinero y la agenda, antes de apretar nada", () => {
    const p = planDeBaja(base);
    assert.equal(p.fechaEfectiva, "2026-09-13");
    assert.equal(p.esperaAlPeriodo, false);
    assert.equal(p.resumen.length, 3);
    assert.match(p.resumen[0]!, /2026-09-13/);
    assert.match(p.resumen[1]!, /2 de 4 clases/);
    assert.match(p.resumen[2]!, /se cancelan/);
  });

  it("cuando pagó, explica que conserva sus clases y que no se devuelve", () => {
    const p = planDeBaja(con({
      mensualidad: { cargoId: 7, montoCentavos: 75000, aplicadoCentavos: 75000 },
    }));
    assert.equal(p.conservaClases, true);
    assert.equal(p.esperaAlPeriodo, true);
    assert.match(p.resumen[0]!, /termina el período/);
    assert.match(p.resumen[1]!, /no se devuelve/);
  });

  it("sin mensualidad pendiente también lo dice, en vez de callar", () => {
    const p = planDeBaja(con({ mensualidad: null }));
    assert.match(p.resumen[1]!, /No hay mensualidad pendiente/);
  });

  it("si ya tomó todo, dice por qué el cargo no se mueve", () => {
    const p = planDeBaja(con({ clasesConsumidas: 4 }));
    assert.match(p.resumen[1]!, /ya tomó todas las clases/);
  });
});
