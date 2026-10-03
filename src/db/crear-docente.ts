/**
 * Alta de maestros desde la terminal.
 *
 *   npm run docente -- --nombre "Ana Ramírez" --telefono 7711234567
 *
 * Un docente existe aunque no use el sistema: la ficha laboral es lo que las
 * clases y la nómina referencian, y vincularla a un usuario es opcional. Para
 * darle acceso, créale además una cuenta con `npm run usuario -- --rol docente`.
 */

import { eq } from "drizzle-orm";

import { db, sqlite } from "./index";
import { docentes, usuarios } from "./schema/index";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const nombre = arg("nombre")?.trim();
const telefono = arg("telefono")?.trim() ?? null;
const email = arg("email")?.trim().toLowerCase() ?? null;
const tarifa = arg("tarifa-hora");

if (!nombre) {
  console.error('Uso: npm run docente -- --nombre "Ana Ramírez" [--telefono 7711234567] [--email a@b.mx] [--tarifa-hora 140]');
  process.exit(1);
}

// Si ya existe una cuenta con ese correo, se vincula en vez de duplicar.
const usuario = email
  ? db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).get()
  : undefined;

const [creado] = db.insert(docentes).values({
  nombre,
  telefono,
  email,
  usuarioId: usuario?.id ?? null,
  // La tarifa se guarda en centavos por hora. Nula usa la general del sistema.
  tarifaHoraCentavos: tarifa ? Math.round(Number(tarifa) * 100) : null,
}).returning({ id: docentes.id }).all();

sqlite.close();

console.log(`
  Maestro dado de alta.

    Nombre    ${nombre}
    Teléfono  ${telefono ?? "—"}
    Correo    ${email ?? "—"}
    Tarifa    ${tarifa ? `$${tarifa}/hora (propia)` : "la general del sistema"}
    Acceso    ${usuario ? "vinculado a su cuenta" : "sin cuenta (no entra al sistema)"}
    ID        ${creado?.id}
`);
