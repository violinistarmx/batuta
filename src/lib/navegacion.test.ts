import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  rutaInicialDeAjustes, rutaInicialDeFinanzas, seccionActiva, seccionesDeAjustes, seccionesDeFinanzas,
} from "./navegacion.ts";

const con = (...permisos: string[]) => (p: string) => permisos.includes(p);
const hrefs = (g: { secciones: { href: string }[] }[]) => g.flatMap((x) => x.secciones.map((s) => s.href));

describe("secciones de Ajustes", () => {
  test("el director ve todo, agrupado", () => {
    const g = seccionesDeAjustes(con("configuracion.gestionar", "usuarios.gestionar", "bitacora.leer"));
    assert.deepEqual(g.map((x) => x.titulo), ["Reglas de la academia", "Equipo", "Academia", "Seguridad"]);
    assert.equal(hrefs(g).length, 7);
  });

  test("quien solo tiene sesión ve únicamente el catálogo", () => {
    assert.deepEqual(hrefs(seccionesDeAjustes(con())), ["/catalogo"]);
  });

  test("sin permiso, la sección ni aparece", () => {
    const h = hrefs(seccionesDeAjustes(con("usuarios.gestionar")));
    assert.ok(h.includes("/usuarios") && !h.includes("/bitacora") && !h.includes("/ajustes/contrato"));
  });

  test("«Ajustes» en el menú lleva a la primera sección propia; el catálogo solo no cuenta", () => {
    assert.equal(rutaInicialDeAjustes(con("configuracion.gestionar")), "/ajustes/contrato");
    assert.equal(rutaInicialDeAjustes(con("bitacora.leer")), "/bitacora");
    assert.equal(rutaInicialDeAjustes(con()), null);
  });
});

describe("secciones de Finanzas", () => {
  const director = con("finanzas.leer", "productos.gestionar", "gastos.gestionar", "nomina.leer", "reportes.leer", "configuracion.gestionar");

  test("siguen el orden panorama → ingresos → egresos → análisis → reglas", () => {
    assert.deepEqual(seccionesDeFinanzas(director).map((x) => x.titulo), [
      "Panorama", "Ingresos · lo que entra", "Egresos · lo que sale", "Análisis", "Reglas",
    ]);
  });

  test("lo que se consulta junto vive en el mismo grupo", () => {
    const g = seccionesDeFinanzas(director);
    const de = (titulo: string) => hrefs([g.find((x) => x.titulo.startsWith(titulo))!]);
    assert.deepEqual(de("Ingresos"), ["/finanzas/cobranza", "/finanzas/productos"]);
    assert.deepEqual(de("Egresos"), ["/finanzas/gastos", "/finanzas/nomina", "/finanzas/tarifas"]);
  });

  test("un grupo sin secciones permitidas desaparece", () => {
    const h = seccionesDeFinanzas(con("finanzas.leer"));
    assert.deepEqual(h.map((x) => x.titulo), ["Panorama", "Ingresos · lo que entra"]);
    assert.deepEqual(hrefs(h), ["/finanzas", "/finanzas/cobranza"]);
  });

  test("cada ruta de Finanzas apunta a una sola sección", () => {
    const todas = hrefs(seccionesDeFinanzas(director));
    assert.equal(new Set(todas).size, todas.length);
  });

  test("«Finanzas» en el menú lleva a lo primero que la cuenta puede abrir", () => {
    assert.equal(rutaInicialDeFinanzas(director), "/finanzas");
    assert.equal(rutaInicialDeFinanzas(con("reportes.leer")), "/finanzas/reportes");
    assert.equal(rutaInicialDeFinanzas(con("configuracion.gestionar")), null);
  });
});

describe("sección activa", () => {
  const g = seccionesDeFinanzas(con("finanzas.leer", "gastos.gestionar", "nomina.leer", "productos.gestionar", "reportes.leer"));

  test("la raíz no se come a las demás", () => {
    assert.equal(seccionActiva(g, "/finanzas"), "/finanzas");
    assert.equal(seccionActiva(g, "/finanzas/cobranza"), "/finanzas/cobranza");
  });

  test("las subpantallas marcan su sección", () => {
    assert.equal(seccionActiva(g, "/finanzas/gastos/nuevo"), "/finanzas/gastos");
    assert.equal(seccionActiva(g, "/finanzas/gastos/editar"), "/finanzas/gastos");
  });

  test("gana la más específica", () => {
    assert.equal(seccionActiva(g, "/finanzas/gastos/categorias"), "/finanzas/gastos/categorias");
  });

  test("una ruta ajena no marca nada", () => {
    assert.equal(seccionActiva(g, "/alumnos"), null);
  });

  test("en Ajustes, las subpantallas del catálogo y de cuentas marcan su sección", () => {
    const a = seccionesDeAjustes(con("configuracion.gestionar", "usuarios.gestionar", "bitacora.leer"));
    assert.equal(seccionActiva(a, "/catalogo/programas/3"), "/catalogo");
    assert.equal(seccionActiva(a, "/usuarios/12"), "/usuarios");
    assert.equal(seccionActiva(a, "/ajustes/finanzas"), "/ajustes/finanzas");
  });
});
