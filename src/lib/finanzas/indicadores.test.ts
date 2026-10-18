import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  cac, costoDocente, costoPorAlumno, flujoAcumulado, margenBruto, margenNeto,
  porcentajeCobranza, puntoEquilibrio, rentabilidad, retencion, semaforo, variacion,
} from "./indicadores.ts";

const NOMINA = { tarifaHoraCentavos: 12_000, factorFaltaSinAviso: 0.75, factorFaltaJustificada: 0 };

describe("margen", () => {
  it("bruto = (ingresos − costo docente) / ingresos", () => {
    assert.equal(margenBruto(100_000, 40_000), 0.6);
  });
  it("neto = (ingresos − todos los gastos) / ingresos, y puede ser negativo", () => {
    assert.equal(margenNeto(100_000, 80_000), 0.2);
    assert.equal(margenNeto(100_000, 125_000), -0.25);
  });
  it("sin ingresos no hay margen: null, no 0 %", () => {
    assert.equal(margenBruto(0, 5_000), null);
    assert.equal(margenNeto(0, 0), null);
  });
  it("cobranza = cobrado / facturado", () => {
    assert.equal(porcentajeCobranza(90_000, 100_000), 0.9);
    assert.equal(porcentajeCobranza(0, 0), null);
  });
});

describe("retención", () => {
  it("terminan el mes / iniciaron el mes", () => {
    assert.equal(retencion(40, 36), 0.9);
  });
  it("los que entran a mitad de mes no la inflan por encima de 100 %", () => {
    assert.equal(retencion(40, 45), 1);
  });
  it("sin alumnos al iniciar no hay retención", () => {
    assert.equal(retencion(0, 3), null);
  });
});

describe("CAC", () => {
  it("gasto en publicidad / alumnos nuevos, redondeado al centavo", () => {
    assert.equal(cac(300_000, 4), 75_000);
    assert.equal(cac(100_000, 3), 33_333);
  });
  it("sin alumnos nuevos no hay CAC", () => {
    assert.equal(cac(300_000, 0), null);
  });
  it("costo operativo por alumno", () => {
    assert.equal(costoPorAlumno(900_000, 30), 30_000);
    assert.equal(costoPorAlumno(900_000, 0), null);
  });
});

describe("punto de equilibrio", () => {
  it("gastos fijos / (ingreso promedio − costo variable), hacia arriba", () => {
    // $20,000 fijos, cada alumno deja $1,500 − $600 = $900 → 22.2 → 23 alumnos.
    const p = puntoEquilibrio(2_000_000, 150_000, 60_000, 30);
    assert.equal(p.alumnosMinimos, 23);
    assert.equal(p.contribucionPorAlumno, 90_000);
    assert.equal(p.avance, 30 / 23);
  });
  it("si cada alumno no aporta, no hay equilibrio", () => {
    const p = puntoEquilibrio(2_000_000, 60_000, 60_000, 30);
    assert.equal(p.alumnosMinimos, null);
    assert.equal(p.avance, null);
  });
  it("sin gastos fijos el equilibrio es cero alumnos", () => {
    assert.equal(puntoEquilibrio(0, 150_000, 60_000, 10).alumnosMinimos, 0);
  });
});

describe("costo docente", () => {
  it("horas impartidas × tarifa, con la regla de la nómina", () => {
    const total = costoDocente([
      { minutos: 60, estado: "asistio", tarifaHoraCentavos: null },
      { minutos: 60, estado: "falta", tarifaHoraCentavos: null },
      { minutos: 60, estado: "falta_justificada", tarifaHoraCentavos: null },
      { minutos: 60, estado: "cancelada", tarifaHoraCentavos: null },
    ], NOMINA);
    assert.equal(total, 12_000 + 9_000);
  });
  it("Family Duet: dos horas reales cuestan dos horas, con la tarifa del maestro", () => {
    assert.equal(costoDocente([{ minutos: 120, estado: "asistio", tarifaHoraCentavos: 15_000 }], NOMINA), 30_000);
  });
  it("si la clase ya tiene partida, manda el importe pagado (aunque se haya ajustado)", () => {
    assert.equal(costoDocente([
      { minutos: 60, estado: "falta_justificada", tarifaHoraCentavos: null, importePartidaCentavos: 9_000 },
    ], NOMINA), 9_000);
  });
});

describe("semáforo", () => {
  it("meta mínima: verde, ámbar dentro de la tolerancia, rojo abajo", () => {
    assert.equal(semaforo(0.25, 0.2, "minimo", 0.1), "verde");
    assert.equal(semaforo(0.19, 0.2, "minimo", 0.1), "ambar");
    assert.equal(semaforo(0.15, 0.2, "minimo", 0.1), "rojo");
  });
  it("meta máxima: costo docente < 45 %", () => {
    assert.equal(semaforo(0.40, 0.45, "maximo", 0.1), "verde");
    assert.equal(semaforo(0.48, 0.45, "maximo", 0.1), "ambar");
    assert.equal(semaforo(0.55, 0.45, "maximo", 0.1), "rojo");
  });
  it("sin dato", () => {
    assert.equal(semaforo(null, 0.45, "maximo", 0.1), "sin_dato");
  });
});

describe("variación y flujo", () => {
  it("variación relativa contra el periodo anterior", () => {
    assert.equal(variacion(110, 100), 0.1);
    assert.equal(variacion(-50, -100), 0.5);
    assert.equal(variacion(10, 0), null);
  });
  it("flujo de caja acumulado", () => {
    assert.deepEqual(flujoAcumulado([
      { recibido: 100, pagado: 60 }, { recibido: 50, pagado: 80 }, { recibido: 0, pagado: 0 },
    ]), [40, 10, 10]);
  });
});

describe("rentabilidad", () => {
  it("ordena por margen en pesos y calcula % e ingreso por hora", () => {
    const r = rentabilidad([
      { nombre: "Clase única", ingresos: 50_000, costoDocente: 5_000, horas: 5 },
      { nombre: "Allegro Virtuoso", ingresos: 2_000_000, costoDocente: 1_200_000, horas: 100 },
    ]);
    assert.equal(r[0]!.nombre, "Allegro Virtuoso");
    assert.equal(r[0]!.posicion, 1);
    assert.equal(r[0]!.margen, 800_000);
    assert.equal(r[0]!.margenPct, 0.4);
    assert.equal(r[0]!.ingresoPorHora, 20_000);
    assert.equal(r[1]!.margenPct, 0.9);
  });
});
