/**
 * Alta de usuarios desde la terminal.
 *
 *   npm run usuario -- --email juan@violinistar.mx --nombre "Juan Cervantes" --rol director
 *
 * La contraseña se genera aquí y se imprime UNA sola vez. No se pide por argumento
 * a propósito: lo que se escribe en la terminal queda en el historial del shell.
 */

import { and, eq, isNull } from "drizzle-orm";

import { db, sqlite } from "./index";
import { docentes, roles, usuarios } from "./schema/index";
import { generarPasswordInicial, hashearPassword } from "../lib/auth/password";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const nombre = arg("nombre")?.trim();
  const rol = arg("rol")?.trim() as "director" | "docente" | "asistente" | undefined;

  if (!email || !nombre || !rol) {
    console.error(
      'Uso: npm run usuario -- --email correo@dominio.mx --nombre "Nombre Completo" --rol director|docente|asistente',
    );
    process.exit(1);
  }

  if (!["director", "docente", "asistente"].includes(rol)) {
    console.error(`Rol inválido: ${rol}. Debe ser director, docente o asistente.`);
    process.exit(1);
  }

  const filaRol = db.select().from(roles).where(eq(roles.clave, rol)).get();
  if (!filaRol) {
    console.error(`El rol "${rol}" no existe. ¿Corriste npm run db:seed?`);
    process.exit(1);
  }

  const existente = db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).get();
  if (existente) {
    console.error(`Ya existe un usuario con el correo ${email}.`);
    process.exit(1);
  }

  const password = generarPasswordInicial();
  const hashPassword = await hashearPassword(password);

  const [usuario] = db.insert(usuarios)
    .values({ email, nombre, hashPassword, rolId: filaRol.id })
    .returning({ id: usuarios.id })
    .all();

  if (!usuario) {
    console.error("No se pudo crear el usuario.");
    process.exit(1);
  }

  // Un docente necesita además su ficha laboral, que es lo que las clases
  // referencian. Sin ella el usuario entra pero no tiene alumnos asignados.
  //
  // Si ya existe una ficha con ese nombre y sin cuenta —el caso normal: el
  // maestro llevaba meses dando clase antes de que le dieran acceso— se vincula
  // en vez de duplicarla. Crear una segunda dejaría su historial partido en dos.
  let vinculado: "creada" | "vinculada" = "creada";
  if (rol === "docente") {
    const existente = db.select({ id: docentes.id })
      .from(docentes)
      .where(and(eq(docentes.nombre, nombre), isNull(docentes.usuarioId)))
      .get();

    if (existente) {
      db.update(docentes).set({ usuarioId: usuario.id, email })
        .where(eq(docentes.id, existente.id)).run();
      vinculado = "vinculada";
    } else {
      db.insert(docentes).values({ usuarioId: usuario.id, nombre, email }).run();
    }
  }

  sqlite.close();

  console.log(`
  Usuario creado.

    Nombre      ${nombre}
    Correo      ${email}
    Rol         ${rol}${rol === "docente" ? `\n    Ficha       ${vinculado} en docentes` : ""}
    Contraseña  ${password}

  Esta contraseña no se vuelve a mostrar. Entrégala en persona o por un canal
  distinto al correo, y pide que se cambie en el primer acceso.
`);
}

main();
