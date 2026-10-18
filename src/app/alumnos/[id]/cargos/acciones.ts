"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { actualizarCargo, cancelarCargo, cargoPorId, crearCargoManual, reactivarCargo } from "@/lib/datos/finanzas";
import { crearCargoProducto } from "@/lib/datos/vales";

// ------------------------------------------------------------------ crear ----

const CargoCrear = z.object({
  alumnoId: z.coerce.number().int().positive(),
  concepto: z.enum(["clase_suelta", "inscripcion", "material", "recital", "otro"]),
  descripcion: z.string().trim().min(1, "La descripción no puede quedar vacía.").max(300),
  periodo: z.string().trim().max(100).transform((s) => (s === "" ? null : s)),
  monto: z.coerce
    .number()
    .positive("El monto debe ser mayor que cero.")
    .max(1_000_000, "El monto es muy alto."),
  venceEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de vencimiento."),
});

export type EstadoCargoCrear = { error?: string };

export async function crearCargoAccion(
  _previo: EstadoCargoCrear,
  datos: FormData,
): Promise<EstadoCargoCrear> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = CargoCrear.safeParse({
    alumnoId: datos.get("alumnoId"),
    concepto: datos.get("concepto"),
    descripcion: datos.get("descripcion"),
    periodo: datos.get("periodo") ?? "",
    monto: datos.get("monto"),
    venceEl: datos.get("venceEl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  let cargoId: number;
  try {
    cargoId = crearCargoManual(
      d.alumnoId,
      {
        concepto: d.concepto,
        descripcion: d.descripcion,
        periodo: d.periodo,
        montoCentavos: Math.round(d.monto * 100),
        venceEl: d.venceEl,
      },
      sesion.usuarioId,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el cargo." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "cargo.generar",
    entidad: "cargos",
    entidadId: cargoId,
    cambios: { concepto: d.concepto, descripcion: d.descripcion, montoCentavos: Math.round(d.monto * 100) },
  });

  revalidatePath(`/alumnos/${d.alumnoId}`);
  redirect(`/alumnos/${d.alumnoId}?aviso=cargo-creado`);
  return {};
}

// ---------------------------------------------------------- crear (producto) ---

const CargoProducto = z.object({
  alumnoId: z.coerce.number().int().positive(),
  /** Vacío = concepto libre, fuera del catálogo. */
  productoId: z.string().trim().transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Elige un producto."),
  sedeId: z.coerce.number().int().positive("Elige la sede donde se vende."),
  descripcion: z.string().trim().max(300),
  monto: z.string().trim().transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isFinite(n) && n > 0 && n <= 1_000_000), "El monto debe ser mayor que cero."),
  venceEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de vencimiento."),
});

export type EstadoCargoProducto = { error?: string };

/**
 * Cargo de un producto (catálogo o concepto libre) con su vale de entrega. Se cobra y se
 * aplica con los pagos como cualquier otro cargo; el costo del producto, si lo hay, se
 * congela en el cargo sin pasar por esta pantalla.
 */
export async function crearCargoProductoAccion(
  _previo: EstadoCargoProducto,
  datos: FormData,
): Promise<EstadoCargoProducto> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = CargoProducto.safeParse({
    alumnoId: datos.get("alumnoId"),
    productoId: datos.get("productoId") ?? "",
    sedeId: datos.get("sedeId"),
    descripcion: datos.get("descripcion") ?? "",
    monto: datos.get("monto") ?? "",
    venceEl: datos.get("venceEl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  let r: ReturnType<typeof crearCargoProducto>;
  try {
    r = crearCargoProducto({
      alumnoId: d.alumnoId,
      sedeId: d.sedeId,
      productoId: d.productoId,
      descripcion: d.descripcion,
      montoCentavos: d.monto === null ? null : Math.round(d.monto * 100),
      venceEl: d.venceEl,
    }, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el cargo." };
  }

  // El costo no se registra aquí: lo leen quienes ven la bitácora, y no todos deben verlo.
  const cargo = cargoPorId(r.cargoId);
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "cargo.generar",
    entidad: "cargos",
    entidadId: r.cargoId,
    cambios: {
      concepto: "producto", descripcion: cargo?.descripcion, montoCentavos: cargo?.montoCentavos,
      productoId: d.productoId, sedeId: d.sedeId,
    },
  });
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "vale.crear",
    entidad: "vales_entrega",
    entidadId: r.valeId,
    cambios: { codigo: r.codigo, cargoId: r.cargoId },
  });

  revalidatePath(`/alumnos/${d.alumnoId}`);
  redirect(`/alumnos/${d.alumnoId}/cargos/${r.cargoId}?aviso=vale-creado`);
  return {};
}

// ------------------------------------------------------------------ editar ---

const CargoEditar = z.object({
  cargoId: z.coerce.number().int().positive(),
  alumnoId: z.coerce.number().int().positive(),
  descripcion: z.string().trim().min(1, "La descripción no puede quedar vacía.").max(300),
  periodo: z.string().trim().max(100).transform((s) => (s === "" ? null : s)),
  montoCentavos: z.coerce
    .number()
    .positive("El monto debe ser mayor que cero.")
    .max(1_000_000)
    .transform((n) => Math.round(n * 100)),
  venceEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de vencimiento."),
});

export type EstadoCargoEditar = { error?: string };

export async function editarCargo(
  _previo: EstadoCargoEditar,
  datos: FormData,
): Promise<EstadoCargoEditar> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = CargoEditar.safeParse({
    cargoId: datos.get("cargoId"),
    alumnoId: datos.get("alumnoId"),
    descripcion: datos.get("descripcion"),
    periodo: datos.get("periodo") ?? "",
    montoCentavos: datos.get("monto"),
    venceEl: datos.get("venceEl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  const cargo = cargoPorId(d.cargoId);
  if (!cargo) return { error: "No se encontró el cargo." };

  try {
    actualizarCargo(
      d.cargoId,
      d.alumnoId,
      { descripcion: d.descripcion, periodo: d.periodo, montoCentavos: d.montoCentavos, venceEl: d.venceEl },
      sesion.usuarioId,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo actualizar el cargo." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "cargo.editar",
    entidad: "cargos",
    entidadId: d.cargoId,
    cambios: { descripcion: d.descripcion, montoCentavos: d.montoCentavos, venceEl: d.venceEl },
  });

  redirect(`/alumnos/${d.alumnoId}`);
  return {};
}

// ----------------------------------------------------------------- cancelar ---

const CargoCancelar = z.object({
  cargoId: z.coerce.number().int().positive(),
  alumnoId: z.coerce.number().int().positive(),
  motivo: z.string().trim().max(300).default("Cancelado manualmente"),
});

export type EstadoCargoCancelar = { error?: string };

export async function cancelarCargoAccion(
  _previo: EstadoCargoCancelar,
  datos: FormData,
): Promise<EstadoCargoCancelar> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = CargoCancelar.safeParse({
    cargoId: datos.get("cargoId"),
    alumnoId: datos.get("alumnoId"),
    motivo: datos.get("motivo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Error en los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  try {
    cancelarCargo(d.cargoId, d.alumnoId, d.motivo, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cancelar el cargo." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "cargo.cancelar",
    entidad: "cargos",
    entidadId: d.cargoId,
    cambios: { motivo: d.motivo },
  });

  revalidatePath(`/alumnos/${d.alumnoId}`);
  redirect(`/alumnos/${d.alumnoId}`);
  return {};
}

// --------------------------------------------------------------- reactivar ---

const CargoReactivar = z.object({
  cargoId: z.coerce.number().int().positive(),
  alumnoId: z.coerce.number().int().positive(),
});

export type EstadoCargoReactivar = { error?: string };

export async function reactivarCargoAccion(
  _previo: EstadoCargoReactivar,
  datos: FormData,
): Promise<EstadoCargoReactivar> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = CargoReactivar.safeParse({
    cargoId: datos.get("cargoId"),
    alumnoId: datos.get("alumnoId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Error en los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  try {
    reactivarCargo(d.cargoId, d.alumnoId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo reactivar el cargo." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "cargo.editar",
    entidad: "cargos",
    entidadId: d.cargoId,
    cambios: { accion: "reactivado" },
  });

  revalidatePath(`/alumnos/${d.alumnoId}`);
  redirect(`/alumnos/${d.alumnoId}`);
  return {};
}
