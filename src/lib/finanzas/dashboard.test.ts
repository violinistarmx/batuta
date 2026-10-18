import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { armarDashboard } from "./dashboard.ts";
import { SIN_FILTROS, type Hechos, type OpcionesDashboard } from "./tipos.ts";

const D = { programaId: 1, instrumentoId: 10, docenteId: 100, sedeId: 1000 };
const D2 = { programaId: 2, instrumentoId: 10, docenteId: 100, sedeId: 1000 };

const hechos: Hechos = {
  ingresos: [
    { mes: "2026-09", ...D, centavos: 200_000 },
    { mes: "2026-10", ...D, centavos: 300_000 },
    { mes: "2026-10", ...D2, centavos: 100_000 },
    // Saldo a favor: cuenta en el total, no se atribuye.
    { mes: "2026-10", programaId: null, instrumentoId: null, docenteId: null, sedeId: null, centavos: 10_000 },
  ],
  clases: [
    // Octubre: 10 h asistidas en programa 1 a $120 = $1,200; una falta sin aviso = $90.
    ...Array.from({ length: 10 }, () => ({
      mes: "2026-10", ...D, estado: "asistio" as const, minutos: 60,
      tarifaDocente: null, tarifaPrograma: null, importePartida: null,
    })),
    { mes: "2026-10", ...D, estado: "falta" as const, minutos: 60, tarifaDocente: null, tarifaPrograma: null, importePartida: null },
    // Programa 2: Family Duet, 2 h reales con tarifa propia de $150 = $300.
    { mes: "2026-10", ...D2, estado: "asistio" as const, minutos: 120, tarifaDocente: 15_000, tarifaPrograma: null, importePartida: null },
    // Septiembre: 5 h = $600.
    ...Array.from({ length: 5 }, () => ({
      mes: "2026-09", ...D, estado: "asistio" as const, minutos: 60,
      tarifaDocente: null, tarifaPrograma: null, importePartida: null,
    })),
  ],
  nomina: [{ mes: "2026-10", ...D, centavos: 60_000 }],
  gastos: [
    { mes: "2026-10", categoriaId: 1, subcategoria: null, tipo: "fijo", sedeId: null, programaId: null, centavos: 100_000 },
    { mes: "2026-10", categoriaId: 2, subcategoria: "Instagram", tipo: "variable", sedeId: null, programaId: null, centavos: 20_000 },
  ],
  cargos: [{ mes: "2026-10", ...D, facturado: 500_000, saldado: 400_000, producto: false }],
  productos: [],
  inscripciones: [
    { id: 1, alumnoId: 1, ...D, fechaInicio: "2026-01-10", fechaFin: null, origen: "recomendacion" },
    { id: 2, alumnoId: 2, ...D, fechaInicio: "2026-02-01", fechaFin: "2026-10-05", origen: null },
    { id: 3, alumnoId: 3, ...D2, fechaInicio: "2026-10-03", fechaFin: null, origen: "instagram" },
    { id: 4, alumnoId: 4, ...D, fechaInicio: "2026-10-08", fechaFin: null, origen: "instagram" },
  ],
  catalogos: {
    programas: [{ id: 1, nombre: "Allegro Virtuoso" }, { id: 2, nombre: "Family Duet" }],
    instrumentos: [{ id: 10, nombre: "Violín" }],
    sedes: [{ id: 1000, nombre: "Mineral de la Reforma" }],
    docentes: [{ id: 100, nombre: "Mtra. Rosalba" }],
    categorias: [
      { id: 1, nombre: "Arrendamiento", color: "#6366f1", clave: null },
      { id: 2, nombre: "Publicidad y marketing", color: "#f27405", clave: "publicidad" },
    ],
  },
};

const op: OpcionesDashboard = {
  periodo: { modo: "mes", mes: "2026-10" },
  comparacion: "anterior",
  filtros: SIN_FILTROS,
  hoy: "2026-10-18",
  nomina: { tarifaHoraCentavos: 12_000, factorFaltaSinAviso: 0.75, factorFaltaJustificada: 0 },
  metas: {
    costoDocenteMax: 0.45, margenNetoMin: 0.2, margenBrutoMin: 0.45, cobranzaMin: 0.9,
    retencionMin: 0.9, cacMaxCentavos: 50_000, tolerancia: 0.1,
  },
  profitFirst: { activo: true, porcentajes: { ganancia: 0.05, sueldo: 0.5, impuestos: 0.15, operacion: 0.3 } },
};

const valor = (d: ReturnType<typeof armarDashboard>, clave: string) => d.kpis.find((k) => k.clave === clave)!;

describe("armarDashboard", () => {
  const d = armarDashboard(hechos, op);

  it("ingresos del mes incluyen el saldo a favor; comparan contra septiembre", () => {
    const k = valor(d, "ingresos");
    assert.equal(k.valor, 410_000);
    assert.equal(k.anterior, 200_000);
    assert.equal(d.comparacion.etiqueta, "vs septiembre 2026");
  });

  it("costo docente: horas reales × tarifa, falta sin aviso al 75 %, Family Duet 2 h", () => {
    assert.equal(valor(d, "costo_docente").valor, 120_000 + 9_000 + 30_000);
  });

  it("por cobrar y cobranza", () => {
    const k = valor(d, "por_cobrar");
    assert.equal(k.valor, 100_000);
    assert.match(k.detalle!, /Cobranza 80 %/);
    assert.equal(k.semaforo, "rojo");
  });

  it("margen neto = (ingresos − costo docente − gastos) / ingresos", () => {
    const esperado = (410_000 - 159_000 - 120_000) / 410_000;
    assert.equal(valor(d, "margen_neto").valor, esperado);
  });

  it("flujo de caja usa la nómina pagada, no la devengada", () => {
    assert.equal(valor(d, "flujo").valor, 410_000 - 60_000 - 120_000);
  });

  it("alumnos activos, altas, bajas, retención y CAC", () => {
    const k = valor(d, "alumnos");
    // Inician octubre: 1 y 2. Cierran (18 oct): 1, 3 y 4. Retención 1/2.
    assert.equal(k.valor, 3);
    assert.match(k.detalle!, /Retención 50 % · 2 altas, 1 bajas/);
    // Dos alumnos nuevos en octubre, $200 de publicidad → $100 cada uno.
    assert.equal(valor(d, "cac").valor, 10_000);
    const ig = d.canales.find((c) => c.canal === "instagram")!;
    assert.equal(ig.nuevos, 2);
    assert.equal(ig.gasto, 20_000);
  });

  it("rentabilidad por programa ordenada por margen", () => {
    assert.equal(d.programas[0]!.nombre, "Allegro Virtuoso");
    assert.equal(d.programas[0]!.margen, 300_000 - 129_000);
    assert.equal(d.programas[1]!.costoDocente, 30_000);
    assert.equal(d.programas[1]!.horas, 2);
  });

  it("matriz anual: costo docente y categorías con totales", () => {
    const fila = d.matriz.filas[0]!;
    assert.equal(fila.id, "costo_docente");
    assert.equal(fila.valores[8], 60_000);
    assert.equal(fila.valores[9], 159_000);
    assert.equal(d.matriz.total, 60_000 + 159_000 + 120_000);
  });

  it("serie: meses futuros marcados y flujo acumulado", () => {
    assert.equal(d.serie.length, 12);
    assert.equal(d.serie[10]!.futuro, true);
    assert.equal(d.serie[9]!.flujoAcumulado, 200_000 + 230_000);
  });

  it("filtro de programa excluye gastos generales y el saldo a favor", () => {
    const f = armarDashboard(hechos, { ...op, filtros: { ...SIN_FILTROS, programaId: 2 } });
    assert.equal(valor(f, "ingresos").valor, 100_000);
    assert.equal(valor(f, "costo_docente").valor, 30_000);
    assert.deepEqual(f.filtrosActivos, [{ dimension: "Programa", valor: "Family Duet" }]);
    // La gráfica por programa sigue mostrando todos para comparar.
    assert.equal(f.programas.length, 2);
  });

  it("modo año compara contra el año anterior y suma el año", () => {
    const a = armarDashboard(hechos, { ...op, periodo: { modo: "anio", anio: 2026 } });
    assert.equal(valor(a, "ingresos").valor, 610_000);
    assert.equal(a.comparacion.etiqueta, "vs 2025");
  });

  it("observaciones y Profit First presentes", () => {
    assert.ok(d.observaciones.length > 0);
    assert.equal(d.profitFirst!.length, 4);
  });
});

describe("productos en el dashboard", () => {
  const base = armarDashboard(hechos, op);
  const conProductos: Hechos = {
    ...hechos,
    productos: [
      // Método vendido en 600 con costo de 399: margen 201.
      { mes: "2026-10", sedeId: 1000, productoId: 7, nombre: "Método Suzuki Violín vol. 1", ingreso: 60_000, costo: 39_900, sinCosto: 0, unidades: 1 },
      // Concepto libre sin costo registrado: ingresa, pero su margen no se conoce.
      { mes: "2026-10", sedeId: 1000, productoId: null, nombre: "Libreta pautada", ingreso: 6_000, costo: 0, sinCosto: 6_000, unidades: 1 },
      { mes: "2026-09", sedeId: 1000, productoId: 7, nombre: "Método Suzuki Violín vol. 1", ingreso: 30_000, costo: 20_000, sinCosto: 0, unidades: 0.5 },
    ],
    cargos: [
      ...hechos.cargos,
      { mes: "2026-10", programaId: null, instrumentoId: null, docenteId: null, sedeId: 1000, facturado: 66_000, saldado: 66_000, producto: true },
    ],
  };
  const d = armarDashboard(conProductos, op);

  it("los productos suman al ingreso total y no cambian los ingresos de clases", () => {
    assert.equal(valor(d, "ingresos").valor, 410_000 + 66_000);
    assert.match(valor(d, "ingresos").detalle!, /Clases \$4,100\.00 · productos \$660\.00/);
    assert.equal(valor(d, "ingresos").anterior, 200_000 + 30_000);
  });

  it("el margen del producto es lo cobrado menos su costo; lo sin costo se avisa aparte", () => {
    const metodo = d.productos.filas.find((x) => x.id === 7)!;
    assert.equal(metodo.ingresos, 60_000);
    assert.equal(metodo.margen, 20_100);
    assert.equal(Math.round((metodo.margenPct ?? 0) * 1000) / 10, 33.5);
    assert.equal(d.productos.sinCosto, 6_000);
    assert.equal(d.productos.margen, 20_100);
    assert.ok(d.observaciones.some((o) => /sin costo registrado/.test(o)));
  });

  it("el costo de productos entra a los egresos, al margen bruto, al neto y al flujo", () => {
    const ingresos = 476_000;
    assert.equal(valor(d, "margen_bruto").valor, (ingresos - 159_000 - 39_900) / ingresos);
    assert.equal(valor(d, "margen_neto").valor, (ingresos - 159_000 - 39_900 - 120_000) / ingresos);
    assert.equal(valor(d, "flujo").valor, ingresos - 60_000 - 39_900 - 120_000);
  });

  it("el costo docente se sigue midiendo contra los ingresos de clases", () => {
    assert.equal(valor(d, "costo_docente").detalle, valor(base, "costo_docente").detalle);
  });

  it("el punto de equilibrio no cambia: los productos no son por alumno", () => {
    assert.deepEqual(d.equilibrio, base.equilibrio);
  });

  it("filtro «solo clases» deja el dashboard como estaba", () => {
    const c = armarDashboard(conProductos, { ...op, filtros: { ...SIN_FILTROS, linea: "clases" } });
    assert.equal(valor(c, "ingresos").valor, 410_000);
    assert.equal(valor(c, "margen_neto").valor, valor(base, "margen_neto").valor);
    assert.equal(c.productos.filas.length, 0);
    assert.deepEqual(c.filtrosActivos, [{ dimension: "Línea", valor: "Solo clases" }]);
  });

  it("filtro «solo productos» excluye clases y gastos generales", () => {
    const p = armarDashboard(conProductos, { ...op, filtros: { ...SIN_FILTROS, linea: "productos" } });
    assert.equal(valor(p, "ingresos").valor, 66_000);
    assert.equal(valor(p, "costo_docente").valor, 0);
    assert.equal(p.productos.margen, 20_100);
    assert.equal(valor(p, "flujo").valor, 66_000 - 39_900);
    // Por cobrar solo cuenta los cargos de producto.
    assert.equal(valor(p, "por_cobrar").valor, 0);
  });

  it("un filtro de programa, instrumento o maestro deja fuera los productos", () => {
    const f = armarDashboard(conProductos, { ...op, filtros: { ...SIN_FILTROS, programaId: 1 } });
    assert.equal(f.productos.filas.length, 0);
    assert.equal(valor(f, "ingresos").valor, 300_000);
  });

  it("el filtro de sede aplica a los productos por la sede donde se vendieron", () => {
    const otra = armarDashboard(conProductos, { ...op, filtros: { ...SIN_FILTROS, sedeId: 2000 } });
    assert.equal(otra.productos.filas.length, 0);
    const misma = armarDashboard(conProductos, { ...op, filtros: { ...SIN_FILTROS, sedeId: 1000 } });
    assert.equal(misma.productos.ingresos, 66_000);
  });

  it("la serie y la matriz llevan el costo de productos y siguen cuadrando", () => {
    assert.equal(d.serie[9]!.ingresosProductos, 66_000);
    assert.equal(d.serie[9]!.costoProductos, 39_900);
    assert.equal(d.serie[8]!.costoProductos, 20_000);
    const fila = d.matriz.filas.find((x) => x.id === "costo_productos")!;
    assert.equal(fila.total, 59_900);
    assert.equal(d.matriz.total, 60_000 + 159_000 + 59_900 + 120_000);
    assert.equal(d.matriz.filas.some((x) => x.id === "costo_productos"), true);
    assert.equal(base.matriz.filas.some((x) => x.id === "costo_productos"), false);
  });

  it("sin ventas de productos el dashboard queda igual que antes", () => {
    assert.equal(base.productos.filas.length, 0);
    assert.equal(base.productos.ingresos, 0);
  });
});
