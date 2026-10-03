import "server-only";

import { and, asc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { docentes, roles, sesiones, usuarios } from "@/db/schema/index";
import { evaluarPassword, hashearPassword, verificarPassword } from "@/lib/auth/password";
import {
  motivoParaNoCambiarRol, motivoParaNoDesactivar, normalizarCorreo,
  problemasDelCambio, type CuentaResumen, type Rol,
} from "@/lib/dominio/usuarios";

export type FilaUsuario = {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  passwordCambiadaEn: Date | null;
  creadoEn: Date;
  /** Si tiene ficha de maestro ligada: desligarlo rompería su nómina. */
  docenteId: number | null;
  sesionesAbiertas: number;
};

function seleccionUsuarios() {
  return db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      rol: roles.clave,
      activo: usuarios.activo,
      passwordCambiadaEn: usuarios.passwordCambiadaEn,
      creadoEn: usuarios.creadoEn,
      docenteId: sql<number | null>`(
        SELECT d.id FROM docentes d WHERE d.usuario_id = usuarios.id
      )`,
      sesionesAbiertas: sql<number>`(
        SELECT count(*) FROM sesiones s
        WHERE s.usuario_id = usuarios.id AND s.revocada_en IS NULL
          AND s.expira_en > unixepoch()
      )`,
    })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId));
}

export function listarUsuarios(): FilaUsuario[] {
  return seleccionUsuarios()
    .orderBy(asc(usuarios.activo), asc(usuarios.nombre))
    .all() as FilaUsuario[];
}

export function usuarioPorId(id: number): FilaUsuario | undefined {
  return seleccionUsuarios().where(eq(usuarios.id, id)).get() as FilaUsuario | undefined;
}

function resumenes(): CuentaResumen[] {
  return db
    .select({ id: usuarios.id, rol: roles.clave, activo: usuarios.activo })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rolId))
    .all() as CuentaResumen[];
}

function cuentaDe(id: number): CuentaResumen | undefined {
  return resumenes().find((c) => c.id === id);
}

export type DatosNuevoUsuario = {
  email: string;
  nombre: string;
  rol: Rol;
  /** Liga con una ficha de maestro existente, para que la nómina siga siendo suya. */
  docenteId: number | null;
};

/**
 * Da de alta una cuenta y devuelve su contraseña, una sola vez.
 *
 * La contraseña no se pide por formulario: la genera el sistema. Si la escribiera
 * quien da de alta, la conocerían dos personas desde el primer minuto, y la
 * bitácora no podría distinguir quién hizo qué con esa cuenta.
 */
export async function crearUsuario(
  d: DatosNuevoUsuario,
  generarPassword: () => string,
): Promise<{ id: number; password: string }> {
  const correo = normalizarCorreo(d.email);
  if (!correo) throw new Error("El correo no es válido.");

  const existe = db.select({ id: usuarios.id }).from(usuarios)
    .where(eq(usuarios.email, correo)).get();
  if (existe) throw new Error("Ya hay una cuenta con ese correo.");

  const rol = db.select({ id: roles.id }).from(roles).where(eq(roles.clave, d.rol)).get();
  if (!rol) throw new Error("Ese rol no existe.");

  const password = generarPassword();
  const hash = await hashearPassword(password);

  const id = db.transaction((tx) => {
    const fila = tx.insert(usuarios).values({
      email: correo,
      nombre: d.nombre,
      hashPassword: hash,
      rolId: rol.id,
      // Nace en NULL a propósito: el primer acceso desemboca en el cambio.
      passwordCambiadaEn: null,
    }).returning({ id: usuarios.id }).get();
    if (!fila) throw new Error("No se pudo crear la cuenta.");

    // Un maestro necesita además su ficha laboral: es lo que las clases y la
    // nómina referencian. Sin ella la cuenta entra y no tiene un solo alumno.
    if (d.rol === "docente") {
      if (d.docenteId !== null) {
        const doc = tx.select({ id: docentes.id, usuarioId: docentes.usuarioId })
          .from(docentes).where(eq(docentes.id, d.docenteId)).get();
        if (!doc) throw new Error("Ese maestro no existe.");
        if (doc.usuarioId !== null) throw new Error("Ese maestro ya tiene cuenta.");
        tx.update(docentes).set({ usuarioId: fila.id, email: correo })
          .where(eq(docentes.id, d.docenteId)).run();
      } else {
        tx.insert(docentes).values({ usuarioId: fila.id, nombre: d.nombre, email: correo }).run();
      }
    } else if (d.docenteId !== null) {
      throw new Error("Solo una cuenta de maestro se liga a una ficha de maestro.");
    }

    return fila.id;
  });

  return { id, password };
}

/**
 * Desactiva una cuenta y le cierra las sesiones abiertas.
 *
 * Desactivar sin revocar deja a alguien dentro hasta que su sesión caduque —doce
 * horas, en el peor caso—, y quien lo desactivó se queda creyendo que ya salió.
 */
export function desactivar(id: number, actorId: number): void {
  const objetivo = cuentaDe(id);
  if (!objetivo) throw new Error("Esa cuenta no existe.");

  const motivo = motivoParaNoDesactivar(objetivo, actorId, resumenes());
  if (motivo) throw new Error(motivo);

  db.transaction((tx) => {
    tx.update(usuarios).set({ activo: false }).where(eq(usuarios.id, id)).run();
    tx.update(sesiones).set({ revocadaEn: new Date() })
      .where(and(eq(sesiones.usuarioId, id), sql`sesiones.revocada_en IS NULL`)).run();
  });
}

export function reactivar(id: number): void {
  const objetivo = cuentaDe(id);
  if (!objetivo) throw new Error("Esa cuenta no existe.");
  if (objetivo.activo) throw new Error("Esa cuenta ya está activa.");
  db.update(usuarios).set({ activo: true }).where(eq(usuarios.id, id)).run();
}

export function cambiarRol(id: number, rolNuevo: Rol, actorId: number): void {
  const objetivo = cuentaDe(id);
  if (!objetivo) throw new Error("Esa cuenta no existe.");

  const motivo = motivoParaNoCambiarRol(objetivo, rolNuevo, actorId, resumenes());
  if (motivo) throw new Error(motivo);

  const rol = db.select({ id: roles.id }).from(roles).where(eq(roles.clave, rolNuevo)).get();
  if (!rol) throw new Error("Ese rol no existe.");

  db.transaction((tx) => {
    tx.update(usuarios).set({ rolId: rol.id }).where(eq(usuarios.id, id)).run();

    // Quien pasa a ser maestro necesita ficha. Un docente sin ella entra, abre la
    // agenda y no ve un solo alumno —su alcance filtra por una ficha que no
    // existe— sin que nada en pantalla explique por qué.
    if (rolNuevo === "docente") {
      const ficha = tx.select({ id: docentes.id }).from(docentes)
        .where(eq(docentes.usuarioId, id)).get();
      if (!ficha) {
        const u = tx.select({ nombre: usuarios.nombre, email: usuarios.email })
          .from(usuarios).where(eq(usuarios.id, id)).get();
        if (!u) throw new Error("Esa cuenta no existe.");
        tx.insert(docentes).values({ usuarioId: id, nombre: u.nombre, email: u.email }).run();
      }
    }
  });
}

/**
 * Restablece la contraseña: genera una nueva y la devuelve una sola vez.
 *
 * Vuelve a dejar `passwordCambiadaEn` en NULL, así que quien entre con ella
 * aterriza otra vez en la pantalla de cambio. Y se le cierran las sesiones: si la
 * cuenta se restablece porque alguien no reconocido la estaba usando, dejarla
 * abierta no resuelve nada.
 */
export async function restablecerPassword(
  id: number,
  generarPassword: () => string,
): Promise<string> {
  const u = db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, id)).get();
  if (!u) throw new Error("Esa cuenta no existe.");

  const password = generarPassword();
  const hash = await hashearPassword(password);

  db.transaction((tx) => {
    tx.update(usuarios).set({ hashPassword: hash, passwordCambiadaEn: null })
      .where(eq(usuarios.id, id)).run();
    tx.update(sesiones).set({ revocadaEn: new Date() })
      .where(and(eq(sesiones.usuarioId, id), sql`sesiones.revocada_en IS NULL`)).run();
  });

  return password;
}

/**
 * El usuario cambia su propia contraseña.
 *
 * Se exige la actual aunque ya haya sesión: una sesión olvidada abierta en un
 * teléfono no debería bastar para quedarse con la cuenta.
 */
export async function cambiarPasswordPropia(
  usuarioId: number,
  actual: string,
  nueva: string,
  repetida: string,
  sesionActualId: number | null,
): Promise<void> {
  const problemas = problemasDelCambio(actual, nueva, repetida, evaluarPassword(nueva));
  if (problemas.length > 0) throw new Error(problemas.join(" "));

  const u = db.select({ hash: usuarios.hashPassword }).from(usuarios)
    .where(eq(usuarios.id, usuarioId)).get();
  if (!u) throw new Error("Esa cuenta no existe.");

  if (!(await verificarPassword(u.hash, actual))) {
    throw new Error("La contraseña actual no es correcta.");
  }

  const hash = await hashearPassword(nueva);

  db.transaction((tx) => {
    tx.update(usuarios).set({ hashPassword: hash, passwordCambiadaEn: new Date() })
      .where(eq(usuarios.id, usuarioId)).run();

    // Cambiar la contraseña cierra las OTRAS sesiones. La actual sigue viva para
    // no echar de la aplicación a quien acaba de hacer lo correcto.
    tx.update(sesiones).set({ revocadaEn: new Date() })
      .where(and(
        eq(sesiones.usuarioId, usuarioId),
        sql`sesiones.revocada_en IS NULL`,
        ...(sesionActualId !== null ? [ne(sesiones.id, sesionActualId)] : []),
      )).run();
  });
}

/** Maestros sin cuenta, para ligarlos al dar de alta. */
export function docentesSinCuenta() {
  return db.select({ id: docentes.id, nombre: docentes.nombre })
    .from(docentes)
    .where(and(eq(docentes.activo, true), sql`docentes.usuario_id IS NULL`))
    .orderBy(asc(docentes.nombre))
    .all();
}
