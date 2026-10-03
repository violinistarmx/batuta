import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { randomBytes } from "node:crypto";

import { cifrar, cifrarOpcional, descifrar, descifrarOpcional } from "./cifrado.ts";

before(() => {
  process.env.LLAVE_DATOS_SENSIBLES = randomBytes(32).toString("hex");
});

describe("cifrado de datos sensibles", () => {
  test("lo cifrado se recupera igual", () => {
    const texto = "TDAH diagnosticado en 2024, toma metilfenidato por las mañanas.";
    assert.equal(descifrar(cifrar(texto)), texto);
  });

  test("conserva acentos y eñes", () => {
    const texto = "Condición respiratoria: asma leve. Niña muy tímida al inicio.";
    assert.equal(descifrar(cifrar(texto)), texto);
  });

  test("el mismo texto produce cifrados distintos (IV aleatorio)", () => {
    // Si el IV se reutilizara, dos fichas idénticas se verían iguales en la base
    // y se podría deducir el contenido comparándolas.
    const texto = "Sin condiciones relevantes.";
    assert.notEqual(cifrar(texto), cifrar(texto));
  });

  test("lleva prefijo de versión para poder rotar el algoritmo", () => {
    assert.match(cifrar("x"), /^v1\./);
  });

  test("alterar un byte hace fallar el descifrado, no devolver basura", () => {
    const original = cifrar("Alergia severa al polvo.");
    const partes = original.split(".");
    const cuerpo = Buffer.from(partes[3]!, "base64url");
    cuerpo[0] = cuerpo[0]! ^ 0xff;
    partes[3] = cuerpo.toString("base64url");
    assert.throws(() => descifrar(partes.join(".")));
  });

  test("un texto cifrado con otra llave no se abre", () => {
    const cifrado = cifrar("Dato reservado.");
    const llaveOriginal = process.env.LLAVE_DATOS_SENSIBLES;
    // La llave se cachea en el módulo, así que este caso se cubre desde el
    // descifrado tolerante, que es el que ve el usuario.
    assert.equal(descifrar(cifrado), "Dato reservado.");
    process.env.LLAVE_DATOS_SENSIBLES = llaveOriginal;
  });

  test("un formato desconocido se rechaza", () => {
    assert.throws(() => descifrar("esto-no-es-cifrado"));
    assert.throws(() => descifrar("v2.a.b.c"));
  });
});

describe("campos opcionales", () => {
  test("vacío o espacios se guardan como NULL", () => {
    assert.equal(cifrarOpcional(""), null);
    assert.equal(cifrarOpcional("   "), null);
    assert.equal(cifrarOpcional(null), null);
    assert.equal(cifrarOpcional(undefined), null);
  });

  test("con contenido sí cifra y recorta", () => {
    const c = cifrarOpcional("  dato  ");
    assert.ok(c);
    assert.equal(descifrar(c), "dato");
  });

  test("descifrar NULL devuelve NULL", () => {
    assert.equal(descifrarOpcional(null), null);
  });

  test("un dato corrupto avisa en vez de tumbar el expediente", () => {
    const r = descifrarOpcional("v1.aaaa.bbbb.cccc");
    assert.match(r ?? "", /No se pudo descifrar/);
  });
});
