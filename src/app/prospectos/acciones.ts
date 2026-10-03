"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import {
  cambiarEtapa, convertirProspecto, crearProspecto, registrarSeguimiento,
} from "@/lib/datos/prospectos";

const texto = (max = 200) =>
  z.string().trim().max(max).optional().transform((s) => (!s ? null : s));

const fechaCivil = z.string().trim().optional()
  .transform((s) => (!s ? null : s))
  .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "Fecha inválida.");

const ORIGENES = [
  "instagram", "facebook", "tiktok", "recomendacion", "paso_por_la_calle",
  "whatsapp", "google", "evento", "otro",
] as const;

const Nuevo = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre de quien tomaría la clase.").max(150),
  edadAproximada: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0 && n < 120), "Edad inválida."),
  contactoNombre: texto(150),
  contactoParentesco: texto(60),
  telefono: texto(20),
  whatsapp: texto(20),
  email: texto(150),
  programaInteresId: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s))),
  instrumentoInteresId: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s))),
  origen: z.enum(ORIGENES),
  origenDetalle: texto(200),
  proximoSeguimientoEl: fechaCivil,
  notas: texto(1000),
});

export type EstadoNuevo = { error?: string };

export async function registrarProspecto(
  _previo: EstadoNuevo,
  datos: FormData,
): Promise<EstadoNuevo> {
  const sesion = await exigirPermiso("prospectos.crear");

  const crudo = Object.fromEntries(
    Object.keys(Nuevo.shape).map((k) => [k, String(datos.get(k) ?? "")]),
  );
  const parsed = Nuevo.safeParse(crudo);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const id = crearProspecto(parsed.data, sesion.usuarioId);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "prospecto.crear",
    entidad: "prospectos",
    entidadId: id,
    cambios: { nombre: parsed.data.nombre, origen: parsed.data.origen },
  });

  redirect(`/prospectos/${id}`);
}

// ------------------------------------------------------------ seguimiento ---

const Seguimiento = z.object({
  prospectoId: z.coerce.number().int().positive(),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del contacto."),
  canal: z.enum(["whatsapp", "llamada", "mensaje_directo", "correo", "presencial", "otro"]),
  resultado: z.enum([
    "contactado", "sin_respuesta", "agendo_clase_muestra", "pidio_informacion", "rechazo", "otro",
  ]),
  nota: texto(500),
  proximoSeguimientoEl: fechaCivil,
});

export type EstadoSeguimiento = { error?: string; ok?: string };

export async function anotarSeguimiento(
  _previo: EstadoSeguimiento,
  datos: FormData,
): Promise<EstadoSeguimiento> {
  const sesion = await exigirPermiso("prospectos.editar");

  const parsed = Seguimiento.safeParse({
    prospectoId: datos.get("prospectoId"),
    fecha: datos.get("fecha"),
    canal: datos.get("canal") ?? "whatsapp",
    resultado: datos.get("resultado") ?? "contactado",
    nota: datos.get("nota") ?? "",
    proximoSeguimientoEl: datos.get("proximoSeguimientoEl") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  let etapa: string;
  try {
    etapa = registrarSeguimiento(parsed.data, sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el contacto." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "prospecto.seguimiento",
    entidad: "prospectos",
    entidadId: parsed.data.prospectoId,
    cambios: { canal: parsed.data.canal, resultado: parsed.data.resultado, etapa },
  });

  revalidatePath(`/prospectos/${parsed.data.prospectoId}`);
  return { ok: "Contacto registrado." };
}

// ------------------------------------------------------------------ etapa ---

const Etapa = z.object({
  prospectoId: z.coerce.number().int().positive(),
  estado: z.enum(["nuevo", "contactado", "clase_muestra", "en_negociacion", "convertido", "perdido"]),
  motivoPerdida: z.string().trim().optional().transform((s) => (!s ? null : s)),
  motivoDetalle: texto(300),
  claseMuestraEl: fechaCivil,
  claseMuestraHora: texto(5),
  claseMuestraAsistio: z.string().trim().optional()
    .transform((s) => (s === "si" ? true : s === "no" ? false : null)),
  proximoSeguimientoEl: fechaCivil,
});

export async function moverEtapa(
  _previo: EstadoSeguimiento,
  datos: FormData,
): Promise<EstadoSeguimiento> {
  const sesion = await exigirPermiso("prospectos.editar");

  const parsed = Etapa.safeParse({
    prospectoId: datos.get("prospectoId"),
    estado: datos.get("estado"),
    motivoPerdida: datos.get("motivoPerdida") ?? "",
    motivoDetalle: datos.get("motivoDetalle") ?? "",
    claseMuestraEl: datos.get("claseMuestraEl") ?? "",
    claseMuestraHora: datos.get("claseMuestraHora") ?? "",
    claseMuestraAsistio: datos.get("claseMuestraAsistio") ?? "",
    proximoSeguimientoEl: datos.get("proximoSeguimientoEl") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  try {
    cambiarEtapa(parsed.data as Parameters<typeof cambiarEtapa>[0]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar la etapa." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "prospecto.etapa",
    entidad: "prospectos",
    entidadId: parsed.data.prospectoId,
    cambios: { estado: parsed.data.estado, motivoPerdida: parsed.data.motivoPerdida },
  });

  revalidatePath(`/prospectos/${parsed.data.prospectoId}`);
  return { ok: "Etapa actualizada." };
}

// ------------------------------------------------------------- conversión ---

const Conversion = z.object({
  prospectoId: z.coerce.number().int().positive(),
  fechaNacimiento: fechaCivil,
  avisoPrivacidad: z.boolean(),
  usoImagen: z.boolean(),
  tutorExistenteId: z.string().trim().optional()
    .transform((s) => (!s ? null : Number(s))),
});

export type EstadoConversion = { error?: string };

export async function convertir(
  _previo: EstadoConversion,
  datos: FormData,
): Promise<EstadoConversion> {
  const sesion = await exigirPermiso("prospectos.convertir");

  const parsed = Conversion.safeParse({
    prospectoId: datos.get("prospectoId"),
    fechaNacimiento: datos.get("fechaNacimiento") ?? "",
    avisoPrivacidad: datos.get("avisoPrivacidad") === "on",
    usoImagen: datos.get("usoImagen") === "on",
    tutorExistenteId: datos.get("tutorExistenteId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const dias = Number(
    db.select().from(configuracion)
      .where(eq(configuracion.clave, "dias_entrega_credencial")).get()?.valor ?? 7,
  );

  let r: { alumnoId: number; codigo: string };
  try {
    r = convertirProspecto(parsed.data, sesion.usuarioId, dias);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo convertir." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "prospecto.convertir",
    entidad: "prospectos",
    entidadId: parsed.data.prospectoId,
    cambios: { alumnoId: r.alumnoId, codigo: r.codigo },
  });

  redirect(`/alumnos/${r.alumnoId}`);
}
