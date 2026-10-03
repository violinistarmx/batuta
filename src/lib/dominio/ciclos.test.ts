import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  diasDelMes, diasRestantes, estaDentro, periodoMensual, sumarDias, sumarMeses,
} from "./ciclos.ts";

describe("aritmética de meses", () => {
  test("suma normal", () => {
    assert.equal(sumarMeses("2026-09-18", 1), "2026-10-18");
  });

  test("cruza el fin de año", () => {
    assert.equal(sumarMeses("2026-12-15", 1), "2027-01-15");
  });

  test("el 31 de enero recorta al 28 de febrero", () => {
    // Sin recorte, Date convertiría "31 de febrero" en 3 de marzo y el período
    // del alumno se correría dos días.
    assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  });

  test("en año bisiesto recorta al 29", () => {
    assert.equal(sumarMeses("2028-01-31", 1), "2028-02-29");
  });

  test("el 31 de marzo recorta al 30 de abril", () => {
    assert.equal(sumarMeses("2026-03-31", 1), "2026-04-30");
  });

  test("febrero bisiesto", () => {
    assert.equal(diasDelMes(2028, 2), 29);
    assert.equal(diasDelMes(2026, 2), 28);
    assert.equal(diasDelMes(2100, 2), 28); // 2100 no es bisiesto
  });
});

describe("períodos anclados a la inscripción", () => {
  test("del 18 de septiembre al 17 de octubre", () => {
    assert.deepEqual(periodoMensual("2026-09-18"), {
      iniciaEl: "2026-09-18",
      terminaEl: "2026-10-17",
    });
  });

  test("dos períodos consecutivos no comparten ningún día", () => {
    const p1 = periodoMensual("2026-09-18");
    const p2 = periodoMensual(sumarDias(p1.terminaEl, 1));
    assert.equal(p2.iniciaEl, "2026-10-18");
    assert.ok(p1.terminaEl < p2.iniciaEl);
  });

  test("un alta del 31 de enero cierra el 27 de febrero", () => {
    // 31 ene + 1 mes = 28 feb (recortado), menos un día = 27 feb.
    assert.deepEqual(periodoMensual("2026-01-31"), {
      iniciaEl: "2026-01-31",
      terminaEl: "2026-02-27",
    });
  });

  test("doce períodos encadenados no pierden ni repiten días", () => {
    let inicio = "2026-01-31";
    for (let i = 0; i < 12; i++) {
      const p = periodoMensual(inicio);
      assert.ok(p.terminaEl > p.iniciaEl, `período ${i} invertido`);
      inicio = sumarDias(p.terminaEl, 1);
    }
    assert.ok(inicio > "2026-12-01");
  });
});

describe("pertenencia y cuenta regresiva", () => {
  const p = periodoMensual("2026-09-18");

  test("el primer y el último día cuentan", () => {
    assert.equal(estaDentro("2026-09-18", p), true);
    assert.equal(estaDentro("2026-10-17", p), true);
  });

  test("un día antes o después queda fuera", () => {
    assert.equal(estaDentro("2026-09-17", p), false);
    assert.equal(estaDentro("2026-10-18", p), false);
  });

  test("días restantes", () => {
    assert.equal(diasRestantes(p, "2026-09-18"), 29);
    assert.equal(diasRestantes(p, "2026-10-17"), 0);
    assert.equal(diasRestantes(p, "2026-10-20"), -3);
  });
});
