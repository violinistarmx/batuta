import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accionesPorGrupo, describir, resumirCambios,
} from "./bitacora.ts";

describe("bitácora · cómo se lee", () => {
  it("traduce una acción conocida a español", () => {
    assert.equal(describir("clase.asistencia").texto, "Registró asistencia");
    assert.equal(describir("clase.asistencia").grupo, "clases");
  });

  it("marca como delicado lo que se revisa con otros ojos", () => {
    assert.equal(describir("salud.leer").delicado, true);
    assert.equal(describir("pago.modificar").delicado, true);
    assert.equal(describir("respaldo.restaurar").delicado, true);
    assert.equal(describir("clase.asistencia").delicado, undefined);
  });

  it("una acción desconocida no rompe la pantalla", () => {
    // La bitácora es append-only: si mañana se registra una acción nueva, los
    // renglones viejos y los nuevos tienen que seguir viéndose.
    const d = describir("algo.que.no.existe");
    assert.equal(d.texto, "algo.que.no.existe");
    assert.equal(d.grupo, "sistema");
  });

  it("agrupa las acciones para el filtro, en el orden de los grupos", () => {
    const grupos = accionesPorGrupo();
    assert.equal(grupos[0]?.grupo, "acceso");
    assert.ok(grupos.some((g) => g.grupo === "dinero"));
    const dinero = grupos.find((g) => g.grupo === "dinero")!;
    assert.ok(dinero.acciones.some((a) => a.clave === "pago.registrar"));
  });

  it("todas las acciones del filtro se describen a sí mismas", () => {
    for (const g of accionesPorGrupo()) {
      for (const a of g.acciones) {
        assert.notEqual(describir(a.clave).texto, a.clave, `${a.clave} sin traducir`);
      }
    }
  });
});

describe("bitácora · el detalle de cada cambio", () => {
  it("un par [antes, después] se lee como una flecha", () => {
    const r = resumirCambios(JSON.stringify({ rol: ["docente", "asistente"] }));
    assert.deepEqual(r, [{ campo: "Rol", detalle: "docente → asistente" }]);
  });

  it("un valor suelto se muestra tal cual", () => {
    const r = resumirCambios(JSON.stringify({ motivo: "El alumno cambió de ciudad" }));
    assert.deepEqual(r, [{ campo: "Motivo", detalle: "El alumno cambió de ciudad" }]);
  });

  it("los booleanos se leen en español", () => {
    const r = resumirCambios(JSON.stringify({ activo: [true, false] }));
    assert.deepEqual(r, [{ campo: "Activa", detalle: "sí → no" }]);
  });

  it("nunca deja salir un hash ni un token, aunque estén guardados", () => {
    const r = resumirCambios(JSON.stringify({
      nombre: "Rosa", hashPassword: "$argon2id$v=19$...", qrToken: "abc123", password: "secreta",
    }));
    assert.deepEqual(r, [{ campo: "Nombre", detalle: "Rosa" }]);
  });

  it("sin cambios registrados no inventa renglones", () => {
    assert.deepEqual(resumirCambios(null), []);
    assert.deepEqual(resumirCambios("{}"), []);
  });

  it("un JSON roto se muestra crudo en vez de tirar la pantalla", () => {
    const r = resumirCambios("{no es json");
    assert.deepEqual(r, [{ campo: "Cambios", detalle: "{no es json" }]);
  });

  it("los nulos se ven como un guion, no como «null»", () => {
    const r = resumirCambios(JSON.stringify({ docenteId: [null, 4] }));
    assert.deepEqual(r, [{ campo: "Maestro", detalle: "— → 4" }]);
  });
});
