"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { configuracion } from "@/db/schema/index";
import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { crearAlumno } from "@/lib/datos/alumnos";
import { esMenorDeEdad } from "@/lib/formato";

const texto = (max = 200) =>
  z.string().trim().max(max).transform((s) => (s === "" ? null : s));

const correo = z.string().trim().max(150)
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "Correo inválido.");

const Alta = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo del alumno.").max(150),
  fechaNacimiento: z.string().trim()
    .transform((s) => (s === "" ? null : s))
    .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), "Fecha de nacimiento inválida."),
  sexo: z.string().trim().transform((s) => (s === "" ? null : s))
    .refine((s) => s === null || ["F", "M", "otro", "no_especifica"].includes(s), "Valor inválido.")
    .transform((s) => s as "F" | "M" | "otro" | "no_especifica" | null),
  telefono: texto(20),
  email: correo,
  direccion: texto(250),
  colonia: texto(120),
  objetivoMusical: texto(500),
  experienciaPrevia: texto(500),
  observaciones: texto(1000),

  tutorExistenteId: z.string().trim().optional().transform((v) => (!v ? null : Number(v)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Tutor inválido."),
  tutorNombre: texto(150),
  tutorParentesco: texto(60),
  tutorTelefono: texto(20),
  tutorWhatsapp: texto(20),
  tutorEmail: correo,

  condicionSalud: texto(500),
  trastornoAprendizaje: texto(500),
  discapacidadSensorial: texto(500),
  medicamentos: texto(500),
  consideracionEmocional: texto(500),
  saludObservaciones: texto(1000),

  avisoPrivacidad: z.boolean(),
  usoImagen: z.boolean(),
});

export type EstadoAlta = { error?: string; campo?: string };

export async function darDeAlta(_previo: EstadoAlta, datos: FormData): Promise<EstadoAlta> {
  const sesion = await exigirPermiso("alumnos.crear");

  // Se recorre el esquema, no el FormData: un campo que la pantalla ocultó —los
  // datos del tutor cuando se eligió uno del padrón— simplemente no llega, y
  // tratar esa ausencia como error convertiría ocultar un campo en un bug.
  const crudo = Object.fromEntries(
    Object.keys(Alta.shape).map((k) => [k, String(datos.get(k) ?? "")]),
  );
  const parsed = Alta.safeParse({
    ...crudo,
    avisoPrivacidad: datos.get("avisoPrivacidad") === "on",
    usoImagen: datos.get("usoImagen") === "on",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Revisa los datos.", campo: String(issue?.path[0] ?? "") };
  }

  const d = parsed.data;

  // El contrato hace responsable al tutor cuando el alumno es menor, así que sin
  // tutor el expediente quedaría sin quién responda por él.
  const menor = esMenorDeEdad(d.fechaNacimiento);
  if (menor && !d.tutorNombre && d.tutorExistenteId === null) {
    return {
      error: "El alumno es menor de edad: el contrato exige registrar a su padre, madre o tutor.",
      campo: "tutorNombre",
    };
  }

  // El aviso de privacidad no es opcional: sin él no hay base legal para tratar
  // los datos. El uso de imagen sí lo es, y el "no" se guarda igual que el "sí".
  if (!d.avisoPrivacidad) {
    return {
      error: "Falta confirmar que se dio a conocer el aviso de privacidad.",
      campo: "avisoPrivacidad",
    };
  }

  const dias = Number(
    db.select().from(configuracion)
      .where(eq(configuracion.clave, "dias_entrega_credencial")).get()?.valor ?? 7,
  );

  const creado = crearAlumno({
    nombre: d.nombre,
    fechaNacimiento: d.fechaNacimiento,
    sexo: d.sexo,
    telefono: d.telefono,
    email: d.email,
    direccion: d.direccion,
    colonia: d.colonia,
    objetivoMusical: d.objetivoMusical,
    experienciaPrevia: d.experienciaPrevia,
    observaciones: d.observaciones,
    // Un tutor del padrón o uno nuevo: en ambos casos hay tutor.
    tutor: (d.tutorExistenteId !== null || d.tutorNombre)
      ? {
          existenteId: d.tutorExistenteId,
          nombre: d.tutorNombre ?? "",
          parentesco: d.tutorParentesco ?? "Tutor",
          telefono: d.tutorTelefono,
          whatsapp: d.tutorWhatsapp ?? d.tutorTelefono,
          email: d.tutorEmail,
          esResponsablePago: true,
        }
      : null,
    salud: {
      condicionSalud: d.condicionSalud,
      trastornoAprendizaje: d.trastornoAprendizaje,
      discapacidadSensorial: d.discapacidadSensorial,
      medicamentos: d.medicamentos,
      consideracionEmocional: d.consideracionEmocional,
      observaciones: d.saludObservaciones,
    },
    consiente: {
      avisoPrivacidad: d.avisoPrivacidad,
      usoImagen: d.usoImagen,
      otorgadoPor: d.tutorNombre ?? d.nombre,
    },
  }, sesion.usuarioId, dias);

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.crear",
    entidad: "alumnos",
    entidadId: creado.id,
    // El token del QR no entra a la bitácora: es una credencial, no un dato.
    cambios: { codigo: creado.codigo, menorDeEdad: menor, usoImagen: d.usoImagen },
  });

  redirect(`/alumnos/${creado.id}`);
}
