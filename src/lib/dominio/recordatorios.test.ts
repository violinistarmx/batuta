import assert from "node:assert/strict";
import { test } from "node:test";

import { destinosDeClase } from "./recordatorios.ts";

test("destinosDeClase: ofrece alumno y tutor cuando ambos tienen número", () => {
  const d = destinosDeClase(
    [{ nombre: "Laura Olvera", tratamiento: "Sra.", telefono: "7711234567", whatsapp: null, esResponsablePago: true }],
    { nombre: "Ana Victoria Mérida", telefono: "7717654321" },
    false,
  );
  assert.ok(d.alumno && d.tutor);
  assert.equal(d.sugerido, "tutor");
  assert.equal(d.tutor?.saludo, "Sra. Laura");
  assert.equal(d.alumno?.paraTutor, false);
});

test("destinosDeClase: adulto sin tutor se sugiere a sí mismo", () => {
  const d = destinosDeClase([], { nombre: "Ana María Mariano", telefono: "7711234567" }, true);
  assert.equal(d.sugerido, "alumno");
  assert.equal(d.tutor, null);
});

test("destinosDeClase: menor sin tutor con teléfono propio sugiere al alumno", () => {
  const d = destinosDeClase([], { nombre: "Leonardo", telefono: "7711234567" }, false);
  assert.equal(d.sugerido, "alumno");
});

test("destinosDeClase: menor con tutor sin número y alumno con número: se ofrece el alumno", () => {
  const d = destinosDeClase(
    [{ nombre: "Laura", tratamiento: null, telefono: null, whatsapp: null, esResponsablePago: true }],
    { nombre: "Leonardo", telefono: "7711234567" },
    false,
  );
  assert.equal(d.tutor, null);
  assert.equal(d.sugerido, "alumno");
});

test("destinosDeClase: sin ningún número no hay destinatario", () => {
  const d = destinosDeClase([], { nombre: "Leonardo", telefono: null }, false);
  assert.equal(d.alumno, null);
  assert.equal(d.tutor, null);
});
