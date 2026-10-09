"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { actualizarGasto, eliminarGasto, gastoPorId, registrarGasto } from "@/lib/datos/gastos";

const EsquemaGasto = z.object({
  categoria: z.enum(["renta", "servicios", "instrumentos", "material", "mantenimiento", "publicidad", "otro"]),
  concepto: z.string().trim().min(1, "Escribe el concepto.").max(200),
  monto: z.coerce
    .number({ invalid_type_error: "Escribe un monto válido." })
    .positive("El monto debe ser mayor que cero.")
    .max(10_000_000, "El monto parece demasiado alto."),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del gasto."),
});

export type EstadoGasto = { error?: string };

// ----------------------------------------------------------------- registrar ---

export async function registrarGastoAccion(
  _prev: EstadoGasto,
  datos: FormData,
): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");

  const parsed = EsquemaGasto.safeParse({
    categoria: datos.get("categoria"),
    concepto: datos.get("concepto"),
    monto: datos.get("monto"),
    fecha: datos.get("fecha"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { categoria, concepto, monto, fecha } = parsed.data;
  const montoCentavos = Math.round(monto * 100);

  let id: number;
  try {
    id = registrarGasto({ categoria, concepto, montoCentavos, fecha }, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el gasto." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "gasto.registrar",
    entidad: "gastos",
    entidadId: id,
    cambios: { categoria, concepto, montoCentavos, fecha },
  });

  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");
  redirect("/finanzas/gastos");
  return {};
}

// ------------------------------------------------------------------- editar ---

export async function editarGastoAccion(
  _prev: EstadoGasto,
  datos: FormData,
): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");

  const id = Number(datos.get("id"));
  if (!id) return { error: "Gasto inválido." };

  const parsed = EsquemaGasto.safeParse({
    categoria: datos.get("categoria"),
    concepto: datos.get("concepto"),
    monto: datos.get("monto"),
    fecha: datos.get("fecha"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { categoria, concepto, monto, fecha } = parsed.data;
  const montoCentavos = Math.round(monto * 100);

  try {
    actualizarGasto(id, { categoria, concepto, montoCentavos, fecha });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo actualizar el gasto." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "gasto.editar",
    entidad: "gastos",
    entidadId: id,
    cambios: { categoria, concepto, montoCentavos, fecha },
  });

  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");
  redirect("/finanzas/gastos");
  return {};
}

// ------------------------------------------------------------------ eliminar ---

export async function eliminarGastoAccion(
  _prev: EstadoGasto,
  datos: FormData,
): Promise<EstadoGasto> {
  const sesion = await exigirPermiso("gastos.gestionar");

  const id = Number(datos.get("id"));
  if (!id) return { error: "Gasto inválido." };

  const gasto = gastoPorId(id);
  if (!gasto) return { error: "No se encontró el gasto." };

  eliminarGasto(id);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "gasto.eliminar",
    entidad: "gastos",
    entidadId: id,
    cambios: { concepto: gasto.concepto, montoCentavos: gasto.montoCentavos, fecha: gasto.fecha },
  });

  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");
  redirect("/finanzas/gastos");
  return {};
}
