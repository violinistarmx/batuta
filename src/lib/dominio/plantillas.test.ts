import assert from "node:assert/strict";
import test from "node:test";

import {
  aWhatsapp, motivoParaNoEnviar, motivoParaRechazarTransicion, renderizar,
  transicionValida, variablesDe, type EstadoMensaje,
} from "./plantillas.ts";

test("sustituye los huecos", () => {
  const r = renderizar("Hola {{tutor}}, la clase de {{alumno}} es el {{fecha}}.", {
    tutor: "Marisol", alumno: "Valeria", fecha: "sábado",
  });
  assert.equal(r.texto, "Hola Marisol, la clase de Valeria es el sábado.");
  assert.deepEqual(r.faltantes, []);
});

test("tolera espacios dentro de las llaves", () => {
  assert.equal(renderizar("Hola {{ tutor }}", { tutor: "Ana" }).texto, "Hola Ana");
});

test("un hueco sin valor se reporta y NO se borra", () => {
  const r = renderizar("Hola {{tutor}}, {{alumno}} falta.", { alumno: "Valeria" });
  // El hueco se conserva para que el error sea visible, no invisible.
  assert.equal(r.texto, "Hola {{tutor}}, Valeria falta.");
  assert.deepEqual(r.faltantes, ["tutor"]);
});

test("un valor vacío cuenta como faltante", () => {
  // «Hola , te recordamos…» delata el sistema igual que el hueco.
  const r = renderizar("Hola {{tutor}}.", { tutor: "   " });
  assert.deepEqual(r.faltantes, ["tutor"]);
  assert.equal(r.texto, "Hola {{tutor}}.");
});

test("null y undefined también faltan", () => {
  assert.deepEqual(renderizar("{{a}}{{b}}", { a: null, b: undefined }).faltantes, ["a", "b"]);
});

test("el mismo hueco repetido se llena todas las veces y se reporta una", () => {
  const r = renderizar("{{alumno}} y {{alumno}}", {});
  assert.deepEqual(r.faltantes, ["alumno"]);
  const ok = renderizar("{{alumno}} y {{alumno}}", { alumno: "Valeria" });
  assert.equal(ok.texto, "Valeria y Valeria");
});

test("un dato de más no estorba", () => {
  const r = renderizar("Hola {{tutor}}", { tutor: "Ana", sobra: "x" });
  assert.deepEqual(r.faltantes, []);
});

test("lista las variables de una plantilla, sin repetir", () => {
  assert.deepEqual(
    variablesDe("{{a}} {{b}} {{a}} {{ c }}"),
    ["a", "b", "c"],
  );
  assert.deepEqual(variablesDe("Sin huecos"), []);
});

test("no confunde llaves sueltas con huecos", () => {
  assert.deepEqual(variablesDe("{ no } {{}} {{ 9mal }}"), []);
  assert.equal(renderizar("{ no }", {}).faltantes.length, 0);
});

test("un mensaje con huecos no se puede mandar", () => {
  const m = motivoParaNoEnviar("Hola {{tutor}}", "7711234567");
  assert.match(m ?? "", /\{\{tutor\}\}/);
});

test("un mensaje sin teléfono no se puede mandar", () => {
  assert.match(motivoParaNoEnviar("Hola Marisol", null) ?? "", /teléfono/i);
  assert.match(motivoParaNoEnviar("Hola Marisol", "  ") ?? "", /teléfono/i);
});

test("un mensaje vacío no se puede mandar", () => {
  assert.match(motivoParaNoEnviar("   ", "7711234567") ?? "", /vac/i);
});

test("un mensaje completo sí", () => {
  assert.equal(motivoParaNoEnviar("Hola Marisol", "7711234567"), null);
});

test("a «enviado» solo se llega desde «aprobado»", () => {
  assert.equal(transicionValida("aprobado", "enviado"), true);
  for (const d of ["borrador", "rechazado", "cancelado", "enviado"] as EstadoMensaje[]) {
    assert.equal(transicionValida(d, "enviado"), false, `${d} → enviado`);
  }
  assert.match(motivoParaRechazarTransicion("borrador", "enviado") ?? "", /sin aprobación/i);
});

test("un rechazado se corrige antes de aprobarse", () => {
  assert.equal(transicionValida("rechazado", "aprobado"), false);
  assert.equal(transicionValida("rechazado", "borrador"), true);
});

test("lo enviado no se deshace", () => {
  for (const h of ["borrador", "aprobado", "rechazado", "cancelado"] as EstadoMensaje[]) {
    assert.equal(transicionValida("enviado", h), false, `enviado → ${h}`);
  }
  assert.match(motivoParaRechazarTransicion("enviado", "cancelado") ?? "", /no se puede deshacer/i);
});

test("teléfonos a formato de WhatsApp", () => {
  assert.equal(aWhatsapp("771 123 4567"), "527711234567");
  assert.equal(aWhatsapp("7711234567"), "527711234567");
  assert.equal(aWhatsapp("+52 771 123 4567"), "527711234567");
  // El «1» que México usaba para celulares se descarta.
  assert.equal(aWhatsapp("5217711234567"), "527711234567");
  assert.equal(aWhatsapp("+1 415 555 0123"), "14155550123");
});

test("un teléfono que no lo es no produce un enlace roto", () => {
  assert.equal(aWhatsapp(null), null);
  assert.equal(aWhatsapp("123"), null);
  assert.equal(aWhatsapp("sin número"), null);
});
