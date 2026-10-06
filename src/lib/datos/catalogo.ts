import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { preciosVigencia, programas } from "@/db/schema/index";

export type ResumenPrograma = {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string;
  clasesPorCiclo: number;
  minutosPorClase: number;
  alumnosIncluidos: number;
  renovable: boolean;
  permitePrestamoACasa: boolean;
  activo: boolean;
  orden: number;
  precioCentavos: number;
  precioVigenciaId: number;
  vigenteDesde: string;
};

/** Todos los programas activos con su precio vigente. */
export function listarProgramas(): ResumenPrograma[] {
  return db
    .select({
      id: programas.id,
      clave: programas.clave,
      nombre: programas.nombre,
      descripcion: programas.descripcion,
      clasesPorCiclo: programas.clasesPorCiclo,
      minutosPorClase: programas.minutosPorClase,
      alumnosIncluidos: programas.alumnosIncluidos,
      renovable: programas.renovable,
      permitePrestamoACasa: programas.permitePrestamoACasa,
      activo: programas.activo,
      orden: programas.orden,
      precioCentavos: preciosVigencia.precioCentavos,
      precioVigenciaId: preciosVigencia.id,
      vigenteDesde: preciosVigencia.vigenteDesde,
    })
    .from(programas)
    .innerJoin(preciosVigencia, and(
      eq(preciosVigencia.programaId, programas.id),
      isNull(preciosVigencia.vigenteHasta),
    ))
    .all()
    .sort((a, b) => a.orden - b.orden);
}

/** Un programa por id, con su precio vigente. Null si no existe. */
export function programaPorId(id: number): ResumenPrograma | null {
  const fila = db
    .select({
      id: programas.id,
      clave: programas.clave,
      nombre: programas.nombre,
      descripcion: programas.descripcion,
      clasesPorCiclo: programas.clasesPorCiclo,
      minutosPorClase: programas.minutosPorClase,
      alumnosIncluidos: programas.alumnosIncluidos,
      renovable: programas.renovable,
      permitePrestamoACasa: programas.permitePrestamoACasa,
      activo: programas.activo,
      orden: programas.orden,
      precioCentavos: preciosVigencia.precioCentavos,
      precioVigenciaId: preciosVigencia.id,
      vigenteDesde: preciosVigencia.vigenteDesde,
    })
    .from(programas)
    .innerJoin(preciosVigencia, and(
      eq(preciosVigencia.programaId, programas.id),
      isNull(preciosVigencia.vigenteHasta),
    ))
    .where(eq(programas.id, id))
    .get();
  return fila ?? null;
}

export type DatosCrearPrograma = {
  clave: string;
  nombre: string;
  descripcion: string;
  clasesPorCiclo: number;
  minutosPorClase: number;
  alumnosIncluidos: number;
  renovable: boolean;
  permitePrestamoACasa: boolean;
  orden: number;
  precioCentavos: number;
  vigenteDesde: string;
};

/** Crea un nuevo programa con su precio inicial. */
export function crearPrograma(datos: DatosCrearPrograma): number {
  return db.transaction((tx) => {
    const resultado = tx.insert(programas).values({
      clave: datos.clave,
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      clasesPorCiclo: datos.clasesPorCiclo,
      minutosPorClase: datos.minutosPorClase,
      alumnosIncluidos: datos.alumnosIncluidos,
      renovable: datos.renovable,
      permitePrestamoACasa: datos.permitePrestamoACasa,
      activo: true,
      orden: datos.orden,
    }).run();

    const programaId = Number(resultado.lastInsertRowid);

    tx.insert(preciosVigencia).values({
      programaId,
      precioCentavos: datos.precioCentavos,
      vigenteDesde: datos.vigenteDesde,
      vigenteHasta: null,
    }).run();

    return programaId;
  });
}

export type DatosEstructuraPrograma = {
  clave: string;
  clasesPorCiclo: number;
  minutosPorClase: number;
};

/**
 * Actualiza la estructura técnica del programa: clave, clases por ciclo y minutos por clase.
 * Solo debe usarse cuando no hay contratos activos que dependan de estas cifras.
 */
export function actualizarEstructuraPrograma(
  id: number,
  datos: DatosEstructuraPrograma,
): void {
  const resultado = db
    .update(programas)
    .set({
      clave: datos.clave,
      clasesPorCiclo: datos.clasesPorCiclo,
      minutosPorClase: datos.minutosPorClase,
    })
    .where(eq(programas.id, id))
    .run();
  if (resultado.changes === 0) throw new Error("El programa no existe.");
}

/** Actualiza nombre y/o descripción del programa. */
export function actualizarNombrePrograma(
  id: number,
  datos: { nombre: string; descripcion: string },
): void {
  const resultado = db
    .update(programas)
    .set({ nombre: datos.nombre, descripcion: datos.descripcion })
    .where(eq(programas.id, id))
    .run();
  if (resultado.changes === 0) throw new Error("El programa no existe.");
}

/**
 * Registra un nuevo precio con vigencia desde `vigenteDesde`.
 *
 * Cierra el precio anterior asignando `vigenteHasta` a la víspera de la nueva
 * fecha: si el precio entra hoy, el anterior estuvo vigente hasta ayer.
 *
 * El historial queda intacto: nadie pierde el precio que tenía cuando firmó.
 */
export function actualizarPrecioPrograma(
  programaId: number,
  precioCentavos: number,
  vigenteDesde: string,
): void {
  db.transaction((tx) => {
    // Calcula la víspera (un día antes de la nueva fecha de vigencia).
    const vispera = new Date(vigenteDesde + "T12:00:00Z");
    vispera.setDate(vispera.getDate() - 1);
    const vigenteHastaAnterior = vispera.toISOString().slice(0, 10);

    // Cierra el precio vigente actual.
    tx.update(preciosVigencia)
      .set({ vigenteHasta: vigenteHastaAnterior })
      .where(and(
        eq(preciosVigencia.programaId, programaId),
        isNull(preciosVigencia.vigenteHasta),
      ))
      .run();

    // Abre el nuevo precio.
    tx.insert(preciosVigencia).values({
      programaId,
      precioCentavos,
      vigenteDesde,
      vigenteHasta: null,
    }).run();
  });
}
