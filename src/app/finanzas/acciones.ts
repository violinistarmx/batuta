"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { generarNomina, pagarNomina, registrarPago } from "@/lib/datos/finanzas";
import { hoyEnMexico, instanteEnMexico } from "@/lib/zona";

function cfg() {
  return Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );
}

// ------------------------------------------------------------------- pago ---

const Pago = z.object({
  alumnoId: z.coerce.number().int().positive(),
  /** Llega en pesos y se convierte a centavos: la interfaz habla en pesos. */
  monto: z.coerce.number().positive("El monto debe ser mayor que cero.").max(1_000_000),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta", "deposito", "otro"]),
  recibidoEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del pago."),
  referencia: z.string().trim().max(100).transform((s) => (s === "" ? null : s)),
  nota: z.string().trim().max(300).transform((s) => (s === "" ? null : s)),
});

export type EstadoPago = { error?: string };

export async function cobrar(_previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = Pago.safeParse({
    alumnoId: datos.get("alumnoId"),
    monto: datos.get("monto"),
    metodo: datos.get("metodo") ?? "efectivo",
    recibidoEl: datos.get("recibidoEl"),
    referencia: datos.get("referencia") ?? "",
    nota: datos.get("nota") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  // Los pesos entran a centavos aquí y no vuelven a salir de ahí. Redondear al
  // convertir evita que $750.005 se guarde como 75000.49999.
  const montoCentavos = Math.round(d.monto * 100);

  let r: Awaited<ReturnType<typeof registrarPago>>;
  try {
    r = registrarPago({ ...d, montoCentavos }, sesion.usuarioId, String(cfg().recibo_prefijo_folio ?? "VS"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el pago." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "pago.registrar",
    entidad: "pagos",
    entidadId: r.pagoId,
    cambios: {
      alumnoId: d.alumnoId, montoCentavos, metodo: d.metodo,
      folio: r.folio, aplicado: r.aplicadoCentavos, aFavor: r.aFavorCentavos,
    },
  });

  redirect(`/recibos/${r.reciboId}`);
}

// ----------------------------------------------------------------- nómina ---

const CorteNomina = z.object({
  desde: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha inicial."),
  hasta: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha final."),
});

export type EstadoNomina = { error?: string; ok?: string };

export async function calcularNomina(
  _previo: EstadoNomina,
  datos: FormData,
): Promise<EstadoNomina> {
  const sesion = await exigirPermiso("nomina.leer");

  const parsed = CorteNomina.safeParse({
    desde: datos.get("desde"), hasta: datos.get("hasta"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa las fechas." };

  const { desde, hasta } = parsed.data;
  if (hasta < desde) return { error: "La fecha final no puede ser anterior a la inicial." };

  const c = cfg();
  const r = generarNomina(
    instanteEnMexico(desde, "00:00"),
    instanteEnMexico(hasta, "23:59"),
    Number(c.tarifa_docente_hora_centavos ?? 12000),
    Number(c.factor_falta_sin_aviso ?? 0.75),
  );

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "nomina.calcular",
    entidad: "nomina_partidas",
    cambios: { desde, hasta, ...r },
  });

  revalidatePath("/finanzas/nomina");
  return {
    ok: r.creadas === 0
      ? `Sin clases nuevas por pagar en ese rango (${r.omitidas} ya estaban consideradas o no generan pago).`
      : `${r.creadas} clase(s) agregadas al corte. ${r.omitidas} omitidas por ya estar consideradas o no generar pago.`,
  };
}

const PagoNomina = z.object({
  docenteId: z.coerce.number().int().positive(),
  desdeEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  hastaEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  metodo: z.enum(["efectivo", "transferencia", "deposito", "otro"]),
  nota: z.string().trim().max(300).transform((s) => (s === "" ? null : s)),
});

export async function pagarDocente(
  _previo: EstadoNomina,
  datos: FormData,
): Promise<EstadoNomina> {
  const sesion = await exigirPermiso("nomina.leer");

  const parsed = PagoNomina.safeParse({
    docenteId: datos.get("docenteId"),
    desdeEl: datos.get("desdeEl"),
    hastaEl: datos.get("hastaEl"),
    metodo: datos.get("metodo") ?? "transferencia",
    nota: datos.get("nota") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  let r: ReturnType<typeof pagarNomina>;
  try {
    r = pagarNomina(d.docenteId, { ...d, pagadoEl: hoyEnMexico() }, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el pago." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "nomina.pagar",
    entidad: "nomina_pagos",
    entidadId: r.nominaId,
    cambios: { docenteId: d.docenteId, ...r },
  });

  revalidatePath("/finanzas/nomina");
  revalidatePath("/finanzas");
  return { ok: `Pagado: ${r.clases} clase(s) por $${(r.totalCentavos / 100).toLocaleString("es-MX")}.` };
}
