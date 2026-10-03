import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CANDADOS, OPCIONES, advertencias, esDinero, esEditable, grupoDe, validarValor,
} from "./ajustes.ts";

describe("ajustes · cómo se agrupa", () => {
  it("lo que viene del contrato se separa de lo que decide dirección", () => {
    assert.equal(grupoDe({ clave: "horas_aviso_baja", fuente: "Contrato cláusula 12ª" }), "contrato");
    assert.equal(grupoDe({ clave: "tarifa_docente_hora_centavos", fuente: "Dirección" }), "direccion");
  });

  it("los datos de la academia van aparte aunque su fuente diga «Contrato»", () => {
    // El domicilio sale impreso en la nota de remisión: es un dato, no una regla.
    assert.equal(grupoDe({ clave: "academia_domicilio", fuente: "Contrato" }), "institucional");
    assert.equal(grupoDe({ clave: "recibo_prefijo_folio", fuente: "Dirección" }), "institucional");
  });

  it("sin fuente se trata como decisión de dirección", () => {
    assert.equal(grupoDe({ clave: "lo_que_sea", fuente: null }), "direccion");
  });
});

describe("ajustes · lo que no se toca", () => {
  it("la zona horaria y el prefijo de folio quedan bajo candado", () => {
    assert.equal(esEditable("zona_horaria"), false);
    assert.equal(esEditable("recibo_prefijo_folio"), false);
    assert.equal(esEditable("horas_aviso_posposicion"), true);
  });

  it("cada candado explica por qué lo está", () => {
    for (const [clave, motivo] of Object.entries(CANDADOS)) {
      assert.ok(motivo.length > 30, `${clave} sin explicación`);
    }
  });
});

describe("ajustes · validación", () => {
  it("el dinero se captura en pesos y se guarda en centavos", () => {
    assert.deepEqual(
      validarValor("tarifa_docente_hora_centavos", "entero", "135.50"),
      { ok: true, valor: "13550" },
    );
    assert.deepEqual(
      validarValor("costo_inscripcion_centavos", "entero", "0"),
      { ok: true, valor: "0" },
    );
  });

  it("un importe negativo no pasa", () => {
    const r = validarValor("tarifa_docente_hora_centavos", "entero", "-5");
    assert.equal(r.ok, false);
  });

  it("un entero que no es de dinero no se multiplica por cien", () => {
    assert.deepEqual(validarValor("cubiculos", "entero", "3"), { ok: true, valor: "3" });
  });

  it("un entero con decimales se rechaza en vez de redondearse a escondidas", () => {
    const r = validarValor("cubiculos", "entero", "2.5");
    assert.equal(r.ok, false);
  });

  it("los decimales aceptan la proporción de falta sin aviso", () => {
    assert.deepEqual(validarValor("factor_falta_sin_aviso", "decimal", "0.75"), { ok: true, valor: "0.75" });
  });

  it("un booleano solo admite true o false", () => {
    assert.deepEqual(validarValor("excepcion_requiere_motivo", "booleano", "true"), { ok: true, valor: "true" });
    assert.equal(validarValor("excepcion_requiere_motivo", "booleano", "sí").ok, false);
  });

  it("un texto vacío se rechaza: un domicilio en blanco se imprimiría en blanco", () => {
    assert.equal(validarValor("academia_domicilio", "texto", "   ").ok, false);
  });

  it("los valores cerrados se eligen de su lista", () => {
    assert.deepEqual(validarValor("anclaje_ciclo", "texto", "mes_natural"), { ok: true, valor: "mes_natural" });
    assert.equal(validarValor("anclaje_ciclo", "texto", "cuando_sea").ok, false);
  });

  it("todas las opciones declaradas son válidas para su clave", () => {
    for (const [clave, opciones] of Object.entries(OPCIONES)) {
      for (const o of opciones) {
        assert.equal(validarValor(clave, "texto", o.valor).ok, true, `${clave}=${o.valor}`);
      }
    }
  });

  it("solo son dinero las claves que terminan en _centavos", () => {
    assert.equal(esDinero("costo_inscripcion_centavos"), true);
    assert.equal(esDinero("cubiculos"), false);
  });
});

describe("ajustes · advertencias antes de guardar", () => {
  it("cobrar inscripción contradice el contrato y lo dice", () => {
    const a = advertencias("costo_inscripcion_centavos", "0", "50000");
    assert.equal(a.length, 1);
    assert.match(a[0]!, /cláusula 2ª/);
  });

  it("cambiar la tarifa avisa que no recalcula lo ya pagado", () => {
    assert.match(advertencias("tarifa_docente_hora_centavos", "12000", "13500")[0]!, /ya calculados/);
  });

  it("bajar cubículos avisa de las clases encimadas; subirlos no", () => {
    assert.equal(advertencias("cubiculos", "3", "2").length, 1);
    assert.equal(advertencias("cubiculos", "2", "3").length, 0);
  });

  it("las reglas del contrato siempre recuerdan que el tutor tiene el texto anterior", () => {
    assert.match(advertencias("horas_aviso_baja", "72", "48")[0]!, /contrato firmado/);
  });

  it("guardar el mismo valor no advierte nada", () => {
    assert.deepEqual(advertencias("costo_inscripcion_centavos", "0", "0"), []);
  });
});
