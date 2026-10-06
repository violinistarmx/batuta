import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, aplicaciones, cargos, ciclos, clases, docentes, gastos, inscripciones,
  nominaPagos, nominaPartidas, pagos, programas, recibos, secuencias,
} from "@/db/schema/index";
import { costoDeClaseSql, parametrosNomina } from "@/lib/datos/costo-docente";
import { formatearFolio, planearAplicacion, type Cargo } from "@/lib/dominio/cobranza";
import { generaPartida, importeDocenteCentavos } from "@/lib/dominio/nomina";
import type { EstadoClase } from "@/lib/dominio/creditos";
import type { Alcance } from "@/lib/auth/permisos";
import { instanteEnMexico } from "@/lib/zona";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** «Renata», «Renata y Mateo», «Renata, Mateo y Sofía». */
function listaLegible(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  const ultimo = nombres[nombres.length - 1];
  return `${nombres.slice(0, -1).join(", ")} y ${ultimo}`;
}

/** Lo aplicado a un cargo, calculado. Nunca un campo guardado. */
const APLICADO = sql<number>`coalesce((
  SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
), 0)`;

// ------------------------------------------------------------------ cargos ---

/**
 * Genera la mensualidad de un período.
 *
 * Idempotente por el índice único: renovar dos veces por error no cobra el mes
 * dos veces. Si ya existe, devuelve el cargo que había.
 */
export function generarMensualidad(cicloId: number, usuarioId: number): number {
  return db.transaction((tx) => {
    const existente = tx.select({ id: cargos.id }).from(cargos)
      .where(and(
        eq(cargos.cicloId, cicloId),
        eq(cargos.concepto, "mensualidad"),
        eq(cargos.cancelado, false),
      )).get();
    if (existente) return existente.id;

    const ciclo = tx.select({
      id: ciclos.id,
      inscripcionId: ciclos.inscripcionId,
      iniciaEl: ciclos.iniciaEl,
      terminaEl: ciclos.terminaEl,
      precioCentavos: ciclos.precioCentavos,
      alumnoId: inscripciones.alumnoId,
      alumno: alumnos.nombre,
      programa: programas.nombre,
      cubiertaPorId: inscripciones.cubiertaPorId,
      alumnosIncluidos: programas.alumnosIncluidos,
    })
      .from(ciclos)
      .innerJoin(inscripciones, eq(inscripciones.id, ciclos.inscripcionId))
      .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
      .innerJoin(programas, eq(programas.id, inscripciones.programaId))
      .where(eq(ciclos.id, cicloId)).get();

    if (!ciclo) throw new Error("El período no existe.");

    // Un período cubierto por un plan familiar no genera cargo: su mensualidad ya
    // está en el del titular. Emitir un cargo de $0 ensuciaría la cobranza con
    // renglones que nadie debe y que habría que explicar en cada corte.
    if (ciclo.cubiertaPorId !== null || ciclo.precioCentavos === 0) return 0;

    // El cargo familiar nombra a quiénes cubre: el tutor recibe un recibo por
    // $1,450 y tiene que poder ver de un vistazo por quiénes está pagando.
    const cubiertos = ciclo.alumnosIncluidos > 1
      ? tx.select({ nombre: alumnos.nombre })
          .from(inscripciones)
          .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
          .where(eq(inscripciones.cubiertaPorId, ciclo.inscripcionId))
          .all().map((x) => x.nombre)
      : [];

    const fila = tx.insert(cargos).values({
      alumnoId: ciclo.alumnoId,
      inscripcionId: ciclo.inscripcionId,
      cicloId: ciclo.id,
      concepto: "mensualidad",
      descripcion: cubiertos.length > 0
        ? `${ciclo.programa} · ${listaLegible([ciclo.alumno, ...cubiertos])}`
        : ciclo.programa,
      periodo: `${ciclo.iniciaEl} al ${ciclo.terminaEl}`,
      montoCentavos: ciclo.precioCentavos,
      // Cláusula 3ª: el pago se hace al inicio de la primera clase del período.
      venceEl: ciclo.iniciaEl,
      creadoPor: usuarioId,
    }).returning({ id: cargos.id }).get();

    if (!fila) throw new Error("No se pudo generar el cargo.");
    return fila.id;
  });
}

/**
 * Reescribe el concepto del cargo familiar cuando entra o sale un hermano.
 *
 * El titular se inscribe primero, así que su cargo nace nombrando solo a él. Sin
 * esta puesta al día, el tutor recibiría un recibo de $1,450 que menciona a un solo
 * niño y tendría razón en preguntar por qué.
 *
 * Consecuencia aceptada: reimprimir un recibo viejo muestra la familia de hoy, no
 * la del día de la emisión. Es lo que la academia quiere cuando el tutor pregunta
 * «¿por quiénes pagué?», y el importe —que es lo que no puede cambiar— no se toca.
 */
export function sincronizarDescripcionFamiliar(titularInscripcionId: number): void {
  const t = db.select({
    alumno: alumnos.nombre,
    programa: programas.nombre,
    alumnosIncluidos: programas.alumnosIncluidos,
  })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .where(eq(inscripciones.id, titularInscripcionId)).get();

  if (!t || t.alumnosIncluidos <= 1) return;

  const cubiertos = db.select({ nombre: alumnos.nombre })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .where(eq(inscripciones.cubiertaPorId, titularInscripcionId))
    .orderBy(asc(alumnos.nombre))
    .all().map((x) => x.nombre);

  const descripcion = cubiertos.length > 0
    ? `${t.programa} · ${listaLegible([t.alumno, ...cubiertos])}`
    : t.programa;

  db.update(cargos).set({ descripcion })
    .where(and(
      eq(cargos.inscripcionId, titularInscripcionId),
      eq(cargos.concepto, "mensualidad"),
      eq(cargos.cancelado, false),
    )).run();
}

export function cargosDeAlumno(alumnoId: number) {
  return db
    .select({
      id: cargos.id,
      concepto: cargos.concepto,
      descripcion: cargos.descripcion,
      periodo: cargos.periodo,
      montoCentavos: cargos.montoCentavos,
      venceEl: cargos.venceEl,
      cancelado: cargos.cancelado,
      aplicadoCentavos: APLICADO,
      inscripcionId: cargos.inscripcionId,
    })
    .from(cargos)
    .where(and(eq(cargos.alumnoId, alumnoId), eq(cargos.cancelado, false)))
    .orderBy(asc(cargos.venceEl), asc(cargos.id))
    .all();
}

// ------------------------------------------------------------------- pagos ---

export type DatosPago = {
  alumnoId: number;
  montoCentavos: number;
  /** Condonación aprobada por el director. No es dinero real recibido. */
  descuentoCentavos?: number;
  metodo: "efectivo" | "transferencia" | "tarjeta" | "deposito" | "otro";
  recibidoEl: string;
  referencia: string | null;
  nota: string | null;
};

export type ResultadoPago = {
  pagoId: number;
  reciboId: number;
  folio: string;
  aplicadoCentavos: number;
  aFavorCentavos: number;
};

/** Consecutivo de folio por año, tomado dentro de la transacción del recibo. */
function siguienteFolio(tx: Tx, prefijo: string, anio: number): string {
  const clave = `recibo:${anio}`;
  tx.insert(secuencias).values({ clave, valor: 0 }).onConflictDoNothing().run();
  const fila = tx.update(secuencias)
    .set({ valor: sql`${secuencias.valor} + 1` })
    .where(eq(secuencias.clave, clave))
    .returning({ valor: secuencias.valor }).get();
  return formatearFolio(prefijo, anio, fila?.valor ?? 1);
}

/**
 * Registra un pago, lo reparte entre los cargos abiertos y emite su recibo.
 *
 * Todo en una transacción: un pago sin recibo obliga a explicar a mano por qué el
 * tutor no tiene comprobante, y un recibo sin pago cuadra mal la caja.
 */
export function registrarPago(d: DatosPago, usuarioId: number, prefijoFolio: string): ResultadoPago {
  return db.transaction((tx) => {
    const descuento = d.descuentoCentavos ?? 0;

    const pago = tx.insert(pagos).values({
      alumnoId: d.alumnoId,
      montoCentavos: d.montoCentavos,
      descuentoCentavos: descuento,
      metodo: d.metodo,
      recibidoEl: d.recibidoEl,
      referencia: d.referencia,
      nota: d.nota,
      registradoPor: usuarioId,
    }).returning({ id: pagos.id }).get();
    if (!pago) throw new Error("No se pudo registrar el pago.");

    const abiertos = tx
      .select({
        id: cargos.id,
        montoCentavos: cargos.montoCentavos,
        aplicadoCentavos: APLICADO,
        venceEl: cargos.venceEl,
      })
      .from(cargos)
      .where(and(eq(cargos.alumnoId, d.alumnoId), eq(cargos.cancelado, false)))
      .all() as Cargo[];

    // El plan distribuye dinero real + condonación como si fuera un solo pago.
    // Así el cargo queda saldado aunque el alumno haya pagado menos.
    const plan = planearAplicacion(d.montoCentavos + descuento, abiertos);

    for (const a of plan.asignaciones) {
      tx.insert(aplicaciones).values({
        pagoId: pago.id, cargoId: a.cargoId, montoCentavos: a.montoCentavos,
      }).run();
    }

    const anio = Number(d.recibidoEl.slice(0, 4));
    const folio = siguienteFolio(tx, prefijoFolio, anio);

    const recibo = tx.insert(recibos).values({
      folio, pagoId: pago.id, alumnoId: d.alumnoId, emitidoPor: usuarioId,
    }).returning({ id: recibos.id }).get();
    if (!recibo) throw new Error("No se pudo emitir el recibo.");

    const totalAplicado = d.montoCentavos + descuento - plan.aFavorCentavos;
    return {
      pagoId: pago.id,
      reciboId: recibo.id,
      folio,
      aplicadoCentavos: totalAplicado,
      aFavorCentavos: plan.aFavorCentavos,
    };
  });
}

export function pagosDeAlumno(alumnoId: number) {
  return db
    .select({
      id: pagos.id,
      montoCentavos: pagos.montoCentavos,
      metodo: pagos.metodo,
      recibidoEl: pagos.recibidoEl,
      referencia: pagos.referencia,
      folio: recibos.folio,
      reciboId: recibos.id,
    })
    .from(pagos)
    .leftJoin(recibos, eq(recibos.pagoId, pagos.id))
    .where(eq(pagos.alumnoId, alumnoId))
    .orderBy(desc(pagos.recibidoEl), desc(pagos.id))
    .all();
}

export function reciboPorId(id: number) {
  return db
    .select({
      id: recibos.id,
      folio: recibos.folio,
      emitidoEn: recibos.emitidoEn,
      pagoId: pagos.id,
      montoCentavos: pagos.montoCentavos,
      descuentoCentavos: pagos.descuentoCentavos,
      metodo: pagos.metodo,
      recibidoEl: pagos.recibidoEl,
      referencia: pagos.referencia,
      nota: pagos.nota,
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      alumnoCodigo: alumnos.codigo,
      alumnoTelefono: alumnos.telefono,
      alumnoDireccion: alumnos.direccion,
    })
    .from(recibos)
    .innerJoin(pagos, eq(pagos.id, recibos.pagoId))
    .innerJoin(alumnos, eq(alumnos.id, recibos.alumnoId))
    .where(eq(recibos.id, id))
    .get();
}

/**
 * Qué cargos saldó un pago: son los renglones del recibo.
 *
 * `aplicadoTotal` incluye pagos anteriores al mismo cargo, así que el saldo que
 * el recibo declara es el real y no solo lo que faltaba de este pago.
 */
export function renglonesDeRecibo(pagoId: number) {
  return db
    .select({
      descripcion: cargos.descripcion,
      concepto: cargos.concepto,
      periodo: cargos.periodo,
      montoCargo: cargos.montoCentavos,
      montoAplicado: aplicaciones.montoCentavos,
      aplicadoTotal: APLICADO,
    })
    .from(aplicaciones)
    .innerJoin(cargos, eq(cargos.id, aplicaciones.cargoId))
    .where(eq(aplicaciones.pagoId, pagoId))
    .all();
}

// ------------------------------------------------------------------ nómina ---

/**
 * Genera las partidas de nómina de las clases impartidas en un rango.
 *
 * Idempotente por el índice único sobre clase_id: correrlo dos veces no paga dos
 * veces. Las clases ya incluidas simplemente se saltan.
 */
export function generarNomina(
  desde: Date,
  hasta: Date,
  tarifaHoraCentavos: number,
  factorFaltaSinAviso: number,
): { creadas: number; omitidas: number } {
  const candidatas = db
    .select({
      id: clases.id,
      docenteId: clases.docenteId,
      minutos: clases.minutos,
      estado: clases.estado,
      tarifaPropia: docentes.tarifaHoraCentavos,
    })
    .from(clases)
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(and(gte(clases.iniciaEn, desde), lte(clases.iniciaEn, hasta)))
    .all();

  let creadas = 0;
  let omitidas = 0;

  db.transaction((tx) => {
    for (const c of candidatas) {
      const estado = c.estado as EstadoClase;
      if (!generaPartida(estado)) { omitidas++; continue; }

      const ya = tx.select({ id: nominaPartidas.id }).from(nominaPartidas)
        .where(eq(nominaPartidas.claseId, c.id)).get();
      if (ya) { omitidas++; continue; }

      const importe = importeDocenteCentavos(
        c.minutos, estado,
        { tarifaHoraCentavos, factorFaltaSinAviso },
        c.tarifaPropia,
      );

      tx.insert(nominaPartidas).values({
        claseId: c.id,
        docenteId: c.docenteId,
        minutos: c.minutos,
        estadoClase: estado,
        tarifaHoraCentavos: c.tarifaPropia ?? tarifaHoraCentavos,
        factor: estado === "asistio" ? "1" : String(factorFaltaSinAviso),
        importeCentavos: importe,
      }).run();
      creadas++;
    }
  });

  return { creadas, omitidas };
}

export function nominaPendientePorDocente(alcance: Alcance) {
  const filtro = alcance.tipo === "propio"
    ? (alcance.docenteId === null ? sql`0 = 1` : eq(nominaPartidas.docenteId, alcance.docenteId))
    : undefined;

  const base = isNull(nominaPartidas.nominaId);

  return db
    .select({
      docenteId: docentes.id,
      docente: docentes.nombre,
      clases: sql<number>`count(*)`,
      minutos: sql<number>`sum(nomina_partidas.minutos)`,
      totalCentavos: sql<number>`sum(nomina_partidas.importe_centavos)`,
    })
    .from(nominaPartidas)
    .innerJoin(docentes, eq(docentes.id, nominaPartidas.docenteId))
    .where(filtro ? and(base, filtro) : base)
    .groupBy(docentes.id, docentes.nombre)
    .orderBy(asc(docentes.nombre))
    .all();
}

export function partidasPendientesDe(docenteId: number) {
  return db
    .select({
      id: nominaPartidas.id,
      claseId: nominaPartidas.claseId,
      minutos: nominaPartidas.minutos,
      estadoClase: nominaPartidas.estadoClase,
      factor: nominaPartidas.factor,
      importeCentavos: nominaPartidas.importeCentavos,
      iniciaEn: clases.iniciaEn,
      alumno: alumnos.nombre,
    })
    .from(nominaPartidas)
    .innerJoin(clases, eq(clases.id, nominaPartidas.claseId))
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .where(and(eq(nominaPartidas.docenteId, docenteId), isNull(nominaPartidas.nominaId)))
    .orderBy(asc(clases.iniciaEn))
    .all();
}

/** Cierra el corte: marca las partidas como pagadas y las ata al pago. */
export function pagarNomina(
  docenteId: number,
  d: { desdeEl: string; hastaEl: string; pagadoEl: string; metodo: "efectivo" | "transferencia" | "deposito" | "otro"; nota: string | null },
  usuarioId: number,
): { nominaId: number; totalCentavos: number; clases: number } {
  return db.transaction((tx) => {
    const partidas = tx.select({ id: nominaPartidas.id, importe: nominaPartidas.importeCentavos })
      .from(nominaPartidas)
      .where(and(eq(nominaPartidas.docenteId, docenteId), isNull(nominaPartidas.nominaId)))
      .all();

    if (partidas.length === 0) throw new Error("Este maestro no tiene clases pendientes de pago.");

    const total = partidas.reduce((s, p) => s + p.importe, 0);

    const nomina = tx.insert(nominaPagos).values({
      docenteId,
      desdeEl: d.desdeEl,
      hastaEl: d.hastaEl,
      totalCentavos: total,
      clases: partidas.length,
      metodo: d.metodo,
      pagadoEl: d.pagadoEl,
      nota: d.nota,
      registradoPor: usuarioId,
    }).returning({ id: nominaPagos.id }).get();
    if (!nomina) throw new Error("No se pudo registrar el pago de nómina.");

    for (const p of partidas) {
      tx.update(nominaPartidas).set({ nominaId: nomina.id })
        .where(eq(nominaPartidas.id, p.id)).run();
    }

    return { nominaId: nomina.id, totalCentavos: total, clases: partidas.length };
  });
}

/**
 * Cortes ya pagados, del más reciente al más viejo.
 *
 * Cuando se cierra un corte, las partidas desaparecen de «pendiente de pago» y
 * con ellas cualquier rastro en pantalla. Sin esta lista, el director paga y no
 * le queda constancia de cuánto pagó, y el maestro no tiene dónde verificarlo.
 */
export function cortesDeNomina(alcance: Alcance, limite = 12) {
  const filtro = alcance.tipo === "propio"
    ? (alcance.docenteId === null ? sql`0 = 1` : eq(nominaPagos.docenteId, alcance.docenteId))
    : undefined;

  const q = db
    .select({
      id: nominaPagos.id,
      docente: docentes.nombre,
      desdeEl: nominaPagos.desdeEl,
      hastaEl: nominaPagos.hastaEl,
      pagadoEl: nominaPagos.pagadoEl,
      metodo: nominaPagos.metodo,
      clases: nominaPagos.clases,
      totalCentavos: nominaPagos.totalCentavos,
      nota: nominaPagos.nota,
    })
    .from(nominaPagos)
    .innerJoin(docentes, eq(docentes.id, nominaPagos.docenteId));

  return (filtro ? q.where(filtro) : q)
    .orderBy(desc(nominaPagos.pagadoEl), desc(nominaPagos.id))
    .limit(limite)
    .all();
}

// ------------------------------------------------------- resultado del mes ---

/**
 * Indicador administrativo, NO utilidad contable formal.
 *
 * El brief es explícito en no llamarlo utilidad mientras no exista contabilidad
 * fiscal integrada, y el nombre se respeta en toda la interfaz.
 */
export function resultadoAdministrativo(desde: string, hasta: string) {
  const ingresos = db.select({ t: sql<number>`coalesce(sum(monto_centavos), 0)` })
    .from(pagos).where(and(gte(pagos.recibidoEl, desde), lte(pagos.recibidoEl, hasta)))
    .get()?.t ?? 0;

  const nomina = db.select({ t: sql<number>`coalesce(sum(total_centavos), 0)` })
    .from(nominaPagos).where(and(gte(nominaPagos.pagadoEl, desde), lte(nominaPagos.pagadoEl, hasta)))
    .get()?.t ?? 0;

  const otrosGastos = db.select({ t: sql<number>`coalesce(sum(monto_centavos), 0)` })
    .from(gastos).where(and(gte(gastos.fecha, desde), lte(gastos.fecha, hasta)))
    .get()?.t ?? 0;

  // Nómina devengada aunque todavía no se haya pagado: sin esto, el resultado del
  // mes se ve inflado hasta que se hace el corte.
  //
  // Se calcula sobre las CLASES del periodo, no sobre las partidas de nómina. Leerlo
  // de `nomina_partidas` hacía que un mes sin corte apareciera con costo cero: el
  // resultado se veía perfecto precisamente porque nadie había calculado el corte.
  // Lo que ya está pagado sale de aquí y entra en `nominaPagada`, sin contarse dos
  // veces.
  const param = parametrosNomina();
  const nominaDevengada = db
    .select({
      t: sql<number>`coalesce(sum(${costoDeClaseSql(
        param.tarifaHoraCentavos, param.factorFaltaSinAviso,
      )}), 0)`,
    })
    .from(clases)
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(and(
      gte(clases.iniciaEn, instanteEnMexico(desde, "00:00")),
      lte(clases.iniciaEn, instanteEnMexico(hasta, "23:59")),
      sql`NOT EXISTS (
        SELECT 1 FROM nomina_partidas np
        WHERE np.clase_id = clases.id AND np.nomina_id IS NOT NULL
      )`,
    ))
    .get()?.t ?? 0;

  return {
    ingresosCentavos: ingresos,
    nominaPagadaCentavos: nomina,
    nominaPendienteCentavos: nominaDevengada,
    gastosCentavos: otrosGastos,
    resultadoCentavos: ingresos - nomina - nominaDevengada - otrosGastos,
  };
}

export function cobranzaGlobal() {
  return db
    .select({
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      codigo: alumnos.codigo,
      montoCentavos: cargos.montoCentavos,
      aplicadoCentavos: APLICADO,
      venceEl: cargos.venceEl,
      descripcion: cargos.descripcion,
      cargoId: cargos.id,
    })
    .from(cargos)
    .innerJoin(alumnos, eq(alumnos.id, cargos.alumnoId))
    .where(eq(cargos.cancelado, false))
    .orderBy(asc(cargos.venceEl))
    .all();
}
