import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuarios } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { exigirSesion } from "@/lib/auth/permisos";
import { debeCambiarPassword } from "@/lib/dominio/usuarios";
import { fechaLarga } from "@/lib/formato";
import { CambiarPassword } from "./cliente";

export const dynamic = "force-dynamic";

const TITULO_ROL = { director: "Director", docente: "Maestro", asistente: "Asistente" } as const;

export default async function Perfil() {
  const sesion = await exigirSesion();

  const u = db.select({
    email: usuarios.email,
    nombre: usuarios.nombre,
    passwordCambiadaEn: usuarios.passwordCambiadaEn,
    creadoEn: usuarios.creadoEn,
  }).from(usuarios).where(eq(usuarios.id, sesion.usuarioId)).get();

  const pendiente = debeCambiarPassword(u?.passwordCambiadaEn ?? null);

  return (
    <>
      <Encabezado sesion={sesion} activo="perfil" soloSalir={pendiente} />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Tu cuenta</h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          {TITULO_ROL[sesion.rol]} {u?.nombre} · {u?.email}
        </p>

        {pendiente && (
          <div id="aviso-password-inicial"
               className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-lg font-semibold text-amber-900">
              Sigues usando la contraseña que generó el sistema
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Esa contraseña viajó por WhatsApp o en un papel, así que la conoce más de una
              persona. Cámbiala ahora: es lo único que hace que la bitácora signifique algo —
              «quién hizo esto» solo tiene respuesta si nadie más puede entrar como tú.
            </p>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Cambiar la contraseña</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            {pendiente
              ? "Al cambiarla dejarás de ver este aviso."
              : `La cambiaste el ${fechaLarga(u!.passwordCambiadaEn!)}.`}
          </p>
          <div className="mt-4"><CambiarPassword /></div>
        </section>

        <p className="mt-6 text-xs text-vs-tinta-3">
          La sesión cierra sola tras 30 minutos sin actividad, y a las 12 horas en cualquier
          caso. Al cambiar la contraseña se cierran las demás sesiones, no esta.
          {" "}
          {pendiente
            ? "Hasta que la cambies, el resto del sistema te regresa a esta pantalla."
            : <Link href="/" className="no-underline hover:underline">Volver al tablero</Link>}
        </p>
      </main>
    </>
  );
}
