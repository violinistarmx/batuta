"use server";

import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { generarPasswordInicial } from "@/lib/auth/password";
import { registrar } from "@/lib/bitacora";
import {
  cambiarRol, crearUsuario, desactivar, reactivar, restablecerPassword,
} from "@/lib/datos/usuarios";
import { NOMBRE_ROL } from "@/lib/dominio/usuarios";

const ROLES = ["director", "docente", "asistente"] as const;

/**
 * La contraseña generada viaja en el estado de la acción, nunca en la URL.
 *
 * Una contraseña en la barra de direcciones queda en el historial del navegador,
 * en el registro del servidor y en el enlace que alguien pega en un chat. Aquí
 * vive en memoria el tiempo que dure la pantalla y después no existe en ninguna
 * parte: ni siquiera la base la guarda, solo su hash.
 */
export type EstadoCuentas = {
  error?: string;
  ok?: string;
  credencial?: { id: number; nombre: string; email: string; rol: string; password: string };
};

// -------------------------------------------------------------- alta ---

const Alta = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo.").max(120),
  email: z.string().trim().max(160),
  rol: z.enum(ROLES),
  /** Ficha de maestro existente a la que se liga la cuenta. "" = ninguna. */
  docenteId: z.string().trim().transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || Number.isInteger(n), "Maestro inválido."),
});

export async function darDeAltaCuenta(
  _previo: EstadoCuentas,
  datos: FormData,
): Promise<EstadoCuentas> {
  const sesion = await exigirPermiso("usuarios.gestionar");

  const crudo = Object.fromEntries(
    Object.keys(Alta.shape).map((k) => [k, String(datos.get(k) ?? "")]),
  );
  const parsed = Alta.safeParse(crudo);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const { nombre, email, rol, docenteId } = parsed.data;

  let creada: { id: number; password: string };
  try {
    creada = await crearUsuario(
      { nombre, email, rol, docenteId: rol === "docente" ? docenteId : null },
      generarPasswordInicial,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la cuenta." };
  }

  // La contraseña no entra a la bitácora. Lo que se audita es que la cuenta nació.
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "usuario.crear",
    entidad: "usuarios",
    entidadId: creada.id,
    cambios: { nombre, email, rol, docenteId: rol === "docente" ? docenteId : null },
  });

  return {
    credencial: {
      id: creada.id, nombre, email, rol: NOMBRE_ROL[rol], password: creada.password,
    },
  };
}

// ------------------------------------------------------- restablecer ---

export async function restablecerCuenta(
  _previo: EstadoCuentas,
  datos: FormData,
): Promise<EstadoCuentas> {
  const sesion = await exigirPermiso("usuarios.gestionar");

  const id = Number(datos.get("id"));
  const nombre = String(datos.get("nombre") ?? "");
  const email = String(datos.get("email") ?? "");
  const rol = String(datos.get("rol") ?? "");
  if (!Number.isInteger(id)) return { error: "Cuenta inválida." };

  let password: string;
  try {
    password = await restablecerPassword(id, generarPasswordInicial);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo restablecer." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "usuario.editar",
    entidad: "usuarios",
    entidadId: id,
    cambios: { passwordRestablecida: true, sesionesCerradas: true },
  });

  return { credencial: { id, nombre, email, rol, password } };
}

// ------------------------------------------- desactivar / reactivar ---

export async function cambiarEstadoCuenta(
  _previo: EstadoCuentas,
  datos: FormData,
): Promise<EstadoCuentas> {
  const sesion = await exigirPermiso("usuarios.gestionar");

  const id = Number(datos.get("id"));
  const accion = String(datos.get("accion") ?? "");
  if (!Number.isInteger(id)) return { error: "Cuenta inválida." };

  try {
    if (accion === "desactivar") desactivar(id, sesion.usuarioId);
    else if (accion === "reactivar") reactivar(id);
    else return { error: "Acción desconocida." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo hacer el cambio." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: accion === "desactivar" ? "usuario.desactivar" : "usuario.editar",
    entidad: "usuarios",
    entidadId: id,
    cambios: { activo: accion === "desactivar" ? [true, false] : [false, true] },
  });

  return {
    ok: accion === "desactivar"
      ? "Cuenta desactivada. Sus sesiones abiertas se cerraron."
      : "Cuenta reactivada. Puede volver a entrar con su contraseña de siempre.",
  };
}

// -------------------------------------------------------------- rol ---

export async function cambiarRolCuenta(
  _previo: EstadoCuentas,
  datos: FormData,
): Promise<EstadoCuentas> {
  const sesion = await exigirPermiso("usuarios.gestionar");

  const id = Number(datos.get("id"));
  const rol = String(datos.get("rol") ?? "");
  if (!Number.isInteger(id)) return { error: "Cuenta inválida." };
  if (!ROLES.includes(rol as (typeof ROLES)[number])) return { error: "Rol inválido." };

  try {
    cambiarRol(id, rol as (typeof ROLES)[number], sesion.usuarioId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el rol." };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "usuario.editar",
    entidad: "usuarios",
    entidadId: id,
    cambios: { rol },
  });

  return { ok: `Ahora entra como ${NOMBRE_ROL[rol as (typeof ROLES)[number]]}.` };
}

