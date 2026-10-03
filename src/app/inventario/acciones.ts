"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { crearEjemplar, devolver, prestar } from "@/lib/datos/inventario";
import { hoyEnMexico } from "@/lib/zona";

const texto = (max = 200) =>
  z.string().trim().max(max).optional().transform((s) => (!s ? null : s));

const CONDICIONES = ["nuevo", "bueno", "regular", "dañado"] as const;

export type EstadoInventario = { error?: string; ok?: string };

// ------------------------------------------------------------- alta ---

const Alta = z.object({
  instrumentoId: z.coerce.number().int().positive("Elige el instrumento."),
  marca: texto(80),
  modelo: texto(80),
  numeroSerie: texto(80),
  medida: texto(20),
  condicion: z.enum(CONDICIONES),
  ubicacion: texto(120),
  /** Llega en pesos y se guarda en centavos, como todo el dinero del sistema. */
  valor: z.string().trim().optional()
    .transform((s) => (!s ? null : Math.round(Number(s) * 100)))
    .refine((n) => n === null || (Number.isInteger(n) && n >= 0), "Valor inválido."),
  adquiridoEl: z.string().trim().optional()
    .transform((s) => (!s ? null : s))
    .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "Fecha inválida."),
  notas: texto(500),
});

export async function darDeAltaEjemplar(
  _previo: EstadoInventario,
  datos: FormData,
): Promise<EstadoInventario> {
  const sesion = await exigirPermiso("inventario.gestionar");

  const crudo = Object.fromEntries(
    Object.keys(Alta.shape).map((k) => [k, String(datos.get(k) ?? "")]),
  );
  const parsed = Alta.safeParse(crudo);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { valor, ...resto } = parsed.data;
  let creado: { id: number; codigo: string };
  try {
    creado = crearEjemplar({ ...resto, valorCentavos: valor }, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo dar de alta." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inventario.alta",
    entidad: "ejemplares",
    entidadId: creado.id,
    cambios: { codigo: creado.codigo, instrumentoId: resto.instrumentoId },
  });

  redirect(`/inventario/${creado.id}`);
}

// ---------------------------------------------------------- préstamo ---

const Prestamo = z.object({
  ejemplarId: z.coerce.number().int().positive(),
  inscripcionId: z.coerce.number().int().positive("Elige a quién se le presta."),
  entregadoEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  condicionSalida: z.enum(CONDICIONES),
  responsivaFirmada: z.boolean(),
  notas: texto(300),
});

export async function entregarInstrumento(
  _previo: EstadoInventario,
  datos: FormData,
): Promise<EstadoInventario> {
  const sesion = await exigirPermiso("inventario.gestionar");

  const parsed = Prestamo.safeParse({
    ejemplarId: datos.get("ejemplarId"),
    inscripcionId: datos.get("inscripcionId"),
    entregadoEl: datos.get("entregadoEl"),
    condicionSalida: datos.get("condicionSalida") ?? "bueno",
    responsivaFirmada: datos.get("responsivaFirmada") === "on",
    notas: datos.get("notas") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  let prestamoId: number;
  try {
    prestamoId = prestar(parsed.data, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el préstamo." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inventario.prestar",
    entidad: "prestamos",
    entidadId: prestamoId,
    cambios: {
      ejemplarId: parsed.data.ejemplarId,
      inscripcionId: parsed.data.inscripcionId,
      condicionSalida: parsed.data.condicionSalida,
    },
  });

  redirect(`/prestamos/${prestamoId}/responsiva`);
}

// --------------------------------------------------------- devolución ---

const Devolucion = z.object({
  prestamoId: z.coerce.number().int().positive(),
  devueltoEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  condicionRegreso: z.enum(CONDICIONES),
  incidencia: z.enum(["ninguna", "dano", "perdida"]),
  incidenciaNota: texto(500),
});

export async function recibirInstrumento(
  _previo: EstadoInventario,
  datos: FormData,
): Promise<EstadoInventario> {
  const sesion = await exigirPermiso("inventario.gestionar");

  const parsed = Devolucion.safeParse({
    prestamoId: datos.get("prestamoId"),
    devueltoEl: datos.get("devueltoEl") || hoyEnMexico(),
    condicionRegreso: datos.get("condicionRegreso") ?? "bueno",
    incidencia: datos.get("incidencia") ?? "ninguna",
    incidenciaNota: datos.get("incidenciaNota") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    devolver(parsed.data, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar la devolución." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "inventario.devolver",
    entidad: "prestamos",
    entidadId: parsed.data.prestamoId,
    cambios: {
      condicionRegreso: parsed.data.condicionRegreso,
      incidencia: parsed.data.incidencia,
    },
  });

  revalidatePath("/inventario");
  return {
    ok: parsed.data.incidencia === "ninguna"
      ? "Instrumento recibido."
      : "Recibido con incidencia. No se generó ningún cargo: decide tú qué cobrar.",
  };
}
