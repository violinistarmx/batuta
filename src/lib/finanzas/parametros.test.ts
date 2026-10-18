import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { escribirSeleccion, leerSeleccion, nombreReporte } from "./parametros.ts";

describe("selección en la URL", () => {
  it("por defecto: mes actual contra el anterior, sin filtros", () => {
    const s = leerSeleccion({}, "2026-10-18");
    assert.deepEqual(s.periodo, { modo: "mes", mes: "2026-10" });
    assert.equal(s.comparacion, "anterior");
    assert.equal(s.filtros.programaId, null);
  });

  it("lee modo año, comparación y filtros; ignora basura", () => {
    const s = leerSeleccion(
      { modo: "anio", anio: "2025", comparar: "anio_pasado", programa: "3", sede: "x", maestro: "-1" },
      "2026-10-18",
    );
    assert.deepEqual(s.periodo, { modo: "anio", anio: 2025 });
    assert.equal(s.comparacion, "anio_pasado");
    assert.equal(s.filtros.programaId, 3);
    assert.equal(s.filtros.sedeId, null);
    assert.equal(s.filtros.docenteId, null);
  });

  it("rechaza meses inválidos", () => {
    assert.deepEqual(leerSeleccion({ mes: "2026-13" }, "2026-10-18").periodo, { modo: "mes", mes: "2026-10" });
  });

  it("escribe la URL con cambios y quita filtros con null", () => {
    const s = leerSeleccion({ mes: "2026-09", programa: "2", sede: "1" }, "2026-10-18");
    assert.equal(escribirSeleccion(s, { filtros: { sedeId: null } }), "mes=2026-09&programa=2");
    assert.equal(escribirSeleccion(s, { periodo: { modo: "anio", anio: 2026 } }), "modo=anio&anio=2026&programa=2&sede=1");
  });

  it("nombre del reporte", () => {
    assert.equal(nombreReporte({ modo: "mes", mes: "2026-10" }), "Reporte_Finanzas_VioliniStar_2026-10.pdf");
    assert.equal(nombreReporte({ modo: "anio", anio: 2026 }), "Reporte_Finanzas_VioliniStar_2026.pdf");
  });
});
