import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  efectoEnCreditos,
  evaluarPosposicion,
  horasDeAnticipacion,
  movimientoDeCierre,
  saldoDeCreditos,
  type ParametrosCiclo,
} from "./creditos.ts";
import {
  generaPartida,
  importeDocenteCentavos,
  margenDelCiclo,
  type ParametrosNomina,
} from "./nomina.ts";

const CICLO: ParametrosCiclo = { horasAvisoPosposicion: 24, maxPosposicionesPorCiclo: 2 };
const NOMINA: ParametrosNomina = { tarifaHoraCentavos: 12_000, factorFaltaSinAviso: 0.75 };

describe("saldo de clases", () => {
  test("asistir consume un credito", () => {
    assert.deepEqual(efectoEnCreditos("asistio"), { delta: -1, motivo: "clase_tomada" });
  });

  test("faltar sin aviso consume un credito (clausula cuarta)", () => {
    assert.deepEqual(efectoEnCreditos("falta"), { delta: -1, motivo: "falta_sin_aviso" });
  });

  test("posponer a tiempo no genera movimiento", () => {
    assert.equal(efectoEnCreditos("reprogramada"), null);
  });

  test("cancelacion por la academia no afecta al alumno", () => {
    assert.equal(efectoEnCreditos("cancelada"), null);
  });

  test("el saldo es la suma del libro mayor", () => {
    const libro = [
      { delta: 4 },  // emision del ciclo
      { delta: -1 }, // asistio
      { delta: -1 }, // falto sin avisar
    ];
    assert.equal(saldoDeCreditos(libro), 2);
  });

  test("una reprogramacion no infla el saldo", () => {
    // Original pospuesta (sin movimiento) + recuperacion impartida (-1).
    // Si la posposicion generara un credito, el alumno terminaria con una clase de mas.
    const libro = [{ delta: 4 }, { delta: -1 }];
    assert.equal(saldoDeCreditos(libro), 3);
  });
});

describe("posposiciones", () => {
  test("con 24 h o mas se permite sin autorizacion", () => {
    assert.deepEqual(evaluarPosposicion(24, 0, CICLO), {
      permitido: true,
      requiereAutorizacion: false,
    });
  });

  test("con menos de 24 h exige autorizacion del director", () => {
    const r = evaluarPosposicion(5, 0, CICLO);
    assert.equal(r.permitido, true);
    assert.equal(r.permitido && r.requiereAutorizacion, true);
  });

  test("agotado el tope de 2, no hay excepcion posible", () => {
    const r = evaluarPosposicion(72, 2, CICLO);
    assert.equal(r.permitido, false);
    assert.match(r.permitido === false ? r.razon : "", /2 posposiciones/);
  });

  test("el tope manda aunque el aviso sea impecable", () => {
    assert.equal(evaluarPosposicion(200, 3, CICLO).permitido, false);
  });

  test("las horas se cuentan desde el aviso, no desde la captura", () => {
    const aviso = new Date("2026-09-20T10:00:00Z");
    const clase = new Date("2026-09-22T10:00:00Z");
    assert.equal(horasDeAnticipacion(aviso, clase), 48);
  });

  test("avisar despues de que empezo da anticipacion negativa", () => {
    const aviso = new Date("2026-09-22T11:00:00Z");
    const clase = new Date("2026-09-22T10:00:00Z");
    assert.equal(horasDeAnticipacion(aviso, clase), -1);
    assert.equal(evaluarPosposicion(-1, 0, CICLO).permitido, true); // permitido solo con autorizacion
  });
});

describe("cierre de ciclo", () => {
  test("las clases no tomadas expiran, no se acumulan", () => {
    assert.deepEqual(movimientoDeCierre(2), { delta: -2, motivo: "expiracion_ciclo" });
  });

  test("un ciclo consumido por completo no genera movimiento de cierre", () => {
    assert.equal(movimientoDeCierre(0), null);
  });

  test("el cierre deja el saldo exactamente en cero", () => {
    const libro = [{ delta: 4 }, { delta: -1 }];
    const cierre = movimientoDeCierre(saldoDeCreditos(libro));
    assert.ok(cierre);
    assert.equal(saldoDeCreditos([...libro, cierre]), 0);
  });
});

describe("nomina docente", () => {
  test("clase de una hora impartida paga $120", () => {
    assert.equal(importeDocenteCentavos(60, "asistio", NOMINA), 12_000);
  });

  test("clase de dos horas impartida paga $240", () => {
    assert.equal(importeDocenteCentavos(120, "asistio", NOMINA), 24_000);
  });

  test("falta sin aviso paga el 75 %", () => {
    assert.equal(importeDocenteCentavos(60, "falta", NOMINA), 9_000);
    assert.equal(importeDocenteCentavos(120, "falta", NOMINA), 18_000);
  });

  test("clase cancelada o pospuesta no paga", () => {
    assert.equal(importeDocenteCentavos(60, "cancelada", NOMINA), 0);
    assert.equal(importeDocenteCentavos(60, "reprogramada", NOMINA), 0);
    assert.equal(importeDocenteCentavos(60, "programada", NOMINA), 0);
  });

  test("una tarifa propia del docente tiene precedencia", () => {
    assert.equal(importeDocenteCentavos(60, "asistio", NOMINA, 15_000), 15_000);
  });

  test("solo las clases impartidas generan partida", () => {
    assert.equal(generaPartida("asistio"), true);
    assert.equal(generaPartida("falta"), true);
    assert.equal(generaPartida("reprogramada"), false);
    assert.equal(generaPartida("cancelada"), false);
    assert.equal(generaPartida("programada"), false);
  });
});

describe("margenes de los programas del contrato 2025", () => {
  const casos = [
    { nombre: "Plan por Clase", precio: 20_000, clases: 1, minutos: 60, esperado: 40.0 },
    { nombre: "Allegro Andante", precio: 75_000, clases: 4, minutos: 60, esperado: 36.0 },
    { nombre: "Allegro Virtuoso", precio: 150_000, clases: 8, minutos: 60, esperado: 36.0 },
    { nombre: "Presto Virtuoso", precio: 250_000, clases: 8, minutos: 120, esperado: 23.2 },
  ];

  for (const c of casos) {
    test(`${c.nombre} deja ${c.esperado} % de margen`, () => {
      const costo = c.clases * importeDocenteCentavos(c.minutos, "asistio", NOMINA);
      const { margenPorcentaje } = margenDelCiclo(c.precio, costo);
      assert.equal(Number(margenPorcentaje.toFixed(1)), c.esperado);
    });
  }

  test("Presto entrega el doble de horas que Allegro Virtuoso", () => {
    assert.equal((8 * 120) / 60, 16);
    assert.equal((8 * 60) / 60, 8);
  });
});
