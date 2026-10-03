import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { docentes, permisos, roles, rolesPermisos, usuarios } from "@/db/schema/index";
import { debeCambiarPassword } from "@/lib/dominio/usuarios";
import { sesionActual, type Sesion } from "./sesion";

/**
 * La autorización vive aquí, en la capa de acceso a datos — no en la interfaz ni
 * en un middleware.
 *
 * Un middleware de Next corre en el runtime edge, no puede tocar SQLite, y sobre
 * todo protege *rutas*: en cuanto alguien añade una pantalla nueva o una acción de
 * servidor, la protección se olvida. Obligando a que cada consulta pase por
 * `exigirPermiso`, una pantalla nueva sin guardia simplemente no compila con datos.
 */

/** Cacheado por petición: varias llamadas en el mismo render no repiten la consulta. */
export const permisosDe = cache((usuarioId: number): ReadonlySet<string> => {
  const filas = db
    .select({ clave: permisos.clave })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .innerJoin(rolesPermisos, eq(rolesPermisos.rolId, roles.id))
    .innerJoin(permisos, eq(permisos.id, rolesPermisos.permisoId))
    .where(eq(usuarios.id, usuarioId))
    .all();
  return new Set(filas.map((f) => f.clave));
});

export function tienePermiso(sesion: Sesion, clave: string): boolean {
  return permisosDe(sesion.usuarioId).has(clave);
}

/** Exige sesión activa. Sin ella, manda a la pantalla de acceso. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) redirect("/entrar");
  return sesion;
}

/** Si la cuenta sigue con la contraseña que le generó el sistema. */
export const passwordPendiente = cache((usuarioId: number): boolean => {
  const fila = db
    .select({ cambiadaEn: usuarios.passwordCambiadaEn })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .get();
  return debeCambiarPassword(fila?.cambiadaEn ?? null);
});

/**
 * Exige sesión activa Y contraseña propia.
 *
 * Mientras la cuenta siga con la contraseña que generó el sistema —la que viajó
 * por WhatsApp o en un papel— el sistema entero desemboca en `/perfil`. Decirle a
 * alguien «cámbiala en el primer acceso» y dejarlo trabajar sin hacerlo equivale a
 * no decirlo: es la razón por la que la bitácora deja de significar algo, porque
 * «quién hizo esto» solo tiene respuesta si nadie más podía entrar con esa cuenta.
 *
 * `/perfil` y `/salir` usan `exigirSesion` a secas, si no el redirección sería un
 * círculo y nadie podría cambiarla ni salir.
 */
export async function exigirSesionUsable(): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (passwordPendiente(sesion.usuarioId)) redirect("/perfil");
  return sesion;
}

/**
 * Exige un permiso concreto.
 *
 * Al no tenerlo responde 404, no 403: confirmar que un recurso existe pero está
 * prohibido ya filtra información. Para un docente, el expediente de un alumno
 * ajeno simplemente no existe.
 */
export async function exigirPermiso(clave: string): Promise<Sesion> {
  const sesion = await exigirSesionUsable();
  if (!tienePermiso(sesion, clave)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return sesion;
}

/**
 * Alcance por fila para docentes.
 *
 * Un docente con permiso `clases.leer` no ve todas las clases: ve las suyas. Este
 * valor es el que los repositorios usan para filtrar, y por eso devuelve un objeto
 * explícito en vez de un booleano suelto — así quien lo consume no puede ignorarlo
 * por descuido.
 */
export type Alcance =
  | { tipo: "todo" }
  | { tipo: "propio"; docenteId: number | null };

export const alcanceDe = cache((sesion: Sesion): Alcance => {
  if (sesion.rol !== "docente") return { tipo: "todo" };
  const fila = db
    .select({ id: docentes.id })
    .from(docentes)
    .where(eq(docentes.usuarioId, sesion.usuarioId))
    .get();
  return { tipo: "propio", docenteId: fila?.id ?? null };
});
