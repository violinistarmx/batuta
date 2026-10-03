import assert from "node:assert/strict";
import test from "node:test";

import { aplicarRetencion, enMegas, respaldoAlDia, type Respaldo } from "./respaldos.ts";

const HOY = "2026-09-19";
const r = (fecha: string): Respaldo => ({ nombre: `batuta-${fecha}.tgz`, fecha, bytes: 1_000_000 });

test("conserva todos los de los últimos 14 días", () => {
  const lista = ["2026-09-19", "2026-09-18", "2026-09-17", "2026-09-10", "2026-09-06"].map(r);
  const { conservar, borrar } = aplicarRetencion(lista, HOY);
  assert.equal(conservar.length, 5);
  assert.equal(borrar.length, 0);
});

test("entre 14 días y 8 semanas conserva uno por semana", () => {
  // Tres del mismo lunes-domingo, a un mes de distancia: sobrevive uno.
  const lista = ["2026-08-17", "2026-08-18", "2026-08-19"].map(r);
  const { conservar, borrar } = aplicarRetencion(lista, HOY);
  assert.equal(conservar.length, 1);
  assert.equal(borrar.length, 2);
  // Se queda el más reciente de esa semana.
  assert.equal(conservar[0]?.fecha, "2026-08-19");
});

test("semanas distintas conservan uno cada una", () => {
  const lista = ["2026-08-19", "2026-08-12", "2026-08-05"].map(r);
  assert.equal(aplicarRetencion(lista, HOY).conservar.length, 3);
});

test("más atrás conserva uno por mes", () => {
  const lista = ["2026-03-02", "2026-03-15", "2026-03-28", "2026-02-10"].map(r);
  const { conservar } = aplicarRetencion(lista, HOY);
  assert.deepEqual(conservar.map((x) => x.fecha).sort(), ["2026-02-10", "2026-03-28"]);
});

test("más allá de la política, se borra", () => {
  const { conservar, borrar } = aplicarRetencion(
    [r("2026-09-19"), r("2023-01-05")], HOY,
  );
  assert.deepEqual(conservar.map((x) => x.fecha), ["2026-09-19"]);
  assert.deepEqual(borrar.map((x) => x.fecha), ["2023-01-05"]);
});

test("nunca borra el único respaldo que existe, por viejo que sea", () => {
  // El caso que arruina el día: la política diría que sobra, pero es todo lo que hay.
  const { conservar, borrar } = aplicarRetencion([r("2019-04-01")], HOY);
  assert.equal(conservar.length, 1);
  assert.equal(borrar.length, 0);
});

test("una lista vacía no truena", () => {
  const { conservar, borrar } = aplicarRetencion([], HOY);
  assert.deepEqual(conservar, []);
  assert.deepEqual(borrar, []);
});

test("no muta la lista que recibe", () => {
  const lista = [r("2026-01-01"), r("2026-09-19")];
  const copia = [...lista];
  aplicarRetencion(lista, HOY);
  assert.deepEqual(lista, copia);
});

test("el aviso es «hace demasiado», no «no hay»", () => {
  assert.equal(respaldoAlDia("2026-09-19", HOY), true);
  assert.equal(respaldoAlDia("2026-09-17", HOY), true);
  assert.equal(respaldoAlDia("2026-09-16", HOY), false);
  assert.equal(respaldoAlDia(null, HOY), false);
});

test("tamaño legible", () => {
  assert.equal(enMegas(1_048_576), "1.0 MB");
  assert.equal(enMegas(0), "0.0 MB");
});
