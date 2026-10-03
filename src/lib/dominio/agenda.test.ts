import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { movimientoPorCambio } from "./asistencia.ts";
import {
  buscarConflictos, ocupaHorario, seTraslapan, type ClaseAgendada,
} from "./conflictos.ts";

const t = (h: string) => new Date(`2026-09-21T${h}:00-06:00`);

describe("traslape de horarios", () => {
  test("dos clases a la misma hora chocan", () => {
    assert.equal(
      seTraslapan({ iniciaEn: t("16:00"), terminaEn: t("17:00") },
                  { iniciaEn: t("16:00"), terminaEn: t("17:00") }),
      true,
    );
  });

  test("clases consecutivas NO chocan", () => {
    // 16:00-17:00 y 17:00-18:00 son seguidas. Si esto diera conflicto, la
    // academia no podría agendar dos clases seguidas — que es como trabaja.
    assert.equal(
      seTraslapan({ iniciaEn: t("16:00"), terminaEn: t("17:00") },
                  { iniciaEn: t("17:00"), terminaEn: t("18:00") }),
      false,
    );
  });

  test("un traslape de un minuto sí cuenta", () => {
    assert.equal(
      seTraslapan({ iniciaEn: t("16:00"), terminaEn: t("17:00") },
                  { iniciaEn: t("16:59"), terminaEn: t("18:00") }),
      true,
    );
  });

  test("una clase de 2 h contiene a una de 1 h", () => {
    assert.equal(
      seTraslapan({ iniciaEn: t("16:00"), terminaEn: t("18:00") },
                  { iniciaEn: t("16:30"), terminaEn: t("17:30") }),
      true,
    );
  });

  test("canceladas y reprogramadas liberan el horario", () => {
    assert.equal(ocupaHorario("programada"), true);
    assert.equal(ocupaHorario("asistio"), true);
    assert.equal(ocupaHorario("cancelada"), false);
    assert.equal(ocupaHorario("reprogramada"), false);
  });
});

describe("conflictos de agenda", () => {
  const agendadas: ClaseAgendada[] = [
    { id: 1, alumnoId: 10, docenteId: 20, aulaId: 1, estado: "programada",
      iniciaEn: t("16:00"), terminaEn: t("17:00") },
  ];

  test("mismo cubículo, distinto alumno y maestro", () => {
    const c = buscarConflictos(
      { alumnoId: 99, docenteId: 99, aulaId: 1, iniciaEn: t("16:30"), terminaEn: t("17:30") },
      agendadas,
    );
    assert.deepEqual(c.map((x) => x.tipo), ["aula"]);
  });

  test("mismo maestro en otro cubículo", () => {
    const c = buscarConflictos(
      { alumnoId: 99, docenteId: 20, aulaId: 2, iniciaEn: t("16:30"), terminaEn: t("17:30") },
      agendadas,
    );
    assert.deepEqual(c.map((x) => x.tipo), ["docente"]);
  });

  test("el mismo alumno no puede estar en dos clases", () => {
    const c = buscarConflictos(
      { alumnoId: 10, docenteId: 99, aulaId: 2, iniciaEn: t("16:30"), terminaEn: t("17:30") },
      agendadas,
    );
    assert.deepEqual(c.map((x) => x.tipo), ["alumno"]);
  });

  test("se acumulan los tres tipos", () => {
    const c = buscarConflictos(
      { alumnoId: 10, docenteId: 20, aulaId: 1, iniciaEn: t("16:00"), terminaEn: t("17:00") },
      agendadas,
    );
    assert.deepEqual(c.map((x) => x.tipo).sort(), ["alumno", "aula", "docente"]);
  });

  test("una clase en línea no ocupa cubículo", () => {
    const c = buscarConflictos(
      { alumnoId: 99, docenteId: 99, aulaId: null, iniciaEn: t("16:00"), terminaEn: t("17:00") },
      agendadas,
    );
    assert.deepEqual(c, []);
  });

  test("mover una clase no la hace chocar consigo misma", () => {
    const c = buscarConflictos(
      { alumnoId: 10, docenteId: 20, aulaId: 1, iniciaEn: t("16:00"), terminaEn: t("17:00"),
        excluirClaseId: 1 },
      agendadas,
    );
    assert.deepEqual(c, []);
  });

  test("una clase cancelada no estorba", () => {
    const c = buscarConflictos(
      { alumnoId: 10, docenteId: 20, aulaId: 1, iniciaEn: t("16:00"), terminaEn: t("17:00") },
      [{ ...agendadas[0]!, estado: "cancelada" }],
    );
    assert.deepEqual(c, []);
  });

  test("agenda libre no produce conflictos", () => {
    const c = buscarConflictos(
      { alumnoId: 10, docenteId: 20, aulaId: 1, iniciaEn: t("18:00"), terminaEn: t("19:00") },
      agendadas,
    );
    assert.deepEqual(c, []);
  });
});

describe("registro y corrección de asistencia", () => {
  test("marcar asistió consume un crédito", () => {
    assert.deepEqual(movimientoPorCambio("programada", "asistio"), {
      delta: -1, motivo: "clase_tomada", nota: "asistió",
    });
  });

  test("marcar falta sin aviso también consume", () => {
    const m = movimientoPorCambio("programada", "falta");
    assert.equal(m?.delta, -1);
    assert.equal(m?.motivo, "falta_sin_aviso");
  });

  test("cancelar por la academia no mueve el saldo", () => {
    assert.equal(movimientoPorCambio("programada", "cancelada"), null);
  });

  test("corregir de asistió a falta no mueve el saldo", () => {
    // Ambos consumen: el saldo ya está bien. Agregar un movimiento de cero solo
    // ensuciaría el libro; el cambio de estado queda en bitácora.
    assert.equal(movimientoPorCambio("asistio", "falta"), null);
  });

  test("corregir de asistió a cancelada devuelve el crédito", () => {
    const m = movimientoPorCambio("asistio", "cancelada");
    assert.equal(m?.delta, 1);
    assert.equal(m?.motivo, "ajuste_manual");
    assert.match(m?.nota ?? "", /Corrección/);
  });

  test("la corrección se marca como ajuste, no como consumo", () => {
    // Así el índice único sigue protegiendo el consumo por asistencia sin
    // bloquear una corrección legítima.
    const m = movimientoPorCambio("asistio", "reprogramada");
    assert.equal(m?.motivo, "ajuste_manual");
  });

  test("volver a marcar asistió tras cancelar vuelve a consumir", () => {
    const m = movimientoPorCambio("cancelada", "asistio");
    assert.equal(m?.delta, -1);
    assert.equal(m?.motivo, "ajuste_manual");
  });

  test("registrar el mismo estado dos veces no genera nada", () => {
    assert.equal(movimientoPorCambio("asistio", "asistio"), null);
    assert.equal(movimientoPorCambio("cancelada", "cancelada"), null);
  });

  test("la suma de una clase nunca baja de -1", () => {
    // Recorrido: programada -> asistió -> cancelada -> asistió
    let saldo = 0;
    for (const [a, b] of [["programada", "asistio"], ["asistio", "cancelada"], ["cancelada", "asistio"]] as const) {
      saldo += movimientoPorCambio(a, b)?.delta ?? 0;
    }
    assert.equal(saldo, -1);
  });
});
