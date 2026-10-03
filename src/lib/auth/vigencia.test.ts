import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ABSOLUTO_MS, INACTIVIDAD_MS, evaluarVigencia, type DatosSesion } from "./vigencia.ts";

const AHORA = new Date("2026-09-18T15:00:00Z");
const hace = (ms: number) => new Date(AHORA.getTime() - ms);
const dentroDe = (ms: number) => new Date(AHORA.getTime() + ms);

function sesion(p: Partial<DatosSesion> = {}): DatosSesion {
  return {
    expiraEn: dentroDe(ABSOLUTO_MS),
    ultimaActividadEn: hace(1000),
    revocadaEn: null,
    usuarioActivo: true,
    ...p,
  };
}

describe("vigencia de sesión", () => {
  test("una sesión recién usada está vigente", () => {
    const r = evaluarVigencia(sesion(), AHORA);
    assert.equal(r.vigente, true);
  });

  test("a los 29 minutos de inactividad sigue viva", () => {
    const r = evaluarVigencia(sesion({ ultimaActividadEn: hace(29 * 60 * 1000) }), AHORA);
    assert.equal(r.vigente, true);
  });

  test("pasados los 30 minutos de inactividad se cierra", () => {
    const r = evaluarVigencia(
      sesion({ ultimaActividadEn: hace(INACTIVIDAD_MS + 1000) }),
      AHORA,
    );
    assert.equal(r.vigente, false);
    assert.equal(r.vigente === false && r.motivo, "inactividad");
  });

  test("el cierre absoluto manda aunque haya actividad constante", () => {
    const r = evaluarVigencia(
      sesion({ expiraEn: hace(1000), ultimaActividadEn: hace(1000) }),
      AHORA,
    );
    assert.equal(r.vigente, false);
    assert.equal(r.vigente === false && r.motivo, "expirada");
  });

  test("justo en el instante del cierre absoluto ya no vale", () => {
    const r = evaluarVigencia(sesion({ expiraEn: AHORA }), AHORA);
    assert.equal(r.vigente, false);
  });

  test("una sesión revocada no revive", () => {
    const r = evaluarVigencia(sesion({ revocadaEn: hace(60_000) }), AHORA);
    assert.equal(r.vigente, false);
    assert.equal(r.vigente === false && r.motivo, "revocada");
  });

  test("desactivar al usuario corta el acceso sin esperar la caducidad", () => {
    const r = evaluarVigencia(sesion({ usuarioActivo: false }), AHORA);
    assert.equal(r.vigente, false);
    assert.equal(r.vigente === false && r.motivo, "usuario_inactivo");
  });
});

describe("throttle de actividad", () => {
  test("no reescribe si la actividad es de hace segundos", () => {
    const r = evaluarVigencia(sesion({ ultimaActividadEn: hace(5_000) }), AHORA);
    assert.equal(r.vigente && r.refrescarActividad, false);
  });

  test("reescribe si pasó más de un minuto", () => {
    const r = evaluarVigencia(sesion({ ultimaActividadEn: hace(90_000) }), AHORA);
    assert.equal(r.vigente && r.refrescarActividad, true);
  });
});
