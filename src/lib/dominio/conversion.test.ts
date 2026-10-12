import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { compactarMarkdown, limitarMarkdown } from "./conversion.ts";

describe("compactación de Markdown", () => {
  test("sustituye imágenes embebidas por una etiqueta con su texto alternativo", () => {
    const entrada = "Antes\n\n![Logo](data:image/png;base64,iVBORw0KGgo=)\n\nDespués";
    assert.equal(compactarMarkdown(entrada), "Antes\n\n[imagen: Logo]\n\nDespués");
  });

  test("sin texto alternativo deja una etiqueta genérica", () => {
    assert.equal(compactarMarkdown("![](data:image/png;base64...)"), "[imagen]");
  });

  test("no toca imágenes que apuntan a una URL normal", () => {
    const entrada = "![foto](https://ejemplo.mx/foto.jpg)";
    assert.equal(compactarMarkdown(entrada), entrada);
  });

  test("normaliza saltos de Windows y quita espacios al final de línea", () => {
    assert.equal(compactarMarkdown("uno  \r\ndos\t\r\ntres"), "uno\ndos\ntres");
  });

  test("reduce cualquier cantidad de líneas vacías a un párrafo", () => {
    assert.equal(compactarMarkdown("a\n\n\n\n\nb"), "a\n\nb");
  });

  test("recorta los bordes del documento", () => {
    assert.equal(compactarMarkdown("\n\n  Hola  \n\n"), "Hola");
  });
});

describe("límite de caracteres", () => {
  test("un texto que cabe pasa intacto", () => {
    const r = limitarMarkdown("Corto", 100);
    assert.deepEqual(r, { texto: "Corto", truncado: false, omitidos: 0 });
  });

  test("corta en el último párrafo completo que cabe", () => {
    const entrada = "Primer párrafo completo.\n\nSegundo párrafo que no cabe enterito.";
    const r = limitarMarkdown(entrada, 40);
    assert.equal(r.truncado, true);
    assert.ok(r.texto.startsWith("Primer párrafo completo.\n\n[… documento truncado:"));
    assert.ok(!r.texto.includes("Segundo"));
  });

  test("si el único párrafo es enorme, corta en seco sin perder más de lo necesario", () => {
    const entrada = "x".repeat(100);
    const r = limitarMarkdown(entrada, 30);
    assert.equal(r.omitidos, 70);
    assert.ok(r.texto.startsWith("x".repeat(30)));
    assert.match(r.texto, /70 caracteres omitidos/);
  });

  test("no tira más de la mitad del tope por buscar un párrafo", () => {
    // El único salto de párrafo está en la posición 2, antes de la mitad del tope (80 / 2 = 40):
    // corta en el tope exacto, no en el párrafo.
    const entrada = "ab\n\n" + "y".repeat(100);
    const r = limitarMarkdown(entrada, 80);
    assert.equal(r.omitidos, 24);
    assert.ok(r.texto.startsWith("ab\n\n" + "y".repeat(76) + "\n\n[… documento truncado"));
  });

  test("rechaza topes que no son enteros positivos", () => {
    assert.throws(() => limitarMarkdown("x", 0), /entero positivo/);
    assert.throws(() => limitarMarkdown("x", 1.5), /entero positivo/);
  });
});
