import assert from "node:assert/strict";
import test from "node:test";

import {
  debeCambiarPassword, motivoParaNoCambiarRol, motivoParaNoDesactivar,
  normalizarCorreo, problemasDelCambio, type CuentaResumen,
} from "./usuarios.ts";

const dir = (id: number, activo = true): CuentaResumen => ({ id, rol: "director", activo });
const doc = (id: number, activo = true): CuentaResumen => ({ id, rol: "docente", activo });

test("nadie se desactiva a sí mismo", () => {
  const todas = [dir(1), dir(2)];
  assert.match(motivoParaNoDesactivar(dir(1), 1, todas) ?? "", /tu propia cuenta/i);
});

test("no se desactiva al único director", () => {
  // Es peor que cerrarse la puerta uno mismo: no lo nota quien lo provoca, lo
  // descubre el siguiente que intenta entrar.
  const todas = [dir(1), doc(2)];
  assert.match(motivoParaNoDesactivar(dir(1), 2, todas) ?? "", /único director/i);
});

test("con otro director sí se puede desactivar", () => {
  const todas = [dir(1), dir(2), doc(3)];
  assert.equal(motivoParaNoDesactivar(dir(1), 2, todas), null);
});

test("un director inactivo no cuenta como respaldo", () => {
  const todas = [dir(1), dir(2, false)];
  assert.match(motivoParaNoDesactivar(dir(1), 3, todas) ?? "", /único director/i);
});

test("desactivar a un maestro no tiene guardia", () => {
  assert.equal(motivoParaNoDesactivar(doc(2), 1, [dir(1), doc(2)]), null);
});

test("una cuenta ya desactivada no se desactiva dos veces", () => {
  assert.match(motivoParaNoDesactivar(doc(2, false), 1, [dir(1)]) ?? "", /ya está desactivada/i);
});

test("la misma guardia al cambiar de rol", () => {
  const todas = [dir(1), doc(2)];
  assert.match(motivoParaNoCambiarRol(dir(1), "docente", 2, todas) ?? "", /único director/i);
  assert.match(motivoParaNoCambiarRol(dir(1), "docente", 1, todas) ?? "", /a ti mismo/i);
});

test("dejar el rol como estaba nunca es problema", () => {
  assert.equal(motivoParaNoCambiarRol(dir(1), "director", 1, [dir(1)]), null);
});

test("ascender a alguien a director siempre se puede", () => {
  assert.equal(motivoParaNoCambiarRol(doc(2), "director", 1, [dir(1), doc(2)]), null);
});

test("una contraseña sin cambiar es la que generó el sistema", () => {
  assert.equal(debeCambiarPassword(null), true);
  assert.equal(debeCambiarPassword(new Date()), false);
});

const fuerte = { valida: true, problemas: [] };

test("el cambio exige la contraseña actual", () => {
  const p = problemasDelCambio("", "violin1-pachuca", "violin1-pachuca", fuerte);
  assert.match(p.join(" "), /contraseña actual/i);
});

test("las dos nuevas tienen que coincidir", () => {
  const p = problemasDelCambio("vieja12345678", "violin1-pachuca", "violin2-pachuca", fuerte);
  assert.match(p.join(" "), /no coinciden/i);
});

test("la nueva tiene que ser distinta de la actual", () => {
  const p = problemasDelCambio("violin1-pachuca", "violin1-pachuca", "violin1-pachuca", fuerte);
  assert.match(p.join(" "), /distinta de la actual/i);
});

test("arrastra los problemas de fuerza", () => {
  const p = problemasDelCambio("vieja12345678", "corta", "corta", {
    valida: false, problemas: ["Debe tener al menos 12 caracteres."],
  });
  assert.match(p.join(" "), /12 caracteres/);
});

test("un cambio correcto no reporta nada", () => {
  assert.deepEqual(problemasDelCambio("vieja12345678", "violin1-pachuca", "violin1-pachuca", fuerte), []);
});

test("los correos se normalizan a minúsculas", () => {
  assert.equal(normalizarCorreo("  Juan@VioliniStar.MX "), "juan@violinistar.mx");
  assert.equal(normalizarCorreo("sin-arroba"), null);
  assert.equal(normalizarCorreo("a@b"), null);
  assert.equal(normalizarCorreo(""), null);
});
