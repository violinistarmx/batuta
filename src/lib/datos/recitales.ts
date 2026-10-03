import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, boletos, cargos, docentes, inscripciones, instrumentos,
  participaciones, programas, recitales, secuencias, usuarios,
} from "@/db/schema/index";
import {
  formatearFolioBoleto, motivoParaRechazarConfirmacion, motivoParaRechazarPropuesta,
  motivoParaRechazarRechazo, motivoParaRechazarVenta, problemasDelOrden,
  type EstadoParticipacion, type EstadoRecital,
} from "@/lib/dominio/recitales";
import type { Alcance } from "@/lib/auth/permisos";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Lo vencido de un alumno: lo que impide confirmar su participación. */
const ADEUDO_VENCIDO = (alumnoId: number, hoy: string) => db
  .select({
    t: sql<number>`coalesce(sum(
      cargos.monto_centavos - coalesce((
        SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
      ), 0)
    ), 0)`,
  })
  .from(cargos)
  .where(and(
    eq(cargos.alumnoId, alumnoId),
    eq(cargos.cancelado, false),
    sql`cargos.vence_el < ${hoy}`,
  ))
  .get()?.t ?? 0;

export type DatosRecital = {
  nombre: string;
  fecha: string;
  hora: string;
  sede: string;
  direccionSede: string | null;
  capacidad: number | null;
  precioBoletoCentavos: number;
  notas: string | null;
};

export function crearRecital(d: DatosRecital, usuarioId: number): number {
  const fila = db.insert(recitales).values({ ...d, creadoPor: usuarioId })
    .returning({ id: recitales.id }).get();
  if (!fila) throw new Error("No se pudo crear el recital.");
  return fila.id;
}

export function recitalPorId(id: number) {
  return db.select().from(recitales).where(eq(recitales.id, id)).get();
}

export function listarRecitales() {
  return db
    .select({
      id: recitales.id,
      nombre: recitales.nombre,
      fecha: recitales.fecha,
      hora: recitales.hora,
      sede: recitales.sede,
      estado: recitales.estado,
      capacidad: recitales.capacidad,
      precioBoletoCentavos: recitales.precioBoletoCentavos,
      confirmadas: sql<number>`(
        SELECT count(*) FROM participaciones pa
        WHERE pa.recital_id = recitales.id AND pa.estado = 'confirmada'
      )`,
      propuestas: sql<number>`(
        SELECT count(*) FROM participaciones pa
        WHERE pa.recital_id = recitales.id AND pa.estado = 'propuesta'
      )`,
      vendidos: sql<number>`coalesce((
        SELECT sum(bo.cantidad) FROM boletos bo
        WHERE bo.recital_id = recitales.id AND bo.cancelado = 0
      ), 0)`,
    })
    .from(recitales)
    .orderBy(desc(recitales.fecha))
    .all();
}

export function cambiarEstadoRecital(id: number, estado: EstadoRecital): void {
  db.transaction((tx) => {
    const r = tx.select({ estado: recitales.estado }).from(recitales)
      .where(eq(recitales.id, id)).get();
    if (!r) throw new Error("El recital no existe.");

    // Cerrar el programa es el momento en que se imprime: el orden tiene que
    // estar completo y sin repeticiones, porque después ya no se corrige.
    if (estado === "programa_cerrado") {
      const numeros = tx.select({
        participacionId: participaciones.id,
        orden: participaciones.orden,
        duracionMinutos: participaciones.duracionMinutos,
      })
        .from(participaciones)
        .where(and(eq(participaciones.recitalId, id), eq(participaciones.estado, "confirmada")))
        .all();

      if (numeros.length === 0) throw new Error("No hay ninguna participación confirmada.");
      const problemas = problemasDelOrden(numeros);
      if (problemas.length > 0) throw new Error(problemas.join(" "));
    }

    tx.update(recitales).set({ estado }).where(eq(recitales.id, id)).run();
  });
}

// -------------------------------------------------------- participaciones ---

export type DatosPropuesta = {
  recitalId: number;
  inscripcionId: number;
  pieza: string;
  compositor: string | null;
  duracionMinutos: number | null;
  notas: string | null;
};

/**
 * El maestro propone. No se mira el adeudo aquí: no ve finanzas, y rechazarle la
 * propuesta por una deuda que no puede consultar sería un error sin salida.
 */
export function proponer(d: DatosPropuesta, usuarioId: number): number {
  return db.transaction((tx) => {
    const r = tx.select({ estado: recitales.estado }).from(recitales)
      .where(eq(recitales.id, d.recitalId)).get();
    if (!r) throw new Error("El recital no existe.");

    const i = tx.select({
      id: inscripciones.id,
      alumnoId: inscripciones.alumnoId,
      docenteId: inscripciones.docenteId,
      estado: inscripciones.estado,
    }).from(inscripciones).where(eq(inscripciones.id, d.inscripcionId)).get();
    if (!i) throw new Error("La inscripción no existe.");

    const ya = tx.select({ n: sql<number>`count(*)` })
      .from(participaciones)
      .where(and(
        eq(participaciones.recitalId, d.recitalId),
        eq(participaciones.alumnoId, i.alumnoId),
        sql`lower(participaciones.pieza) = lower(${d.pieza})`,
        sql`participaciones.estado <> 'cancelada'`,
      )).get()?.n ?? 0;

    const motivo = motivoParaRechazarPropuesta({
      estadoRecital: r.estado as EstadoRecital,
      inscripcionActiva: i.estado === "activa",
      yaParticipaConEstaPieza: ya > 0,
    });
    if (motivo) throw new Error(motivo);

    const fila = tx.insert(participaciones).values({
      recitalId: d.recitalId,
      alumnoId: i.alumnoId,
      inscripcionId: i.id,
      docenteId: i.docenteId,
      pieza: d.pieza,
      compositor: d.compositor,
      duracionMinutos: d.duracionMinutos,
      notas: d.notas,
      propuestaPor: usuarioId,
    }).returning({ id: participaciones.id }).get();
    if (!fila) throw new Error("No se pudo registrar la propuesta.");
    return fila.id;
  });
}

/** La dirección confirma. Aquí sí se mira el adeudo vencido. */
export function confirmar(participacionId: number, usuarioId: number, hoy: string): void {
  db.transaction((tx) => {
    const p = tx.select({
      id: participaciones.id,
      alumnoId: participaciones.alumnoId,
      estado: participaciones.estado,
      estadoRecital: recitales.estado,
    })
      .from(participaciones)
      .innerJoin(recitales, eq(recitales.id, participaciones.recitalId))
      .where(eq(participaciones.id, participacionId)).get();
    if (!p) throw new Error("La participación no existe.");

    const motivo = motivoParaRechazarConfirmacion({
      estadoParticipacion: p.estado as EstadoParticipacion,
      estadoRecital: p.estadoRecital as EstadoRecital,
      adeudoVencidoCentavos: ADEUDO_VENCIDO(p.alumnoId, hoy),
    });
    if (motivo) throw new Error(motivo);

    tx.update(participaciones).set({
      estado: "confirmada",
      motivoRechazo: null,
      confirmadaPor: usuarioId,
      confirmadaEn: new Date(),
    }).where(eq(participaciones.id, participacionId)).run();
  });
}

export function rechazar(participacionId: number, motivo: string | null): void {
  const problema = motivoParaRechazarRechazo(motivo);
  if (problema) throw new Error(problema);

  db.update(participaciones).set({
    estado: "rechazada",
    motivoRechazo: motivo,
    orden: null,
  }).where(eq(participaciones.id, participacionId)).run();
}

export function asignarOrden(participacionId: number, orden: number | null): void {
  db.update(participaciones).set({ orden })
    .where(eq(participaciones.id, participacionId)).run();
}

export function registrarAsistenciaRecital(participacionId: number, asistio: boolean): void {
  db.update(participaciones).set({ asistio })
    .where(eq(participaciones.id, participacionId)).run();
}

export type FilaParticipacion = {
  id: number;
  alumnoId: number;
  alumno: string;
  alumnoCodigo: string;
  docente: string;
  instrumento: string;
  programa: string;
  pieza: string;
  compositor: string | null;
  duracionMinutos: number | null;
  orden: number | null;
  estado: EstadoParticipacion;
  motivoRechazo: string | null;
  asistio: boolean | null;
  propuestaPor: string | null;
  /** Se llena solo para quien puede ver finanzas. */
  adeudoVencidoCentavos: number | null;
  /** El recital es donde más importa: hay fotos y video. */
  autorizaImagen: boolean;
};

export function participacionesDe(
  recitalId: number,
  alcance: Alcance,
  verFinanzas: boolean,
  hoy: string,
): FilaParticipacion[] {
  const filtro = alcance.tipo === "propio"
    ? (alcance.docenteId === null ? sql`0 = 1` : eq(participaciones.docenteId, alcance.docenteId))
    : undefined;

  const base = eq(participaciones.recitalId, recitalId);

  const filas = db
    .select({
      id: participaciones.id,
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      alumnoCodigo: alumnos.codigo,
      docente: docentes.nombre,
      instrumento: instrumentos.nombre,
      programa: programas.nombre,
      pieza: participaciones.pieza,
      compositor: participaciones.compositor,
      duracionMinutos: participaciones.duracionMinutos,
      orden: participaciones.orden,
      estado: participaciones.estado,
      motivoRechazo: participaciones.motivoRechazo,
      asistio: participaciones.asistio,
      propuestaPor: usuarios.nombre,
      autorizaImagen: sql<boolean>`coalesce((
        SELECT co.otorgado FROM consentimientos co
        WHERE co.alumno_id = alumnos.id AND co.tipo = 'uso_imagen'
      ), 0)`,
    })
    .from(participaciones)
    .innerJoin(alumnos, eq(alumnos.id, participaciones.alumnoId))
    .innerJoin(inscripciones, eq(inscripciones.id, participaciones.inscripcionId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(docentes, eq(docentes.id, participaciones.docenteId))
    .leftJoin(usuarios, eq(usuarios.id, participaciones.propuestaPor))
    .where(filtro ? and(base, filtro) : base)
    .orderBy(asc(sql`coalesce(participaciones.orden, 9999)`), asc(alumnos.nombre))
    .all();

  return filas.map((f) => ({
    ...f,
    adeudoVencidoCentavos: verFinanzas ? ADEUDO_VENCIDO(f.alumnoId, hoy) : null,
  }));
}

/** Inscripciones que este usuario puede proponer y todavía no están en el recital. */
export function candidatasParaRecital(recitalId: number, alcance: Alcance) {
  const filtro = alcance.tipo === "propio"
    ? (alcance.docenteId === null ? sql`0 = 1` : eq(inscripciones.docenteId, alcance.docenteId))
    : undefined;

  const base = eq(inscripciones.estado, "activa");

  return db
    .select({
      inscripcionId: inscripciones.id,
      alumno: alumnos.nombre,
      codigo: alumnos.codigo,
      instrumento: instrumentos.nombre,
      docente: docentes.nombre,
    })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(instrumentos, eq(instrumentos.id, inscripciones.instrumentoId))
    .innerJoin(docentes, eq(docentes.id, inscripciones.docenteId))
    .where(filtro ? and(base, filtro) : base)
    .orderBy(asc(alumnos.nombre))
    .all();
}

// --------------------------------------------------------------- taquilla ---

function siguienteFolio(tx: Tx, recitalId: number): string {
  const clave = `boleto:${recitalId}`;
  tx.insert(secuencias).values({ clave, valor: 0 }).onConflictDoNothing().run();
  const fila = tx.update(secuencias)
    .set({ valor: sql`${secuencias.valor} + 1` })
    .where(eq(secuencias.clave, clave))
    .returning({ valor: secuencias.valor }).get();
  return formatearFolioBoleto(recitalId, fila?.valor ?? 1);
}

export type DatosVenta = {
  recitalId: number;
  cantidad: number;
  compradorNombre: string;
  compradorTelefono: string | null;
  alumnoId: number | null;
  metodo: "efectivo" | "transferencia" | "tarjeta" | "deposito" | "cortesia" | "otro";
  vendidoEl: string;
};

/**
 * Vende boletos. El aforo se comprueba DENTRO de la transacción.
 *
 * Contarlo antes y vender después deja pasar dos ventas simultáneas que juntas
 * exceden la sala: son dos personas en taquilla, no una hipótesis.
 */
export function venderBoletos(d: DatosVenta, usuarioId: number): { id: number; folio: string; totalCentavos: number } {
  return db.transaction((tx) => {
    const r = tx.select({
      estado: recitales.estado,
      capacidad: recitales.capacidad,
      precio: recitales.precioBoletoCentavos,
    }).from(recitales).where(eq(recitales.id, d.recitalId)).get();
    if (!r) throw new Error("El recital no existe.");

    const vendidos = tx.select({ n: sql<number>`coalesce(sum(boletos.cantidad), 0)` })
      .from(boletos)
      .where(and(eq(boletos.recitalId, d.recitalId), eq(boletos.cancelado, false)))
      .get()?.n ?? 0;

    const motivo = motivoParaRechazarVenta(
      d.cantidad,
      { capacidad: r.capacidad, vendidos },
      r.estado as EstadoRecital,
    );
    if (motivo) throw new Error(motivo);

    // Una cortesía es un boleto de cero pesos, no una venta sin registrar: el
    // aforo tiene que contarla igual porque ocupa una silla.
    const precioUnitario = d.metodo === "cortesia" ? 0 : r.precio;
    const folio = siguienteFolio(tx, d.recitalId);

    const fila = tx.insert(boletos).values({
      recitalId: d.recitalId,
      folio,
      cantidad: d.cantidad,
      precioUnitarioCentavos: precioUnitario,
      totalCentavos: d.cantidad * precioUnitario,
      compradorNombre: d.compradorNombre,
      compradorTelefono: d.compradorTelefono,
      alumnoId: d.alumnoId,
      metodo: d.metodo,
      vendidoEl: d.vendidoEl,
      vendidoPor: usuarioId,
    }).returning({ id: boletos.id }).get();
    if (!fila) throw new Error("No se pudo registrar la venta.");

    return { id: fila.id, folio, totalCentavos: d.cantidad * precioUnitario };
  });
}

export function cancelarBoleto(id: number, motivo: string): void {
  if (!motivo.trim()) throw new Error("Escribe por qué se cancela.");
  db.update(boletos).set({ cancelado: true, motivoCancelacion: motivo })
    .where(eq(boletos.id, id)).run();
}

export function boletosDe(recitalId: number) {
  return db
    .select({
      id: boletos.id,
      folio: boletos.folio,
      cantidad: boletos.cantidad,
      totalCentavos: boletos.totalCentavos,
      compradorNombre: boletos.compradorNombre,
      compradorTelefono: boletos.compradorTelefono,
      metodo: boletos.metodo,
      vendidoEl: boletos.vendidoEl,
      cancelado: boletos.cancelado,
      motivoCancelacion: boletos.motivoCancelacion,
      vendedor: usuarios.nombre,
    })
    .from(boletos)
    .leftJoin(usuarios, eq(usuarios.id, boletos.vendidoPor))
    .where(eq(boletos.recitalId, recitalId))
    .orderBy(desc(boletos.id))
    .all();
}

export type Taquilla = { vendidos: number; ingresoCentavos: number; cortesias: number };

export function taquillaDe(recitalId: number): Taquilla {
  const r = db.select({
    vendidos: sql<number>`coalesce(sum(boletos.cantidad), 0)`,
    ingreso: sql<number>`coalesce(sum(boletos.total_centavos), 0)`,
    cortesias: sql<number>`coalesce(sum(CASE WHEN boletos.metodo = 'cortesia' THEN boletos.cantidad ELSE 0 END), 0)`,
  })
    .from(boletos)
    .where(and(eq(boletos.recitalId, recitalId), eq(boletos.cancelado, false)))
    .get();

  return {
    vendidos: r?.vendidos ?? 0,
    ingresoCentavos: r?.ingreso ?? 0,
    cortesias: r?.cortesias ?? 0,
  };
}

/** Recitales próximos, para el tablero. */
export function proximosRecitales(hoy: string) {
  return db
    .select({
      id: recitales.id,
      nombre: recitales.nombre,
      fecha: recitales.fecha,
      estado: recitales.estado,
      propuestas: sql<number>`(
        SELECT count(*) FROM participaciones pa
        WHERE pa.recital_id = recitales.id AND pa.estado = 'propuesta'
      )`,
    })
    .from(recitales)
    .where(and(
      sql`recitales.fecha >= ${hoy}`,
      sql`recitales.estado NOT IN ('cancelado','realizado')`,
    ))
    .orderBy(asc(recitales.fecha))
    .all();
}
