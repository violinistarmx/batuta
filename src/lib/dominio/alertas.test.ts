import assert from "node:assert/strict";
import test from "node:test";

import {
  contarPorSeveridad, diasEntre, ordenarAlertas, severidadDeAdeudo,
  severidadDeAsistencia, severidadDeCredencial, severidadDePeriodo,
  type Alerta,
} from "./alertas.ts";

test("días entre fechas civiles, sin zona horaria de por medio", () => {
  assert.equal(diasEntre("2026-09-18", "2026-09-18"), 0);
  assert.equal(diasEntre("2026-09-18", "2026-09-21"), 3);
  assert.equal(diasEntre("2026-09-21", "2026-09-18"), -3);
  // Cruza fin de mes y año bisiesto sin desviarse.
  assert.equal(diasEntre("2026-01-31", "2026-02-01"), 1);
  assert.equal(diasEntre("2028-02-28", "2028-03-01"), 2);
  assert.equal(diasEntre("2026-12-31", "2027-01-01"), 1);
});

test("el adeudo es urgente desde el día siguiente al vencimiento", () => {
  assert.equal(severidadDeAdeudo("2026-09-17", "2026-09-18"), "urgente");
  assert.equal(severidadDeAdeudo("2026-09-18", "2026-09-18"), "pronto");
  assert.equal(severidadDeAdeudo("2026-09-21", "2026-09-18"), "pronto");
  assert.equal(severidadDeAdeudo("2026-09-25", "2026-09-18"), "informativa");
});

test("el período urge cuando ya terminó", () => {
  assert.equal(severidadDePeriodo("2026-09-17", "2026-09-18"), "urgente");
  assert.equal(severidadDePeriodo("2026-09-18", "2026-09-18"), "urgente");
  assert.equal(severidadDePeriodo("2026-09-23", "2026-09-18"), "pronto");
  assert.equal(severidadDePeriodo("2026-10-17", "2026-09-18"), "informativa");
});

test("la asistencia da un día de gracia y luego urge", () => {
  // La clase de esta tarde no es un descuido todavía.
  assert.equal(severidadDeAsistencia(0), null);
  assert.equal(severidadDeAsistencia(1), "pronto");
  assert.equal(severidadDeAsistencia(2), "pronto");
  assert.equal(severidadDeAsistencia(3), "urgente");
  assert.equal(severidadDeAsistencia(30), "urgente");
});

test("la credencial no alerta antes de su fecha", () => {
  assert.equal(severidadDeCredencial("2026-09-25", "2026-09-18"), null);
  assert.equal(severidadDeCredencial("2026-09-18", "2026-09-18"), "pronto");
  assert.equal(severidadDeCredencial("2026-09-11", "2026-09-18"), "urgente");
});

const a = (severidad: Alerta["severidad"], titulo: string, peso: number): Alerta =>
  ({ clase: "x", severidad, titulo, detalle: "", href: "/", peso });

test("ordena por severidad y, dentro de ella, por gravedad", () => {
  const orden = ordenarAlertas([
    a("informativa", "C", 10),
    a("pronto", "B", 1),
    a("urgente", "A", 5),
    a("urgente", "Z", 90),
    a("pronto", "D", 50),
  ]).map((x) => x.titulo);
  assert.deepEqual(orden, ["Z", "A", "D", "B", "C"]);
});

test("no muta la lista que recibe", () => {
  const original = [a("informativa", "C", 1), a("urgente", "A", 1)];
  const copia = [...original];
  ordenarAlertas(original);
  assert.deepEqual(original, copia);
});

test("cuenta por severidad", () => {
  const c = contarPorSeveridad([
    a("urgente", "A", 1), a("urgente", "B", 1), a("pronto", "C", 1),
  ]);
  assert.deepEqual(c, { urgente: 2, pronto: 1, informativa: 0 });
});

test("una bandeja vacía cuenta ceros, no undefined", () => {
  assert.deepEqual(contarPorSeveridad([]), { urgente: 0, pronto: 0, informativa: 0 });
});
