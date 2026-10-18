import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DISENO_INICIAL, agregarWidget, leerDiseno, ocultos, paletaDe, quitarWidget, tipoDe, validarDiseno,
} from "./diseno.ts";

describe("diseño del dashboard", () => {
  it("JSON roto o vacío vuelve al diseño inicial", () => {
    assert.equal(leerDiseno("{no es json"), DISENO_INICIAL);
    assert.equal(leerDiseno(null), DISENO_INICIAL);
    assert.equal(validarDiseno({ posiciones: [] }), DISENO_INICIAL);
  });

  it("descarta widgets desconocidos, duplicados y tamaños fuera de rango", () => {
    const d = validarDiseno({
      posiciones: [
        { i: "mensual", x: 0, y: 0, w: 8, h: 9 },
        { i: "mensual", x: 0, y: 9, w: 8, h: 9 },
        { i: "hackeo", x: 0, y: 0, w: 4, h: 4 },
        { i: "kpis", x: 0, y: 0, w: 2, h: 4 },
        { i: "flujo", x: 11, y: 3, w: 6, h: 7 },
      ],
    });
    assert.deepEqual(d.posiciones.map((p) => p.i), ["mensual", "flujo"]);
    // x se corrige para que el widget quepa en las 12 columnas.
    assert.equal(d.posiciones[1]!.x, 6);
  });

  it("sube a la altura mínima los diseños guardados con widgets más bajos", () => {
    const d = validarDiseno({ posiciones: [{ i: "kpis", x: 0, y: 0, w: 12, h: 6 }] });
    assert.equal(d.posiciones[0]!.h, 10);
  });

  it("solo acepta tipos de gráfica que tienen sentido para cada widget", () => {
    const d = validarDiseno({
      posiciones: DISENO_INICIAL.posiciones,
      tipos: { mensual: "lineas", categorias: "treemap", kpis: "barras" },
      paleta: "inventada",
    });
    assert.equal(tipoDe(d, "mensual"), "lineas");
    assert.equal(tipoDe(d, "categorias"), "dona");
    assert.equal(tipoDe(d, "kpis"), null);
    assert.equal(paletaDe(d).id, "violinistar");
  });

  it("agregar y quitar widgets", () => {
    const sinMatriz = quitarWidget(DISENO_INICIAL, "matriz");
    assert.ok(ocultos(sinMatriz).some((w) => w.id === "matriz"));
    const otraVez = agregarWidget(sinMatriz, "matriz");
    const m = otraVez.posiciones.find((p) => p.i === "matriz")!;
    assert.equal(m.w, 12);
    assert.ok(m.y >= Math.max(...sinMatriz.posiciones.map((p) => p.y + p.h)));
  });
});
