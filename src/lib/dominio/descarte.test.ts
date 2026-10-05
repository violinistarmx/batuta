import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { motivoParaNoDescartar, type SituacionDescarte } from "./descarte.ts";

const limpia: SituacionDescarte = {
  pagosRegistrados: 0,
  clasesConAsistenciaOFalta: 0,
  prestamosRegistrados: 0,
  participacionesEnRecitales: 0,
};

const con = (cambios: Partial<SituacionDescarte>): SituacionDescarte => ({ ...limpia, ...cambios });

describe("descarte · cuándo se puede borrar a un alumno", () => {
  it("sin ningún rastro real, se puede descartar", () => {
    assert.equal(motivoParaNoDescartar(limpia), null);
  });

  it("con un pago registrado, no se puede: hay que dar de baja", () => {
    const motivo = motivoParaNoDescartar(con({ pagosRegistrados: 1 }));
    assert.match(motivo ?? "", /pagos registrados/);
    assert.match(motivo ?? "", /Dar de baja/);
  });

  it("con una clase ya tomada, no se puede", () => {
    const motivo = motivoParaNoDescartar(con({ clasesConAsistenciaOFalta: 1 }));
    assert.match(motivo ?? "", /asistencia o falta/);
  });

  it("con un préstamo de instrumento, no se puede", () => {
    const motivo = motivoParaNoDescartar(con({ prestamosRegistrados: 1 }));
    assert.match(motivo ?? "", /préstamos/);
  });

  it("con una participación en un recital, no se puede", () => {
    const motivo = motivoParaNoDescartar(con({ participacionesEnRecitales: 1 }));
    assert.match(motivo ?? "", /recital/);
  });

  it("revisa pagos antes que lo demás: es el impedimento más serio", () => {
    const motivo = motivoParaNoDescartar(con({ pagosRegistrados: 1, clasesConAsistenciaOFalta: 1 }));
    assert.match(motivo ?? "", /pagos registrados/);
  });
});
