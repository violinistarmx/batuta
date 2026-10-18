import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, cargos, productos, secuencias, sedes, usuarios, valesEntrega,
} from "@/db/schema/index";
import { formatearCodigoVale, resolverEntrega, type ResultadoEntrega } from "@/lib/dominio/vales";
import { generarTokenQr } from "@/lib/qr";
import { hoyEnMexico } from "@/lib/zona";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Lo aplicado a un cargo, calculado. Nunca un campo guardado. */
const APLICADO = sql<number>`coalesce((
  SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
), 0)`;

/** Consecutivo anual del vale, tomado dentro de la transacción que lo crea. */
function siguienteCodigoVale(tx: Tx, anio: number): string {
  const clave = `vale:${anio}`;
  tx.insert(secuencias).values({ clave, valor: 0 }).onConflictDoNothing().run();
  const fila = tx.update(secuencias)
    .set({ valor: sql`${secuencias.valor} + 1` })
    .where(eq(secuencias.clave, clave))
    .returning({ valor: secuencias.valor }).get();
  return formatearCodigoVale(anio, fila?.valor ?? 1);
}

export type DatosCargoProducto = {
  alumnoId: number;
  sedeId: number;
  /** Producto del catálogo. NULL = concepto libre, que exige `descripcion`. */
  productoId: number | null;
  descripcion: string;
  /** Si no llega, se usa el precio del catálogo. Editable por si hay descuento. */
  montoCentavos: number | null;
  venceEl: string;
};

export type ResultadoCargoProducto = { cargoId: number; valeId: number; codigo: string; token: string };

/**
 * Crea el cargo de un producto y su vale de entrega, en una sola transacción.
 *
 * Es un cargo como cualquier otro —se cobra y se aplica con `registrarPago`—; solo que
 * lleva sede, no depende de inscripción y congela el costo del producto al venderlo.
 */
export function crearCargoProducto(d: DatosCargoProducto, usuarioId: number): ResultadoCargoProducto {
  return db.transaction((tx) => {
    const sede = tx.select({ id: sedes.id }).from(sedes)
      .where(and(eq(sedes.id, d.sedeId), eq(sedes.activo, true))).get();
    if (!sede) throw new Error("Elige una sede válida.");

    let descripcion = d.descripcion.trim();
    let monto = d.montoCentavos;
    let costo: number | null = null;

    if (d.productoId !== null) {
      const p = tx.select({
        nombre: productos.nombre, precio: productos.precioCentavos,
        costo: productos.costoCentavos, activo: productos.activo,
      }).from(productos).where(eq(productos.id, d.productoId)).get();
      if (!p || !p.activo) throw new Error("Ese producto no está disponible.");
      if (descripcion === "") descripcion = p.nombre;
      monto ??= p.precio;
      costo = p.costo;
    }

    if (descripcion === "") throw new Error("Escribe el concepto del cargo.");
    if (monto === null || monto <= 0) throw new Error("El monto debe ser mayor que cero.");

    const cargo = tx.insert(cargos).values({
      alumnoId: d.alumnoId,
      concepto: "producto",
      descripcion,
      montoCentavos: monto,
      venceEl: d.venceEl,
      sedeId: d.sedeId,
      productoId: d.productoId,
      costoCentavos: costo,
      creadoPor: usuarioId,
    }).returning({ id: cargos.id }).get();
    if (!cargo) throw new Error("No se pudo crear el cargo.");

    const anio = Number(hoyEnMexico().slice(0, 4));
    const codigo = siguienteCodigoVale(tx, anio);
    const token = generarTokenQr();
    const vale = tx.insert(valesEntrega).values({ codigo, token, cargoId: cargo.id })
      .returning({ id: valesEntrega.id }).get();
    if (!vale) throw new Error("No se pudo crear el vale.");

    return { cargoId: cargo.id, valeId: vale.id, codigo, token };
  });
}

const CAMPOS_VALE = {
  id: valesEntrega.id,
  codigo: valesEntrega.codigo,
  token: valesEntrega.token,
  estado: valesEntrega.estado,
  entregadoEn: valesEntrega.entregadoEn,
  excepcionMotivo: valesEntrega.excepcionMotivo,
  cargoId: cargos.id,
  concepto: cargos.descripcion,
  montoCentavos: cargos.montoCentavos,
  cancelado: cargos.cancelado,
  aplicadoCentavos: APLICADO,
  alumnoId: alumnos.id,
  alumno: alumnos.nombre,
  alumnoCodigo: alumnos.codigo,
  sede: sedes.nombre,
};

function consultaVale() {
  return db.select({
    ...CAMPOS_VALE,
    entregadoPor: usuarios.nombre,
  })
    .from(valesEntrega)
    .innerJoin(cargos, eq(cargos.id, valesEntrega.cargoId))
    .innerJoin(alumnos, eq(alumnos.id, cargos.alumnoId))
    .leftJoin(sedes, eq(sedes.id, cargos.sedeId))
    .leftJoin(usuarios, eq(usuarios.id, valesEntrega.entregadoPor));
}

export function valePorToken(token: string) {
  return consultaVale().where(eq(valesEntrega.token, token)).get();
}

export function valeDeCargo(cargoId: number) {
  return consultaVale().where(eq(valesEntrega.cargoId, cargoId)).get();
}

/** Vales de los cargos que saldó un pago: los que lleva el recibo. */
export function valesDeRecibo(pagoId: number) {
  return consultaVale()
    .where(sql`${valesEntrega.cargoId} IN (SELECT cargo_id FROM aplicaciones WHERE pago_id = ${pagoId})`)
    .orderBy(asc(valesEntrega.id))
    .all();
}

export type ResultadoEntregaVale =
  | { ok: true; valeId: number; codigo: string; conExcepcion: boolean }
  | Exclude<ResultadoEntrega, { ok: true }>
  | { ok: false; motivo: "no_existe"; mensaje: string };

/**
 * Marca el vale como entregado.
 *
 * El UPDATE lleva `estado = 'pendiente'` en el WHERE: si dos personas confirman a la
 * vez, solo una modifica la fila y la otra recibe «ya se entregó». La regla no depende
 * de que la pantalla estuviera al día.
 */
export function entregarVale(
  token: string,
  usuario: { id: number; puedeAutorizarExcepcion: boolean },
  motivoExcepcion: string | null,
): ResultadoEntregaVale {
  return db.transaction((tx) => {
    const v = tx.select({
      id: valesEntrega.id, codigo: valesEntrega.codigo, estado: valesEntrega.estado,
      cancelado: cargos.cancelado, montoCentavos: cargos.montoCentavos, aplicadoCentavos: APLICADO,
    }).from(valesEntrega)
      .innerJoin(cargos, eq(cargos.id, valesEntrega.cargoId))
      .where(eq(valesEntrega.token, token)).get();
    if (!v) return { ok: false as const, motivo: "no_existe" as const, mensaje: "No se encontró el vale." };

    const r = resolverEntrega({
      estado: v.estado,
      cargo: { cancelado: v.cancelado, montoCentavos: v.montoCentavos, aplicadoCentavos: v.aplicadoCentavos },
      puedeAutorizarExcepcion: usuario.puedeAutorizarExcepcion,
      motivoExcepcion,
    });
    if (!r.ok) return r;

    const cambio = tx.update(valesEntrega).set({
      estado: "entregado",
      entregadoEn: new Date(),
      entregadoPor: usuario.id,
      excepcionMotivo: r.motivoExcepcion,
      autorizadoPor: r.conExcepcion ? usuario.id : null,
    }).where(and(eq(valesEntrega.id, v.id), eq(valesEntrega.estado, "pendiente"))).run();

    if (cambio.changes === 0) {
      return { ok: false as const, motivo: "ya_entregado" as const, mensaje: "Este vale ya se entregó." };
    }
    return { ok: true as const, valeId: v.id, codigo: v.codigo, conExcepcion: r.conExcepcion };
  });
}

export type FiltroEntregas = { sedeId: number | null; concepto: string | null };

/**
 * Vales pendientes de entregar, para preparar los paquetes. Los cargos cancelados no
 * aparecen: ya no hay nada que preparar.
 */
export function valesPendientes(f: FiltroEntregas) {
  const condiciones = [eq(valesEntrega.estado, "pendiente"), eq(cargos.cancelado, false)];
  if (f.sedeId !== null) condiciones.push(eq(cargos.sedeId, f.sedeId));
  if (f.concepto !== null) condiciones.push(eq(cargos.descripcion, f.concepto));

  return db.select({
    id: valesEntrega.id,
    codigo: valesEntrega.codigo,
    token: valesEntrega.token,
    creadoEn: valesEntrega.creadoEn,
    concepto: cargos.descripcion,
    montoCentavos: cargos.montoCentavos,
    aplicadoCentavos: APLICADO,
    venceEl: cargos.venceEl,
    alumnoId: alumnos.id,
    alumno: alumnos.nombre,
    alumnoCodigo: alumnos.codigo,
    sedeId: cargos.sedeId,
    sede: sedes.nombre,
  })
    .from(valesEntrega)
    .innerJoin(cargos, eq(cargos.id, valesEntrega.cargoId))
    .innerJoin(alumnos, eq(alumnos.id, cargos.alumnoId))
    .leftJoin(sedes, eq(sedes.id, cargos.sedeId))
    .where(and(...condiciones))
    .orderBy(asc(cargos.descripcion), asc(valesEntrega.id))
    .all();
}

/** Conceptos con vales pendientes, para el filtro de la lista. */
export function conceptosPendientes(): string[] {
  return db.selectDistinct({ concepto: cargos.descripcion })
    .from(valesEntrega)
    .innerJoin(cargos, eq(cargos.id, valesEntrega.cargoId))
    .where(and(eq(valesEntrega.estado, "pendiente"), eq(cargos.cancelado, false)))
    .orderBy(asc(cargos.descripcion))
    .all()
    .map((r) => r.concepto);
}

export function sedesActivas() {
  return db.select({ id: sedes.id, nombre: sedes.nombre }).from(sedes)
    .where(eq(sedes.activo, true)).orderBy(asc(sedes.orden)).all();
}
