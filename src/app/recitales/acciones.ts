"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { alcanceDe, exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  asignarOrden, cambiarEstadoRecital, cancelarBoleto, confirmar, crearRecital,
  proponer, rechazar, registrarAsistenciaRecital, venderBoletos,
} from "@/lib/datos/recitales";
import { hoyEnMexico } from "@/lib/zona";

const texto = (max = 200) =>
  z.string().trim().max(max).optional().transform((s) => (!s ? null : s));

export type EstadoRecitalUI = { error?: string; ok?: string };

// ------------------------------------------------------------- recital ---

const Nuevo = z.object({
  nombre: z.string().trim().min(3, "Ponle nombre al recital.").max(150),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
  hora: z.string().trim().regex(/^\d{2}:\d{2}$/, "Elige la hora."),
  sede: z.string().trim().min(3, "¿Dónde se hace?").max(200),
  direccionSede: texto(250),
  capacidad: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "El aforo debe ser mayor que cero."),
  precioBoleto: z.string().trim().optional()
    .transform((s) => (!s ? 0 : Math.round(Number(s) * 100)))
    .refine((n) => Number.isInteger(n) && n >= 0, "Precio inválido."),
  notas: texto(500),
});

export async function crear(_previo: EstadoRecitalUI, datos: FormData): Promise<EstadoRecitalUI> {
  const sesion = await exigirPermiso("recitales.gestionar");

  const crudo = Object.fromEntries(
    Object.keys(Nuevo.shape).map((k) => [k, String(datos.get(k) ?? "")]),
  );
  const parsed = Nuevo.safeParse(crudo);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { precioBoleto, ...resto } = parsed.data;
  const id = crearRecital({ ...resto, precioBoletoCentavos: precioBoleto }, sesion.usuarioId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recital.crear",
    entidad: "recitales",
    entidadId: id,
    cambios: { nombre: resto.nombre, fecha: resto.fecha, precioBoleto },
  });

  redirect(`/recitales/${id}`);
}

const Estado = z.object({
  recitalId: z.coerce.number().int().positive(),
  estado: z.enum(["planeado", "abierto", "programa_cerrado", "realizado", "cancelado"]),
});

export async function moverEstado(
  _previo: EstadoRecitalUI,
  datos: FormData,
): Promise<EstadoRecitalUI> {
  const sesion = await exigirPermiso("recitales.gestionar");
  const parsed = Estado.safeParse({
    recitalId: datos.get("recitalId"), estado: datos.get("estado"),
  });
  if (!parsed.success) return { error: "Estado inválido." };

  try {
    cambiarEstadoRecital(parsed.data.recitalId, parsed.data.estado);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el estado." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recital.estado",
    entidad: "recitales",
    entidadId: parsed.data.recitalId,
    cambios: { estado: parsed.data.estado },
  });

  revalidatePath(`/recitales/${parsed.data.recitalId}`);
  return { ok: "Recital actualizado." };
}

// -------------------------------------------------------- participación ---

const Propuesta = z.object({
  recitalId: z.coerce.number().int().positive(),
  inscripcionId: z.coerce.number().int().positive("Elige al alumno."),
  pieza: z.string().trim().min(2, "Escribe la pieza.").max(200),
  compositor: texto(150),
  duracionMinutos: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0 && n < 120), "Duración inválida."),
  notas: texto(300),
});

export async function proponerAlumno(
  _previo: EstadoRecitalUI,
  datos: FormData,
): Promise<EstadoRecitalUI> {
  const sesion = await exigirPermiso("recitales.proponer");

  const parsed = Propuesta.safeParse({
    recitalId: datos.get("recitalId"),
    inscripcionId: datos.get("inscripcionId"),
    pieza: datos.get("pieza"),
    compositor: datos.get("compositor") ?? "",
    duracionMinutos: datos.get("duracionMinutos") ?? "",
    notas: datos.get("notas") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  // El alcance se comprueba antes de escribir: un maestro no propone a un alumno
  // que no es suyo aunque conozca el id de la inscripción.
  const alcance = alcanceDe(sesion);
  if (alcance.tipo === "propio") {
    const suyas = (await import("@/lib/datos/recitales"))
      .candidatasParaRecital(parsed.data.recitalId, alcance);
    if (!suyas.some((c) => c.inscripcionId === parsed.data.inscripcionId)) {
      return { error: "Ese alumno no está entre los tuyos." };
    }
  }

  let id: number;
  try {
    id = proponer(parsed.data, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo proponer." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recital.proponer",
    entidad: "participaciones",
    entidadId: id,
    cambios: { recitalId: parsed.data.recitalId, pieza: parsed.data.pieza },
  });

  revalidatePath(`/recitales/${parsed.data.recitalId}`);
  return { ok: "Propuesta registrada. Queda pendiente de confirmación." };
}

const Decision = z.object({
  participacionId: z.coerce.number().int().positive(),
  recitalId: z.coerce.number().int().positive(),
  accion: z.enum(["confirmar", "rechazar"]),
  motivoRechazo: texto(300),
});

export async function decidir(
  _previo: EstadoRecitalUI,
  datos: FormData,
): Promise<EstadoRecitalUI> {
  const sesion = await exigirPermiso("recitales.gestionar");

  const parsed = Decision.safeParse({
    participacionId: datos.get("participacionId"),
    recitalId: datos.get("recitalId"),
    accion: datos.get("accion"),
    motivoRechazo: datos.get("motivoRechazo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const d = parsed.data;
  try {
    if (d.accion === "confirmar") confirmar(d.participacionId, sesion.usuarioId, hoyEnMexico());
    else rechazar(d.participacionId, d.motivoRechazo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar la decisión." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: d.accion === "confirmar" ? "recital.confirmar" : "recital.rechazar",
    entidad: "participaciones",
    entidadId: d.participacionId,
    cambios: { motivoRechazo: d.motivoRechazo },
  });

  revalidatePath(`/recitales/${d.recitalId}`);
  return { ok: d.accion === "confirmar" ? "Participación confirmada." : "Propuesta devuelta." };
}

const Orden = z.object({
  participacionId: z.coerce.number().int().positive(),
  recitalId: z.coerce.number().int().positive(),
  orden: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Lugar inválido."),
});

export async function ordenar(
  _previo: EstadoRecitalUI,
  datos: FormData,
): Promise<EstadoRecitalUI> {
  await exigirPermiso("recitales.gestionar");
  const parsed = Orden.safeParse({
    participacionId: datos.get("participacionId"),
    recitalId: datos.get("recitalId"),
    orden: datos.get("orden") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    asignarOrden(parsed.data.participacionId, parsed.data.orden);
  } catch (e) {
    // El índice único avisa cuando dos quedan en el mismo lugar del programa.
    const msg = e instanceof Error && /UNIQUE/i.test(e.message)
      ? "Ya hay alguien en ese lugar del programa."
      : e instanceof Error ? e.message : "No se pudo ordenar.";
    return { error: msg };
  }

  revalidatePath(`/recitales/${parsed.data.recitalId}`);
  return { ok: "Orden actualizado." };
}

const Asistencia = z.object({
  participacionId: z.coerce.number().int().positive(),
  recitalId: z.coerce.number().int().positive(),
  asistio: z.enum(["si", "no"]),
});

export async function pasarLista(
  _previo: EstadoRecitalUI,
  datos: FormData,
): Promise<EstadoRecitalUI> {
  await exigirPermiso("recitales.gestionar");
  const parsed = Asistencia.safeParse({
    participacionId: datos.get("participacionId"),
    recitalId: datos.get("recitalId"),
    asistio: datos.get("asistio"),
  });
  if (!parsed.success) return { error: "Dato inválido." };

  registrarAsistenciaRecital(parsed.data.participacionId, parsed.data.asistio === "si");
  revalidatePath(`/recitales/${parsed.data.recitalId}`);
  return { ok: "Lista actualizada." };
}

// ------------------------------------------------------------- taquilla ---

const Venta = z.object({
  recitalId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().positive("¿Cuántos boletos?"),
  compradorNombre: z.string().trim().min(2, "¿A nombre de quién?").max(150),
  compradorTelefono: texto(20),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta", "deposito", "cortesia", "otro"]),
  vendidoEl: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
});

export async function vender(_previo: EstadoRecitalUI, datos: FormData): Promise<EstadoRecitalUI> {
  const sesion = await exigirPermiso("recitales.gestionar");

  const parsed = Venta.safeParse({
    recitalId: datos.get("recitalId"),
    cantidad: datos.get("cantidad"),
    compradorNombre: datos.get("compradorNombre"),
    compradorTelefono: datos.get("compradorTelefono") ?? "",
    metodo: datos.get("metodo") ?? "efectivo",
    vendidoEl: datos.get("vendidoEl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  let r: { id: number; folio: string; totalCentavos: number };
  try {
    r = venderBoletos({ ...parsed.data, alumnoId: null }, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo vender." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recital.vender",
    entidad: "boletos",
    entidadId: r.id,
    cambios: { folio: r.folio, cantidad: parsed.data.cantidad, total: r.totalCentavos },
  });

  revalidatePath(`/recitales/${parsed.data.recitalId}`);
  return { ok: `Folio ${r.folio} · ${parsed.data.cantidad} boleto(s).` };
}

const Cancelacion = z.object({
  boletoId: z.coerce.number().int().positive(),
  recitalId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3, "Escribe por qué se cancela.").max(300),
});

export async function cancelarVenta(
  _previo: EstadoRecitalUI,
  datos: FormData,
): Promise<EstadoRecitalUI> {
  const sesion = await exigirPermiso("recitales.gestionar");
  const parsed = Cancelacion.safeParse({
    boletoId: datos.get("boletoId"),
    recitalId: datos.get("recitalId"),
    motivo: datos.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    cancelarBoleto(parsed.data.boletoId, parsed.data.motivo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cancelar." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "recital.vender",
    entidad: "boletos",
    entidadId: parsed.data.boletoId,
    cambios: { cancelado: true, motivo: parsed.data.motivo },
  });

  revalidatePath(`/recitales/${parsed.data.recitalId}`);
  return { ok: "Boleto cancelado. El aforo vuelve a contarlo como libre." };
}
