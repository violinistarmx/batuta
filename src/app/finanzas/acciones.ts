"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { configuracion, nominaPartidas } from "@/db/schema/index";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorId } from "@/lib/datos/alumnos";
import { actualizarPago, anularPago, generarNomina, pagarNomina, reciboPorId, registrarPago } from "@/lib/datos/finanzas";
import { pesos } from "@/lib/formato";
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
  /**
   * Condonación en pesos. Solo la valida y aplica el director; para cualquier otro
   * rol el campo llega vacío y se ignora.
   */
  descuento: z.coerce.number().nonnegative("El descuento no puede ser negativo.").max(1_000_000).default(0),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta", "deposito", "otro"]),
  recibidoEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del pago."),
  referencia: z.string().trim().max(100).transform((s) => (s === "" ? null : s)),
  /**
   * Aparece en el recibo junto al concepto del cargo. Campo público.
   * Distinto de `nota`, que es una observación interna.
   */
  descripcion: z.string().trim().max(1000).transform((s) => (s === "" ? null : s)),
  nota: z.string().trim().max(2000).transform((s) => (s === "" ? null : s)),
  /** Cargo al que va primero el dinero; vacío = reparto automático. */
  cargoObjetivoId: z.string().trim().transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Elige un cargo válido."),
});

export type EstadoPago = { error?: string };

export async function cobrar(_previo: EstadoPago, datos: FormData): Promise<EstadoPago> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = Pago.safeParse({
    alumnoId: datos.get("alumnoId"),
    monto: datos.get("monto"),
    descuento: datos.get("descuento") ?? "0",
    metodo: datos.get("metodo") ?? "efectivo",
    recibidoEl: datos.get("recibidoEl"),
    referencia: datos.get("referencia") ?? "",
    descripcion: datos.get("descripcion") ?? "",
    nota: datos.get("nota") ?? "",
    cargoObjetivoId: datos.get("cargoObjetivoId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  if (!alumnoPorId(d.alumnoId, alcanceDe(sesion))) return { error: "No se encontró el alumno." };

  // Los pesos entran a centavos aquí y no vuelven a salir de ahí. Redondear al
  // convertir evita que $750.005 se guarde como 75000.49999.
  const montoCentavos = Math.round(d.monto * 100);

  // El descuento solo lo puede aplicar el director. Cualquier otro rol lo ignora
  // aunque envíe el campo — así no hay vector de escalación de privilegios.
  const esDirector = tienePermiso(sesion, "configuracion.gestionar");
  const descuentoCentavos = esDirector ? Math.round(d.descuento * 100) : 0;

  let r: Awaited<ReturnType<typeof registrarPago>>;
  try {
    r = registrarPago(
      { ...d, montoCentavos, descuentoCentavos },
      sesion.usuarioId,
      String(cfg().recibo_prefijo_folio ?? "VS"),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el pago." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "pago.registrar",
    entidad: "pagos",
    entidadId: r.pagoId,
    cambios: {
      alumnoId: d.alumnoId, montoCentavos, descuentoCentavos, metodo: d.metodo,
      ...(d.cargoObjetivoId !== null ? { cargoObjetivoId: d.cargoObjetivoId } : {}),
      folio: r.folio, aplicado: r.aplicadoCentavos, aFavor: r.aFavorCentavos,
    },
  });

  redirect(`/recibos/${r.reciboId}?aviso=pago-registrado`);
  return {};
}

// --------------------------------------------------------------- editar pago ---

const PagoEditar = z.object({
  pagoId: z.coerce.number().int().positive(),
  monto: z.coerce.number().positive("El monto debe ser mayor que cero.").max(1_000_000),
  descuento: z.coerce.number().nonnegative("El descuento no puede ser negativo.").max(1_000_000).default(0),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta", "deposito", "otro"]),
  recibidoEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del pago."),
  referencia: z.string().trim().max(100).transform((s) => (s === "" ? null : s)),
  descripcion: z.string().trim().max(1000).transform((s) => (s === "" ? null : s)),
  nota: z.string().trim().max(2000).transform((s) => (s === "" ? null : s)),
});

export type EstadoEditar = { error?: string };

export async function editarPago(_previo: EstadoEditar, datos: FormData): Promise<EstadoEditar> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = PagoEditar.safeParse({
    pagoId: datos.get("pagoId"),
    monto: datos.get("monto"),
    descuento: datos.get("descuento") ?? "0",
    metodo: datos.get("metodo") ?? "efectivo",
    recibidoEl: datos.get("recibidoEl"),
    referencia: datos.get("referencia") ?? "",
    descripcion: datos.get("descripcion") ?? "",
    nota: datos.get("nota") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;

  // Verificar que el recibo existe y obtener alumnoId
  const r = reciboPorId(Number(datos.get("reciboId")));
  if (!r) return { error: "No se encontró el recibo." };

  const montoCentavos = Math.round(d.monto * 100);
  const esDirector = tienePermiso(sesion, "configuracion.gestionar");
  const descuentoCentavos = esDirector ? Math.round(d.descuento * 100) : 0;

  try {
    actualizarPago(
      d.pagoId,
      r.alumnoId,
      { montoCentavos, descuentoCentavos, metodo: d.metodo, recibidoEl: d.recibidoEl,
        referencia: d.referencia, descripcion: d.descripcion, nota: d.nota },
      sesion.usuarioId,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo actualizar el pago." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "pago.editar",
    entidad: "pagos",
    entidadId: d.pagoId,
    cambios: { montoCentavos, descuentoCentavos, metodo: d.metodo, folio: r.folio },
  });

  redirect(`/recibos/${r.id}`);
  return {};
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
    Number(c.factor_falta_justificada ?? 0),
  );

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "nomina.calcular",
    entidad: "nomina_partidas",
    cambios: { desde, hasta, ...r },
  });

  revalidatePath("/finanzas/nomina");
  // La pantalla se abre en el mismo periodo que se calculó: lo que se ve y lo que se
  // paga son las clases de esas fechas, no todo lo pendiente.
  redirect(`/finanzas/nomina?desde=${desde}&hasta=${hasta}&creadas=${r.creadas}&omitidas=${r.omitidas}`);
}

const AjusteImporte = z.object({
  partidaId: z.coerce.number().int().positive(),
  importe: z.string().trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Escribe un importe en pesos, por ejemplo 90 o 90.50.")
    .transform((s) => Math.round(Number(s) * 100)),
});

/**
 * Cambia cuánto se le paga al docente en una clase todavía no pagada. Se captura el
 * importe en pesos; el porcentaje se calcula a partir de él y nunca se escribe a
 * mano. Solo lo puede hacer quien tiene `nomina.leer` (el director). El importe no
 * puede pasar de lo que vale la clase completa. «Anular» lo deja en $0. Una partida
 * ya pagada no se toca: ese dinero ya salió.
 */
export async function ajustarFactorPartidaAccion(
  _previo: EstadoNomina,
  datos: FormData,
): Promise<EstadoNomina> {
  const sesion = await exigirPermiso("nomina.leer");

  const anular = datos.get("anular") === "1";
  const parsed = AjusteImporte.safeParse({
    partidaId: datos.get("partidaId"),
    importe: anular ? "0" : String(datos.get("importe") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el importe." };

  const { partidaId, importe: importeCentavos } = parsed.data;

  let cambio: { antes: { factor: string; importe: number }; despues: { factor: string; importe: number } };
  try {
    cambio = db.transaction((tx) => {
      const p = tx.select().from(nominaPartidas).where(eq(nominaPartidas.id, partidaId)).get();
      if (!p) throw new Error("Esa partida ya no existe.");
      if (p.nominaId !== null) throw new Error("Esa clase ya está pagada: no se puede cambiar.");

      const completo = Math.round((p.minutos / 60) * p.tarifaHoraCentavos);
      if (importeCentavos > completo) {
        throw new Error(`El importe no puede pasar de ${pesos(completo)}: es lo que vale la clase completa.`);
      }

      // El porcentaje se deriva del importe: así no puede quedar un factor que no
      // corresponda al monto que realmente se paga.
      const factor = completo === 0 ? 0 : importeCentavos / completo;
      tx.update(nominaPartidas)
        .set({ factor: factor.toFixed(4), importeCentavos })
        .where(eq(nominaPartidas.id, partidaId))
        .run();

      return {
        antes: { factor: p.factor, importe: p.importeCentavos },
        despues: { factor: factor.toFixed(4), importe: importeCentavos },
      };
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar la partida." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "nomina.ajustar",
    entidad: "nomina_partidas",
    entidadId: partidaId,
    cambios: {
      factor: [cambio.antes.factor, cambio.despues.factor],
      importe_centavos: [cambio.antes.importe, cambio.despues.importe],
    },
  });

  revalidatePath("/finanzas/nomina");
  return { ok: anular ? "Clase anulada: no genera costo." : `Importe cambiado a ${pesos(importeCentavos)}.` };
}

const PagoNomina = z.object({
  docenteId: z.coerce.number().int().positive(),
  desdeEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  hastaEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  metodo: z.enum(["efectivo", "transferencia", "deposito", "otro"]),
  nota: z.string().trim().max(2000).transform((s) => (s === "" ? null : s)),
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

// --------------------------------------------------------------- anular pago ---

const PagoAnular = z.object({
  reciboId: z.coerce.number().int().positive(),
});

export type EstadoAnular = { error?: string };

export async function anularPagoAccion(
  _previo: EstadoAnular,
  datos: FormData,
): Promise<EstadoAnular> {
  const sesion = await exigirPermiso("pagos.registrar");

  const parsed = PagoAnular.safeParse({ reciboId: datos.get("reciboId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Error en los datos." };

  const r = reciboPorId(parsed.data.reciboId);
  if (!r) return { error: "No se encontró el recibo." };

  try {
    anularPago(r.pagoId, r.alumnoId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular el pago." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "pago.modificar",
    entidad: "pagos",
    entidadId: r.pagoId,
    cambios: { folio: r.folio, motivo: "anulado manualmente" },
  });

  redirect(`/alumnos/${r.alumnoId}`);
  return {};
}
