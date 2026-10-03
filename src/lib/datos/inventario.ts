import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, ciclos, ejemplares, inscripciones, instrumentos, prestamos,
  programas, secuencias, usuarios,
} from "@/db/schema/index";
import {
  estadoTrasDevolucion, formatearCodigoInventario, motivoParaRechazarDevolucion,
  motivoParaRechazarPrestamo, type Condicion, type Incidencia,
} from "@/lib/dominio/inventario";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Folio del ejemplar, incrementado dentro de la transacción que lo crea. */
function siguienteCodigo(tx: Tx): string {
  tx.insert(secuencias).values({ clave: "ejemplar", valor: 0 }).onConflictDoNothing().run();
  const fila = tx.update(secuencias)
    .set({ valor: sql`${secuencias.valor} + 1` })
    .where(eq(secuencias.clave, "ejemplar"))
    .returning({ valor: secuencias.valor }).get();
  return formatearCodigoInventario(fila?.valor ?? 1);
}

export type DatosEjemplar = {
  instrumentoId: number;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  medida: string | null;
  condicion: Condicion;
  ubicacion: string | null;
  valorCentavos: number | null;
  adquiridoEl: string | null;
  notas: string | null;
};

export function crearEjemplar(d: DatosEjemplar, usuarioId: number): { id: number; codigo: string } {
  return db.transaction((tx) => {
    const codigo = siguienteCodigo(tx);
    const fila = tx.insert(ejemplares).values({ ...d, codigo, creadoPor: usuarioId })
      .returning({ id: ejemplares.id }).get();
    if (!fila) throw new Error("No se pudo dar de alta el ejemplar.");
    return { id: fila.id, codigo };
  });
}

export type FilaEjemplar = {
  id: number;
  codigo: string;
  instrumento: string;
  granFormato: boolean;
  marca: string | null;
  modelo: string | null;
  medida: string | null;
  estado: "disponible" | "prestado" | "en_reparacion" | "baja";
  condicion: Condicion;
  ubicacion: string | null;
  /** Quién lo tiene, cuando está prestado. */
  prestadoA: string | null;
  prestadoAId: number | null;
  terminaEl: string | null;
};

export function listarEjemplares(): FilaEjemplar[] {
  return db
    .select({
      id: ejemplares.id,
      codigo: ejemplares.codigo,
      instrumento: instrumentos.nombre,
      granFormato: instrumentos.granFormato,
      marca: ejemplares.marca,
      modelo: ejemplares.modelo,
      medida: ejemplares.medida,
      estado: ejemplares.estado,
      condicion: ejemplares.condicion,
      ubicacion: ejemplares.ubicacion,
      prestadoA: sql<string | null>`(
        SELECT a.nombre FROM prestamos p
        JOIN alumnos a ON a.id = p.alumno_id
        WHERE p.ejemplar_id = ejemplares.id AND p.devuelto_el IS NULL
      )`,
      prestadoAId: sql<number | null>`(
        SELECT p.alumno_id FROM prestamos p
        WHERE p.ejemplar_id = ejemplares.id AND p.devuelto_el IS NULL
      )`,
      terminaEl: sql<string | null>`(
        SELECT c.termina_el FROM prestamos p
        JOIN ciclos c ON c.id = p.ciclo_id
        WHERE p.ejemplar_id = ejemplares.id AND p.devuelto_el IS NULL
      )`,
    })
    .from(ejemplares)
    .innerJoin(instrumentos, eq(instrumentos.id, ejemplares.instrumentoId))
    .orderBy(asc(instrumentos.orden), asc(ejemplares.codigo))
    .all();
}

export function ejemplarPorId(id: number) {
  return db
    .select({
      id: ejemplares.id,
      codigo: ejemplares.codigo,
      instrumentoId: ejemplares.instrumentoId,
      instrumento: instrumentos.nombre,
      granFormato: instrumentos.granFormato,
      marca: ejemplares.marca,
      modelo: ejemplares.modelo,
      numeroSerie: ejemplares.numeroSerie,
      medida: ejemplares.medida,
      estado: ejemplares.estado,
      condicion: ejemplares.condicion,
      ubicacion: ejemplares.ubicacion,
      valorCentavos: ejemplares.valorCentavos,
      adquiridoEl: ejemplares.adquiridoEl,
      notas: ejemplares.notas,
    })
    .from(ejemplares)
    .innerJoin(instrumentos, eq(instrumentos.id, ejemplares.instrumentoId))
    .where(eq(ejemplares.id, id))
    .get();
}

/**
 * Inscripciones que HOY podrían recibir este ejemplar.
 *
 * Se resuelve aquí y no en la pantalla para que el selector no ofrezca alumnos que
 * el servidor va a rechazar: un menú con opciones inválidas enseña a desconfiar de
 * la pantalla.
 */
export function candidatasParaPrestamo(ejemplarId: number) {
  const e = ejemplarPorId(ejemplarId);
  if (!e || e.granFormato) return [];

  return db
    .select({
      inscripcionId: inscripciones.id,
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      codigo: alumnos.codigo,
      programa: programas.nombre,
      cicloId: ciclos.id,
      terminaEl: ciclos.terminaEl,
    })
    .from(inscripciones)
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(ciclos, and(eq(ciclos.inscripcionId, inscripciones.id), eq(ciclos.estado, "abierto")))
    .where(and(
      eq(inscripciones.estado, "activa"),
      eq(programas.permitePrestamoACasa, true),
      eq(inscripciones.instrumentoId, e.instrumentoId),
      // Quien ya tiene uno de este instrumento sin devolver no aparece.
      sql`NOT EXISTS (
        SELECT 1 FROM prestamos p
        JOIN ejemplares ej ON ej.id = p.ejemplar_id
        WHERE p.alumno_id = alumnos.id AND p.devuelto_el IS NULL
          AND ej.instrumento_id = ${e.instrumentoId}
      )`,
    ))
    .orderBy(asc(alumnos.nombre))
    .all();
}

export type DatosPrestamo = {
  ejemplarId: number;
  inscripcionId: number;
  entregadoEl: string;
  condicionSalida: Condicion;
  responsivaFirmada: boolean;
  notas: string | null;
};

/**
 * Entrega un ejemplar, comprobando la cláusula 9ª dentro de la transacción.
 *
 * Validar en la pantalla no basta: los ids viajan en el formulario. Y aunque el
 * código fallara, `ux_prestamo_abierto` impide que el mismo violín salga dos veces.
 */
export function prestar(d: DatosPrestamo, usuarioId: number): number {
  return db.transaction((tx) => {
    const e = tx.select({
      id: ejemplares.id,
      instrumentoId: ejemplares.instrumentoId,
      estado: ejemplares.estado,
      condicion: ejemplares.condicion,
      granFormato: instrumentos.granFormato,
    })
      .from(ejemplares)
      .innerJoin(instrumentos, eq(instrumentos.id, ejemplares.instrumentoId))
      .where(eq(ejemplares.id, d.ejemplarId)).get();
    if (!e) throw new Error("El ejemplar no existe.");

    const i = tx.select({
      id: inscripciones.id,
      alumnoId: inscripciones.alumnoId,
      estado: inscripciones.estado,
      autoriza: programas.permitePrestamoACasa,
      cicloId: ciclos.id,
    })
      .from(inscripciones)
      .innerJoin(programas, eq(programas.id, inscripciones.programaId))
      .leftJoin(ciclos, and(eq(ciclos.inscripcionId, inscripciones.id), eq(ciclos.estado, "abierto")))
      .where(eq(inscripciones.id, d.inscripcionId)).get();
    if (!i) throw new Error("La inscripción no existe.");

    const yaTiene = tx.select({ n: sql<number>`count(*)` })
      .from(prestamos)
      .innerJoin(ejemplares, eq(ejemplares.id, prestamos.ejemplarId))
      .where(and(
        eq(prestamos.alumnoId, i.alumnoId),
        isNull(prestamos.devueltoEl),
        eq(ejemplares.instrumentoId, e.instrumentoId),
      )).get()?.n ?? 0;

    const motivo = motivoParaRechazarPrestamo({
      granFormato: e.granFormato,
      programaAutoriza: i.autoriza,
      estadoEjemplar: e.estado,
      condicionEjemplar: e.condicion,
      tienePeriodoAbierto: i.cicloId !== null,
      inscripcionActiva: i.estado === "activa",
      yaTienePrestadoEsteInstrumento: yaTiene > 0,
    });
    if (motivo) throw new Error(motivo);

    if (!d.responsivaFirmada) {
      throw new Error("Sin responsiva firmada no sale el instrumento.");
    }

    const fila = tx.insert(prestamos).values({
      ejemplarId: d.ejemplarId,
      alumnoId: i.alumnoId,
      inscripcionId: i.id,
      cicloId: i.cicloId!,
      entregadoEl: d.entregadoEl,
      entregadoPor: usuarioId,
      condicionSalida: d.condicionSalida,
      responsivaFirmada: d.responsivaFirmada,
      notas: d.notas,
    }).returning({ id: prestamos.id }).get();
    if (!fila) throw new Error("No se pudo registrar el préstamo.");

    tx.update(ejemplares).set({ estado: "prestado" })
      .where(eq(ejemplares.id, d.ejemplarId)).run();

    return fila.id;
  });
}

export type DatosDevolucion = {
  prestamoId: number;
  devueltoEl: string;
  condicionRegreso: Condicion;
  incidencia: Incidencia;
  incidenciaNota: string | null;
};

/**
 * Recibe el ejemplar de vuelta y decide en qué estado queda.
 *
 * El estado no lo elige quien recibe: lo deriva la regla. Una pérdida da de baja
 * el ejemplar aunque nadie se acuerde de cambiarlo, y un daño lo manda a
 * reparación aunque en el mostrador se haya marcado «bueno».
 */
export function devolver(d: DatosDevolucion, usuarioId: number): void {
  db.transaction((tx) => {
    const p = tx.select({ id: prestamos.id, ejemplarId: prestamos.ejemplarId, devueltoEl: prestamos.devueltoEl })
      .from(prestamos).where(eq(prestamos.id, d.prestamoId)).get();
    if (!p) throw new Error("El préstamo no existe.");
    if (p.devueltoEl) throw new Error("Ese préstamo ya se cerró.");

    const motivo = motivoParaRechazarDevolucion(d.incidencia, d.incidenciaNota);
    if (motivo) throw new Error(motivo);

    tx.update(prestamos).set({
      devueltoEl: d.devueltoEl,
      recibidoPor: usuarioId,
      condicionRegreso: d.condicionRegreso,
      incidencia: d.incidencia,
      incidenciaNota: d.incidencia === "ninguna" ? null : d.incidenciaNota,
    }).where(eq(prestamos.id, d.prestamoId)).run();

    tx.update(ejemplares).set({
      estado: estadoTrasDevolucion(d.incidencia, d.condicionRegreso),
      condicion: d.condicionRegreso,
    }).where(eq(ejemplares.id, p.ejemplarId)).run();
  });
}

export type FilaPrestamo = {
  id: number;
  ejemplarId: number;
  codigo: string;
  instrumento: string;
  marca: string | null;
  alumnoId: number;
  alumno: string;
  alumnoCodigo: string;
  programa: string;
  entregadoEl: string;
  condicionSalida: Condicion;
  devueltoEl: string | null;
  condicionRegreso: Condicion | null;
  incidencia: Incidencia | null;
  incidenciaNota: string | null;
  terminaEl: string;
  responsivaFirmada: boolean;
  entregadoPor: string | null;
  notas: string | null;
};

function consultaPrestamos() {
  return db
    .select({
      id: prestamos.id,
      ejemplarId: ejemplares.id,
      codigo: ejemplares.codigo,
      instrumento: instrumentos.nombre,
      marca: ejemplares.marca,
      alumnoId: alumnos.id,
      alumno: alumnos.nombre,
      alumnoCodigo: alumnos.codigo,
      programa: programas.nombre,
      entregadoEl: prestamos.entregadoEl,
      condicionSalida: prestamos.condicionSalida,
      devueltoEl: prestamos.devueltoEl,
      condicionRegreso: prestamos.condicionRegreso,
      incidencia: prestamos.incidencia,
      incidenciaNota: prestamos.incidenciaNota,
      terminaEl: ciclos.terminaEl,
      responsivaFirmada: prestamos.responsivaFirmada,
      entregadoPor: usuarios.nombre,
      notas: prestamos.notas,
    })
    .from(prestamos)
    .innerJoin(ejemplares, eq(ejemplares.id, prestamos.ejemplarId))
    .innerJoin(instrumentos, eq(instrumentos.id, ejemplares.instrumentoId))
    .innerJoin(alumnos, eq(alumnos.id, prestamos.alumnoId))
    .innerJoin(inscripciones, eq(inscripciones.id, prestamos.inscripcionId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(ciclos, eq(ciclos.id, prestamos.cicloId))
    .leftJoin(usuarios, eq(usuarios.id, prestamos.entregadoPor));
}

export function prestamoPorId(id: number): FilaPrestamo | undefined {
  return consultaPrestamos().where(eq(prestamos.id, id)).get();
}

export function prestamosVigentes(): FilaPrestamo[] {
  return consultaPrestamos().where(isNull(prestamos.devueltoEl))
    .orderBy(asc(ciclos.terminaEl)).all();
}

export function historialDeEjemplar(ejemplarId: number): FilaPrestamo[] {
  return consultaPrestamos().where(eq(prestamos.ejemplarId, ejemplarId))
    .orderBy(desc(prestamos.entregadoEl), desc(prestamos.id)).all();
}

export function prestamosDeAlumno(alumnoId: number): FilaPrestamo[] {
  return consultaPrestamos().where(eq(prestamos.alumnoId, alumnoId))
    .orderBy(desc(prestamos.entregadoEl), desc(prestamos.id)).all();
}
