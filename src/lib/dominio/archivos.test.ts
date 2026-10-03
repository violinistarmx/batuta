import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { nombreDeDescarga, rutaContenida, rutaRelativa, validarArchivo } from "./archivos.ts";

const RAIZ = "/var/batuta/almacen";

describe("validación de archivos", () => {
  test("acepta PDF, JPG y PNG", () => {
    for (const t of ["application/pdf", "image/jpeg", "image/png"]) {
      assert.equal(validarArchivo(t, 1024).ok, true, t);
    }
  });

  test("rechaza ejecutables y otros tipos", () => {
    for (const t of ["application/x-msdownload", "text/html", "application/zip", ""]) {
      assert.equal(validarArchivo(t, 1024).ok, false, t);
    }
  });

  test("rechaza archivos vacíos", () => {
    assert.equal(validarArchivo("application/pdf", 0).ok, false);
  });

  test("rechaza archivos de más de 10 MB", () => {
    const r = validarArchivo("application/pdf", 11 * 1024 * 1024);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.razon : "", /MB/);
  });

  test("acepta justo en el límite", () => {
    assert.equal(validarArchivo("application/pdf", 10 * 1024 * 1024).ok, true);
  });
});

describe("contención de rutas", () => {
  test("una ruta normal se resuelve dentro del almacén", () => {
    assert.equal(rutaContenida(RAIZ, "ab/ab123.pdf"), `${RAIZ}/ab/ab123.pdf`);
  });

  test("no se puede escapar con ..", () => {
    // Sin esta comprobación, un valor manipulado en la base leería cualquier
    // archivo del servidor.
    assert.throws(() => rutaContenida(RAIZ, "../../etc/passwd"));
    assert.throws(() => rutaContenida(RAIZ, "ab/../../../.env"));
  });

  test("no se puede escapar con una ruta absoluta", () => {
    assert.throws(() => rutaContenida(RAIZ, "/etc/passwd"));
  });

  test("un prefijo parecido no cuenta como dentro", () => {
    // /var/batuta/almacen-publico NO está dentro de /var/batuta/almacen.
    assert.throws(() => rutaContenida(RAIZ, "../almacen-publico/x.pdf"));
  });

  test("reparte en subcarpetas por los primeros caracteres", () => {
    assert.equal(rutaRelativa("abcd1234-ef", "pdf"), "ab/abcd1234-ef.pdf");
  });
});

describe("nombre de descarga", () => {
  test("conserva un nombre normal", () => {
    assert.equal(nombreDeDescarga("Planeación clase 3.pdf", "pdf"), "Planeación clase 3.pdf");
  });

  test("agrega la extensión si falta", () => {
    assert.equal(nombreDeDescarga("Planeación", "pdf"), "Planeación.pdf");
  });

  test("quita comillas y saltos de línea", () => {
    // Permiten inyectar cabeceras adicionales en Content-Disposition.
    const r = nombreDeDescarga('mal"nombre\r\nX-Inyectado: si.pdf', "pdf");
    assert.ok(!r.includes('"'));
    assert.ok(!/[\r\n]/.test(r));
  });

  test("aplana separadores de ruta", () => {
    const r = nombreDeDescarga("../../etc/passwd", "pdf");
    assert.ok(!r.includes("/"));
    assert.ok(!r.includes("\\"));
  });

  test("un nombre vacío recibe uno por omisión", () => {
    assert.equal(nombreDeDescarga("   ", "pdf"), "documento.pdf");
  });

  test("recorta nombres desmedidos", () => {
    assert.ok(nombreDeDescarga("a".repeat(500), "pdf").length <= 125);
  });
});
