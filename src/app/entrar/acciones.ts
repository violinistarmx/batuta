"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { usuarios } from "@/db/schema/index";
import { evaluarIntentos, limpiarIntentosDe, registrarIntento } from "@/lib/auth/limite";
import { HASH_SENUELO, verificarPassword } from "@/lib/auth/password";
import { iniciarSesion } from "@/lib/auth/sesion";
import { registrar } from "@/lib/bitacora";

const Credenciales = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export type EstadoAcceso = { error?: string; email?: string };

/**
 * Un solo mensaje para credencial incorrecta, cuenta desactivada y correo
 * inexistente. Decir "ese correo no existe" le confirma a quien prueba cuáles sí
 * están dados de alta.
 */
const GENERICO = "Correo o contraseña incorrectos.";

export async function entrar(
  _previo: EstadoAcceso,
  datos: FormData,
): Promise<EstadoAcceso> {
  const parsed = Credenciales.safeParse({
    email: datos.get("email"),
    password: datos.get("password"),
  });

  const emailCrudo = String(datos.get("email") ?? "").trim().toLowerCase();

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERICO, email: emailCrudo };
  }

  const { email, password } = parsed.data;
  const cabeceras = await headers();
  const ip = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const navegador = cabeceras.get("user-agent");

  const veredicto = evaluarIntentos(email, ip);
  if (!veredicto.permitido) {
    registrarIntento(email, ip, false, "limite_excedido");
    registrar({ usuarioId: null, accion: "sesion.rechazada", entidad: "usuarios", ip });
    return {
      error: `Demasiados intentos. Espera ${veredicto.minutosEspera} minutos e inténtalo de nuevo.`,
      email,
    };
  }

  const usuario = db
    .select({
      id: usuarios.id,
      hashPassword: usuarios.hashPassword,
      activo: usuarios.activo,
    })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .get();

  // Siempre se gasta el mismo trabajo, exista o no la cuenta: si no existe se
  // compara contra un hash señuelo. De lo contrario el tiempo de respuesta
  // delataría qué correos están registrados.
  const coincide = await verificarPassword(usuario?.hashPassword ?? HASH_SENUELO, password);

  if (!usuario || !coincide || !usuario.activo) {
    const motivo = !usuario ? "usuario_inexistente"
      : !coincide ? "password_incorrecta"
      : "usuario_inactivo";
    registrarIntento(email, ip, false, motivo);
    registrar({ usuarioId: usuario?.id ?? null, accion: "sesion.rechazada", entidad: "usuarios", ip });
    return { error: GENERICO, email };
  }

  await iniciarSesion(usuario.id, { ip, navegador });
  registrarIntento(email, ip, true);
  limpiarIntentosDe(email);
  registrar({ usuarioId: usuario.id, accion: "sesion.iniciar", entidad: "usuarios", entidadId: usuario.id, ip });

  redirect("/");
}
