import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, test } from "node:test";

import { convertirAMarkdown } from "./markitdown.ts";

const PDF = resolve(process.cwd(), "src/lib/testdata/planeacion-muestra.pdf");
const BIN = process.env.MARKITDOWN_BIN ?? "markitdown";
// Las pruebas que necesitan el binario se omiten si no está; las de fallo siempre corren.
const instalado = spawnSync(BIN, ["--version"]).status === 0;

describe("conversión con markitdown", () => {
  test("convierte un PDF de texto y conserva su contenido", { skip: !instalado }, async () => {
    const r = await convertirAMarkdown(PDF, { bin: BIN });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.match(r.markdown, /Objetivos: afinar/);
    assert.match(r.markdown, /escala de Do mayor/);
    assert.equal(r.truncado, false);
  });

  test("aplica el tope de caracteres y lo avisa", { skip: !instalado }, async () => {
    const r = await convertirAMarkdown(PDF, { bin: BIN, maxCaracteres: 60 });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.truncado, true);
    assert.match(r.markdown, /documento truncado/);
  });

  test("un documento inexistente devuelve razón, no excepción", { skip: !instalado }, async () => {
    const r = await convertirAMarkdown(resolve(process.cwd(), "no-existe.pdf"), { bin: BIN });
    assert.equal(r.ok, false);
  });

  test("sin el binario avisa qué variable definir", async () => {
    const r = await convertirAMarkdown(PDF, { bin: "/ruta/que/no/existe/markitdown" });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.razon, /MARKITDOWN_BIN/);
  });

  test("una salida vacía (escaneo o imagen sin OCR) se rechaza con razón", async () => {
    // /bin/true termina bien sin escribir nada: el mismo resultado que una foto.
    const r = await convertirAMarkdown(PDF, { bin: "/bin/true" });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.razon, /no tiene texto extraíble/);
  });

  test("un fallo del proceso no revela detalles al llamador", async () => {
    // /bin/false sale con código 1: el error se registra sin contenido y la razón es genérica.
    const r = await convertirAMarkdown(PDF, { bin: "/bin/false" });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.razon, "No se pudo convertir el documento.");
  });

  test("rechaza rutas relativas sin ejecutar nada", async () => {
    const r = await convertirAMarkdown("planeacion.pdf", { bin: "/bin/false" });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.razon, /absoluta/);
  });
});
