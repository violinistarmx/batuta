/**
 * Datos de demostración para el dashboard de finanzas: doce meses de alumnos,
 * clases, cobros, nómina y gastos.
 *
 * SOLO para desarrollo. El script `npm run seed:finanzas` se niega a correr en
 * producción. Todo lo que crea queda marcado para poder borrarlo:
 * - alumnos con código `DEMO-…`
 * - maestros, aulas, programas e instrumentos con «(demo)» en el nombre
 * - gastos con concepto que empieza con «[DEMO]»
 *
 * Determinista: la misma semilla y la misma fecha producen los mismos datos.
 */

import type { Conexion } from "./cargar.ts";
import { limitesDeMes, ultimosMesesHasta } from "./fechas.ts";

export const MARCA = "(demo)";
const PREFIJO_CODIGO = "DEMO-";
const PREFIJO_GASTO = "[DEMO]";

// ── Azar reproducible ────────────────────────────────────────────────────────

function mulberry32(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Azar = ReturnType<typeof mulberry32>;
const entero = (r: Azar, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
function elegir<T>(r: Azar, opciones: [T, number][]): T {
  const total = opciones.reduce((s, [, p]) => s + p, 0);
  let x = r() * total;
  for (const [v, p] of opciones) if ((x -= p) <= 0) return v;
  return opciones[opciones.length - 1]![0];
}

// ── Fechas ───────────────────────────────────────────────────────────────────

const dos = (n: number) => String(n).padStart(2, "0");
function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const x = new Date(Date.UTC(a!, m! - 1, d! + dias));
  return `${x.getUTCFullYear()}-${dos(x.getUTCMonth() + 1)}-${dos(x.getUTCDate())}`;
}
/** 16:00 en México (UTC−6) como segundos Unix. */
function instante(fecha: string, minutosExtra = 0): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Math.floor(Date.UTC(a!, m! - 1, d!, 22, minutosExtra) / 1000);
}
const menor = (a: string, b: string) => (a < b ? a : b);

// ── Utilidades SQL ───────────────────────────────────────────────────────────

function insertar(cx: Conexion, tabla: string, fila: Record<string, unknown>): number {
  const cols = Object.keys(fila);
  const r = cx.prepare(
    `INSERT INTO ${tabla} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  ).run(...cols.map((c) => fila[c] ?? null));
  return Number(r.lastInsertRowid);
}

const filas = (cx: Conexion, sql: string, ...p: unknown[]) =>
  cx.prepare(sql).all(...p) as Record<string, unknown>[];

// ── Catálogos ────────────────────────────────────────────────────────────────

type Programa = { id: number; precio: number; clases: number; minutos: number; peso: number };

const PROGRAMAS_DEMO = [
  { clave: "demo_plan_clase", nombre: `Plan por Clase ${MARCA}`, clases: 1, minutos: 60, precio: 20_000, peso: 10 },
  { clave: "demo_andante", nombre: `Allegro Andante ${MARCA}`, clases: 4, minutos: 60, precio: 75_000, peso: 40 },
  { clave: "demo_virtuoso", nombre: `Allegro Virtuoso ${MARCA}`, clases: 8, minutos: 60, precio: 150_000, peso: 25 },
  { clave: "demo_presto", nombre: `Presto Virtuoso ${MARCA}`, clases: 8, minutos: 120, precio: 250_000, peso: 10 },
  { clave: "demo_family", nombre: `Family Duet ${MARCA}`, clases: 4, minutos: 120, precio: 145_000, peso: 15 },
];

function programas(cx: Conexion): Programa[] {
  const existentes = filas(cx, `
    SELECT p.id, p.clases_por_ciclo AS clases, p.minutos_por_clase AS minutos,
      p.alumnos_incluidos AS alumnos,
      (SELECT pv.precio_centavos FROM precios_vigencia pv
        WHERE pv.programa_id = p.id AND pv.vigente_hasta IS NULL) AS precio
    FROM programas p WHERE p.activo = 1 ORDER BY p.orden`);
  if (existentes.length > 0) {
    return existentes.map((p, i) => ({
      id: Number(p.id),
      clases: Math.min(8, Number(p.clases)),
      minutos: Number(p.minutos),
      // En los planes familiares cada hermano tiene su inscripción: el precio se reparte.
      precio: Math.round(Number(p.precio ?? 75_000) / Math.max(1, Number(p.alumnos ?? 1))),
      peso: i === 1 ? 40 : i === 2 ? 25 : 10,
    }));
  }
  return PROGRAMAS_DEMO.map((p, orden) => ({
    id: insertar(cx, "programas", {
      clave: p.clave, nombre: p.nombre, descripcion: "Programa de demostración",
      clases_por_ciclo: p.clases, minutos_por_clase: p.minutos, orden: 100 + orden,
    }),
    clases: p.clases, minutos: p.minutos, precio: p.precio, peso: p.peso,
  }));
}

function instrumentos(cx: Conexion): number[] {
  const ids = filas(cx, "SELECT id FROM instrumentos ORDER BY orden").map((r) => Number(r.id));
  if (ids.length > 0) return ids.slice(0, 5);
  return ["Violín", "Piano", "Guitarra", "Canto"].map((n, orden) =>
    insertar(cx, "instrumentos", { nombre: `${n} ${MARCA}`, orden: 100 + orden }));
}

/** Un aula por sede; crea una de demostración en cada sede que no tenga. */
function aulasPorSede(cx: Conexion): { sedeId: number; aulaId: number; peso: number }[] {
  const sedes = filas(cx, "SELECT id, nombre FROM sedes WHERE activo = 1 ORDER BY orden");
  return sedes.map((s, i) => {
    const aula = filas(cx, "SELECT id FROM aulas WHERE sede_id = ? ORDER BY id LIMIT 1", s.id)[0];
    const aulaId = aula ? Number(aula.id) : insertar(cx, "aulas", { nombre: `Aula ${s.nombre} ${MARCA}`, sede_id: s.id });
    return { sedeId: Number(s.id), aulaId, peso: i === 0 ? 70 : 15 };
  });
}

const CATEGORIA_LEGADA: Record<string, string> = {
  "Arrendamiento": "renta", "Servicios": "servicios", "Materiales educativos": "material",
  "Publicidad y marketing": "publicidad",
};

// ── Siembra ──────────────────────────────────────────────────────────────────

export type ResumenDemo = {
  alumnos: number; inscripciones: number; clases: number; pagos: number;
  cortesNomina: number; gastos: number; ventasProductos: number; meses: string[];
};

export function sembrarDemo(cx: Conexion, hoy: string, semilla = 2026): ResumenDemo {
  const ya = filas(cx, `SELECT count(*) AS n FROM alumnos WHERE codigo LIKE '${PREFIJO_CODIGO}%'`)[0];
  if (Number(ya?.n ?? 0) > 0) {
    throw new Error("Ya hay datos de demostración. Bórralos primero con `npm run seed:finanzas -- --limpiar`.");
  }

  const r = mulberry32(semilla);
  const meses = ultimosMesesHasta(hoy.slice(0, 7), 12);
  const resumen: ResumenDemo = { alumnos: 0, inscripciones: 0, clases: 0, pagos: 0, cortesNomina: 0, gastos: 0, ventasProductos: 0, meses };

  const leerConfig = (clave: string, omision: number) => {
    const v = filas(cx, "SELECT valor FROM configuracion WHERE clave = ?", clave)[0]?.valor;
    const n = Number(v);
    return v === undefined || !Number.isFinite(n) ? omision : n;
  };
  const tarifaGlobal = leerConfig("tarifa_docente_hora_centavos", 12_000);
  const factorFalta = leerConfig("factor_falta_sin_aviso", 0.75);
  const factorJustificada = leerConfig("factor_falta_justificada", 0);

  cx.exec("BEGIN");
  try {
    const progs = programas(cx);
    const instrs = instrumentos(cx);
    const aulas = aulasPorSede(cx);
    if (aulas.length === 0) throw new Error("No hay sedes. Corre primero las migraciones.");

    // Maestros de demostración. Dos con tarifa propia; uno la cambia a mitad del año.
    const NOMBRES = ["Ana López", "Bruno Díaz", "Carla Méndez", "Diego Ruiz", "Elena Soto"];
    const docentes = NOMBRES.map((n) => insertar(cx, "docentes", { nombre: `${n} ${MARCA}` }));
    const inicioDemo = `${meses[0]}-01`;
    insertar(cx, "tarifas_docente", { docente_id: docentes[0], tarifa_hora_centavos: 15_000, vigente_desde: inicioDemo });
    const cambio = `${meses[6]}-01`;
    insertar(cx, "tarifas_docente", {
      docente_id: docentes[1], tarifa_hora_centavos: 12_000, vigente_desde: inicioDemo,
      vigente_hasta: sumarDias(cambio, -1),
    });
    insertar(cx, "tarifas_docente", { docente_id: docentes[1], tarifa_hora_centavos: 13_500, vigente_desde: cambio });

    const tarifaDe = (docenteId: number, fecha: string): number | null => {
      const t = filas(cx, `SELECT tarifa_hora_centavos AS t FROM tarifas_docente
        WHERE docente_id = ? AND vigente_desde <= ? AND (vigente_hasta IS NULL OR vigente_hasta >= ?)
        ORDER BY vigente_desde DESC LIMIT 1`, docenteId, fecha, fecha)[0];
      return t ? Number(t.t) : null;
    };

    // ── Alumnos e inscripciones ──────────────────────────────────────────────
    type Insc = {
      id: number; alumnoId: number; programa: Programa; docenteId: number; aulaId: number;
      inicio: string; fin: string | null;
    };
    const inscs: Insc[] = [];
    let consecutivo = 0;

    const darDeAlta = (inicio: string) => {
      consecutivo++;
      const codigo = `${PREFIJO_CODIGO}${String(consecutivo).padStart(4, "0")}`;
      const origen = elegir(r, [
        ["instagram", 35], ["recomendacion", 30], ["whatsapp", 12], ["facebook", 8],
        ["google", 7], ["paso_por_la_calle", 5], ["otro", 3],
      ]);
      const alumnoId = insertar(cx, "alumnos", {
        codigo, qr_token: `demo${semilla}${consecutivo}${Math.floor(r() * 1e9)}`,
        nombre: `Alumno ${consecutivo} ${MARCA}`, fecha_inscripcion: inicio, origen,
      });
      const programa = elegir(r, progs.map((p) => [p, p.peso] as [Programa, number]));
      const docenteId = docentes[entero(r, 0, docentes.length - 1)]!;
      const aula = elegir(r, aulas.map((a) => [a, a.peso] as [typeof a, number]));
      const id = insertar(cx, "inscripciones", {
        alumno_id: alumnoId, programa_id: programa.id, instrumento_id: instrs[entero(r, 0, instrs.length - 1)],
        docente_id: docenteId, fecha_inicio: inicio,
      });
      inscs.push({ id, alumnoId, programa, docenteId, aulaId: aula.aulaId, inicio, fin: null });
      resumen.alumnos++;
      resumen.inscripciones++;
    };

    // Base: 28 alumnos que ya estaban antes del primer mes.
    for (let i = 0; i < 28; i++) darDeAlta(sumarDias(`${meses[0]}-01`, -entero(r, 10, 200)));

    for (const mes of meses) {
      const [ini, finMes] = limitesDeMes(mes);
      const fin = menor(finMes, hoy);
      if (ini > hoy) break;
      // Bajas: cada inscripción activa tiene 4 % de probabilidad de terminar este mes.
      for (const x of inscs) {
        if (x.fin === null && x.inicio < ini && r() < 0.04) {
          x.fin = sumarDias(ini, entero(r, 0, Math.max(0, Number(fin.slice(8)) - 1)));
          // El aviso se dio 72 h antes de la fecha de efecto (cláusula 12ª).
          const aviso = Math.floor(Date.parse(`${x.fin}T12:00:00Z`) / 1000) - 3 * 86_400;
          cx.prepare("UPDATE inscripciones SET fecha_fin = ?, aviso_baja_en = ?, estado = 'finalizada' WHERE id = ?").run(x.fin, aviso, x.id);
        }
      }
      // Altas: de 3 a 6 alumnos nuevos al mes.
      for (let i = entero(r, 3, 6); i > 0; i--) {
        darDeAlta(sumarDias(ini, entero(r, 0, Math.max(0, Number(fin.slice(8)) - 1))));
      }
    }

    // ── Ciclos, cargos, pagos y clases ───────────────────────────────────────
    type Clase = { id: number; docenteId: number; minutos: number; estado: string; fecha: string; programa: Programa };
    const clases: Clase[] = [];

    for (const x of inscs) {
      let numero = 0;
      for (const mes of meses) {
        const [ini, finMes] = limitesDeMes(mes);
        if (ini > hoy) break;
        const desde = x.inicio > ini ? x.inicio : ini;
        const hasta = x.fin !== null && x.fin < finMes ? x.fin : finMes;
        if (desde > hasta) continue;
        numero++;
        const p = x.programa;
        const cicloId = insertar(cx, "ciclos", {
          inscripcion_id: x.id, numero, inicia_el: desde, termina_el: hasta,
          clases_contratadas: p.clases, minutos_por_clase: p.minutos, precio_centavos: p.precio,
        });
        // Igual que la app: el ciclo emite sus clases y cada clase tomada o faltada sin aviso consume una.
        insertar(cx, "creditos_clase", { ciclo_id: cicloId, delta: p.clases, motivo: "emision_ciclo" });

        // Cargo de la mensualidad, vence el día 5 (o el día que empezó).
        const vence = desde > `${mes}-05` ? desde : `${mes}-05`;
        const cargoId = insertar(cx, "cargos", {
          alumno_id: x.alumnoId, inscripcion_id: x.id, ciclo_id: cicloId, concepto: "mensualidad",
          descripcion: `[DEMO] Mensualidad ${mes}`, monto_centavos: p.precio, vence_el: vence,
        });

        // Cobro: 92 % paga; de esos, 8 % abona solo una parte y 5 % recibe condonación.
        if (vence <= hoy && r() < 0.92) {
          const recibido = menor(sumarDias(vence, entero(r, -4, 7)), hoy);
          const condonado = r() < 0.05 ? 10_000 : 0;
          const parcial = r() < 0.08;
          const monto = parcial ? Math.round(p.precio * 0.6) : p.precio - condonado;
          const pagoId = insertar(cx, "pagos", {
            alumno_id: x.alumnoId, monto_centavos: monto, descuento_centavos: parcial ? 0 : condonado,
            metodo: elegir(r, [["transferencia", 60], ["efectivo", 30], ["tarjeta", 10]]),
            recibido_el: recibido < desde ? desde : recibido, referencia: "DEMO",
          });
          insertar(cx, "aplicaciones", {
            pago_id: pagoId, cargo_id: cargoId, monto_centavos: monto + (parcial ? 0 : condonado),
          });
          insertar(cx, "recibos", {
            folio: `DEMO-${String(pagoId).padStart(5, "0")}`, pago_id: pagoId, alumno_id: x.alumnoId,
          });
          resumen.pagos++;
        }

        // Clases repartidas en el mes a partir del día 2.
        const paso = Math.max(1, Math.floor(28 / p.clases));
        for (let k = 0; k < p.clases; k++) {
          const fecha = sumarDias(ini, 1 + k * paso);
          if (fecha < desde || fecha > hasta) continue;
          const pasada = fecha < hoy;
          const estado = pasada
            ? elegir(r, [["asistio", 85], ["falta", 7], ["falta_justificada", 6], ["cancelada", 2]])
            : "programada";
          const id = insertar(cx, "clases", {
            inscripcion_id: x.id, ciclo_id: cicloId, docente_id: x.docenteId, aula_id: x.aulaId,
            inicia_en: instante(fecha), termina_en: instante(fecha, p.minutos), minutos: p.minutos, estado,
          });
          if (estado === "asistio" || estado === "falta") {
            insertar(cx, "creditos_clase", {
              ciclo_id: cicloId, clase_id: id, delta: -1,
              motivo: estado === "asistio" ? "clase_tomada" : "falta_sin_aviso",
            });
          }
          clases.push({ id, docenteId: x.docenteId, minutos: p.minutos, estado, fecha, programa: p });
          resumen.clases++;
        }
      }
    }

    // ── Nómina: partidas y cortes pagados de los meses cerrados ──────────────
    const mesHoy = hoy.slice(0, 7);
    for (const mes of meses.filter((m) => m < mesHoy)) {
      const pagadoEl = sumarDias(limitesDeMes(mes)[1], 3);
      for (const docenteId of docentes) {
        const delMes = clases.filter((c) => c.docenteId === docenteId && c.fecha.startsWith(mes)
          && ["asistio", "falta", "falta_justificada"].includes(c.estado));
        if (delMes.length === 0) continue;
        const partidas = delMes.map((c) => {
          const tarifa = tarifaDe(docenteId, c.fecha) ?? tarifaGlobal;
          const factor = c.estado === "asistio" ? 1 : c.estado === "falta" ? factorFalta : factorJustificada;
          return { c, tarifa, factor, importe: Math.round((c.minutos / 60) * tarifa * factor) };
        });
        const total = partidas.reduce((s, p) => s + p.importe, 0);
        const nominaId = pagadoEl <= hoy
          ? insertar(cx, "nomina_pagos", {
              docente_id: docenteId, desde_el: limitesDeMes(mes)[0], hasta_el: limitesDeMes(mes)[1],
              total_centavos: total, clases: partidas.length, metodo: "transferencia", pagado_el: pagadoEl,
              nota: "DEMO",
            })
          : null;
        if (nominaId !== null) resumen.cortesNomina++;
        for (const p of partidas) {
          insertar(cx, "nomina_partidas", {
            clase_id: p.c.id, docente_id: docenteId, minutos: p.c.minutos, estado_clase: p.c.estado,
            tarifa_hora_centavos: p.tarifa, factor: String(p.factor), importe_centavos: p.importe,
            nomina_id: nominaId,
          });
        }
      }
    }

    // ── Productos: catálogo y ventas con su vale de entrega ──────────────────
    // Cada venta lleva sede, costo congelado y recibo, igual que las reales. Los códigos de
    // vale llevan «DEMO» para no chocar con la secuencia anual de los vales verdaderos.
    const CATALOGO_DEMO: [string, string, number, number, number][] = [
      ["Método Suzuki Violín vol. 1", "metodo", 60_000, 39_900, 25],
      ["Libreta pautada 20 pentagramas", "papeleria", 6_000, 2_500, 35],
      ["Cuerdas para violín (juego)", "accesorio", 45_000, 28_000, 20],
      ["Afinador digital", "accesorio", 18_000, 9_500, 15],
      ["Violín 1/2 de estudio", "instrumento", 380_000, 290_000, 5],
    ];
    const productosDemo = CATALOGO_DEMO.map(([nombre, categoria, precio, costo, peso]) => ({
      id: insertar(cx, "productos", {
        nombre: `${nombre} ${MARCA}`, categoria, precio_centavos: precio, costo_centavos: costo,
      }),
      nombre: `${nombre} ${MARCA}`, precio, costo, peso,
    }));
    const usuarioDemo = filas(cx, "SELECT id FROM usuarios ORDER BY id LIMIT 1")[0]?.id ?? null;
    let valeN = 0;
    for (const mes of meses) {
      const [ini, finMes] = limitesDeMes(mes);
      if (ini > hoy) break;
      for (let i = entero(r, 3, 8); i > 0; i--) {
        const x = inscs[entero(r, 0, inscs.length - 1)]!;
        if (x.inicio > finMes) continue;
        const p = elegir(r, productosDemo.map((q) => [q, q.peso] as [typeof q, number]));
        const aula = aulas[entero(r, 0, aulas.length - 1)]!;
        const vence = menor(sumarDias(ini, entero(r, 0, Math.max(0, Number(finMes.slice(8)) - 1))), hoy);
        // Una de cada diez libretas se vende como concepto libre, sin costo registrado.
        const libre = p.precio === 6_000 && r() < 0.1;
        const cargoId = insertar(cx, "cargos", {
          alumno_id: x.alumnoId, concepto: "producto", descripcion: libre ? `Libreta pautada ${MARCA}` : p.nombre,
          monto_centavos: p.precio, vence_el: vence, sede_id: aula.sedeId,
          producto_id: libre ? null : p.id, costo_centavos: libre ? null : p.costo,
        });
        valeN++;
        const pagado = r() < 0.9;
        const entregado = pagado && usuarioDemo !== null && r() < 0.8;
        insertar(cx, "vales_entrega", {
          codigo: `VE-DEMO-${String(valeN).padStart(6, "0")}`,
          token: `demovale${semilla}x${valeN}x${Math.floor(r() * 1e9)}`,
          cargo_id: cargoId,
          estado: entregado ? "entregado" : "pendiente",
          entregado_en: entregado ? instante(sumarDias(vence, 1)) : null,
          entregado_por: entregado ? usuarioDemo : null,
        });
        if (pagado) {
          const pagoId = insertar(cx, "pagos", {
            alumno_id: x.alumnoId, monto_centavos: p.precio, descuento_centavos: 0,
            metodo: elegir(r, [["efectivo", 60], ["transferencia", 40]]), recibido_el: vence, referencia: "DEMO",
          });
          insertar(cx, "aplicaciones", { pago_id: pagoId, cargo_id: cargoId, monto_centavos: p.precio });
          insertar(cx, "recibos", {
            folio: `DEMO-${String(pagoId).padStart(5, "0")}`, pago_id: pagoId, alumno_id: x.alumnoId,
          });
          resumen.pagos++;
        }
        resumen.ventasProductos++;
      }
    }

    // ── Gastos ───────────────────────────────────────────────────────────────
    const cats = new Map(filas(cx, "SELECT id, nombre FROM categorias_gasto").map((c) => [String(c.nombre), Number(c.id)]));
    const gasto = (fecha: string, categoria: string, concepto: string, monto: number,
      tipo: "fijo" | "variable", extra: { subcategoria?: string; sedeId?: number } = {}) => {
      if (fecha > hoy) return;
      insertar(cx, "gastos", {
        categoria: CATEGORIA_LEGADA[categoria] ?? "otro", categoria_id: cats.get(categoria) ?? null,
        concepto: `${PREFIJO_GASTO} ${concepto}`, monto_centavos: monto, fecha, tipo,
        subcategoria: extra.subcategoria ?? null, sede_id: extra.sedeId ?? null,
      });
      resumen.gastos++;
    };
    const RENTA = [800_000, 300_000, 250_000];
    for (const mes of meses) {
      const d = (n: number) => `${mes}-${dos(n)}`;
      aulas.forEach((a, i) => gasto(d(1), "Arrendamiento", "Renta del local", RENTA[i] ?? 200_000, "fijo", { sedeId: a.sedeId }));
      gasto(d(8), "Servicios", "Luz", entero(r, 60_000, 95_000), "fijo", { subcategoria: "Luz", sedeId: aulas[0]!.sedeId });
      gasto(d(8), "Servicios", "Internet", 59_900, "fijo", { subcategoria: "Internet", sedeId: aulas[0]!.sedeId });
      gasto(d(10), "Software/plataformas", "Plataformas", 89_900, "fijo", { subcategoria: "Suscripciones" });
      gasto(d(12), "Publicidad y marketing", "Anuncios Instagram", entero(r, 100_000, 250_000), "variable", { subcategoria: "Instagram" });
      if (r() < 0.6) gasto(d(14), "Publicidad y marketing", "Anuncios Facebook", entero(r, 50_000, 120_000), "variable", { subcategoria: "Facebook" });
      if (r() < 0.3) gasto(d(15), "Publicidad y marketing", "Google Ads", entero(r, 40_000, 90_000), "variable", { subcategoria: "Google" });
      gasto(d(16), "Materiales educativos", "Partituras y cuerdas", entero(r, 30_000, 120_000), "variable", { subcategoria: "Material" });
      gasto(d(20), "Comisiones y tarifas", "Comisión terminal", entero(r, 8_000, 25_000), "variable", { subcategoria: "Terminal" });
      gasto(d(25), "Administración", "Contador", 150_000, "fijo", { subcategoria: "Contabilidad" });
      gasto(d(18), "Gastos de oficina", "Papelería y limpieza", entero(r, 20_000, 60_000), "variable");
      if (r() < 0.25) gasto(d(22), "Honorarios docentes", "Músico invitado", entero(r, 80_000, 150_000), "variable", { subcategoria: "Invitados" });
    }

    // Períodos que ya vencieron se cierran como lo hace la app: lo que sobró de clases expira.
    cx.prepare(`INSERT INTO creditos_clase (ciclo_id, delta, motivo, nota)
      SELECT c.id, -s.total, 'expiracion_ciclo', 'Cierre del período (demo)'
      FROM ciclos c JOIN (SELECT ciclo_id, sum(delta) AS total FROM creditos_clase GROUP BY ciclo_id) s
        ON s.ciclo_id = c.id
      WHERE c.termina_el < ? AND c.estado = 'abierto' AND s.total > 0`).run(hoy);
    cx.prepare(`UPDATE ciclos SET estado = 'cerrado', cerrado_en = unixepoch()
      WHERE termina_el < ? AND estado = 'abierto'`).run(hoy);
    cx.exec("COMMIT");
  } catch (e) {
    cx.exec("ROLLBACK");
    throw e;
  }
  return resumen;
}

/** Borra todo lo creado por `sembrarDemo`. No toca datos reales. */
export function limpiarDemo(cx: Conexion): { alumnos: number; gastos: number } {
  const alumnosDemo = `SELECT id FROM alumnos WHERE codigo LIKE '${PREFIJO_CODIGO}%'`;
  const inscDemo = `SELECT id FROM inscripciones WHERE alumno_id IN (${alumnosDemo})`;
  const docentesDemo = `SELECT id FROM docentes WHERE nombre LIKE '%${MARCA}'`;
  const n = (sql: string) => Number((cx.prepare(sql).get() as { n: number } | undefined)?.n ?? 0);
  const alumnos = n(`SELECT count(*) AS n FROM alumnos WHERE codigo LIKE '${PREFIJO_CODIGO}%'`);
  const gastos = n(`SELECT count(*) AS n FROM gastos WHERE concepto LIKE '${PREFIJO_GASTO}%'`);

  cx.exec("BEGIN");
  try {
    cx.exec(`
      DELETE FROM nomina_partidas WHERE clase_id IN (SELECT id FROM clases WHERE inscripcion_id IN (${inscDemo}));
      DELETE FROM nomina_pagos WHERE docente_id IN (${docentesDemo});
      DELETE FROM recibos WHERE alumno_id IN (${alumnosDemo});
      DELETE FROM aplicaciones WHERE pago_id IN (SELECT id FROM pagos WHERE alumno_id IN (${alumnosDemo}));
      DELETE FROM pagos WHERE alumno_id IN (${alumnosDemo});
      DELETE FROM vales_entrega WHERE cargo_id IN (SELECT id FROM cargos WHERE alumno_id IN (${alumnosDemo}));
      DELETE FROM cargos WHERE alumno_id IN (${alumnosDemo});
      DELETE FROM productos WHERE nombre LIKE '%${MARCA}';
      DELETE FROM creditos_clase WHERE ciclo_id IN (SELECT id FROM ciclos WHERE inscripcion_id IN (${inscDemo}));
      DELETE FROM clases WHERE inscripcion_id IN (${inscDemo});
      DELETE FROM ciclos WHERE inscripcion_id IN (${inscDemo});
      DELETE FROM inscripciones WHERE alumno_id IN (${alumnosDemo});
      DELETE FROM alumnos WHERE codigo LIKE '${PREFIJO_CODIGO}%';
      DELETE FROM tarifas_docente WHERE docente_id IN (${docentesDemo});
      DELETE FROM docentes WHERE nombre LIKE '%${MARCA}';
      DELETE FROM gastos WHERE concepto LIKE '${PREFIJO_GASTO}%';
      DELETE FROM aulas WHERE nombre LIKE '%${MARCA}' AND id NOT IN (SELECT aula_id FROM clases WHERE aula_id IS NOT NULL);
      DELETE FROM programas WHERE nombre LIKE '%${MARCA}' AND id NOT IN (SELECT programa_id FROM inscripciones);
      DELETE FROM instrumentos WHERE nombre LIKE '%${MARCA}' AND id NOT IN (SELECT instrumento_id FROM inscripciones);
    `);
    cx.exec("COMMIT");
  } catch (e) {
    cx.exec("ROLLBACK");
    throw e;
  }
  return { alumnos, gastos };
}
