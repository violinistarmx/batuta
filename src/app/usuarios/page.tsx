import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { listarUsuarios } from "@/lib/datos/usuarios";
import { NOMBRE_ROL, debeCambiarPassword, type Rol } from "@/lib/dominio/usuarios";
import { fechaMedia } from "@/lib/formato";

export const dynamic = "force-dynamic";

const COLOR_ROL: Record<Rol, string> = {
  director: "bg-vs-amarillo-suave text-vs-tinta",
  docente: "bg-green-100 text-green-900",
  asistente: "bg-sky-100 text-sky-900",
};

export default async function Usuarios() {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const lista = listarUsuarios();

  const activas = lista.filter((u) => u.activo);
  const directores = activas.filter((u) => u.rol === "director").length;
  const pendientes = activas.filter((u) => debeCambiarPassword(u.passwordCambiadaEn));
  const dentro = activas.reduce((n, u) => n + (u.sesionesAbiertas > 0 ? 1 : 0), 0);

  const tarjetas = [
    { t: "Cuentas activas", v: activas.length, n: "Pueden entrar hoy" },
    { t: "Directores", v: directores, n: "Quien administra la academia" },
    { t: "Con sesión abierta", v: dentro, n: "Dentro del sistema ahora" },
    { t: "Sin contraseña propia", v: pendientes.length, n: "Siguen con la que se generó" },
  ];

  return (
    <>
      <Encabezado sesion={sesion} activo="usuarios" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Cuentas</h1>
            <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
              Quién puede entrar a Batuta y hasta dónde llega. Desactivar una cuenta no
              borra nada: el historial de esa persona —sus clases, su nómina, lo que
              registró— sigue completo, porque de eso vive la bitácora.
            </p>
          </div>
          <Link
            href="/usuarios/nuevo"
            className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                       no-underline transition hover:bg-vs-naranja-claro"
          >
            Dar de alta una cuenta
          </Link>
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map((x) => (
            <div key={x.t} className="bg-white px-4 py-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{x.t}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.v}</dd>
              <dd className="mt-0.5 text-[11px] text-vs-tinta-3">{x.n}</dd>
            </div>
          ))}
        </dl>

        {pendientes.length > 0 && (
          <section id="sin-password-propia"
                   className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-display text-lg font-semibold">
              Todavía usan la contraseña que generó el sistema
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Esa contraseña se entregó en persona o por mensaje, así que la conoce más de
              una persona. Mientras no la cambien, Batuta los regresa a su perfil y no los
              deja trabajar: es la única forma de que «quién hizo esto» tenga respuesta.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {pendientes.map((u) => (
                <li key={u.id}>
                  <Link href={`/usuarios/${u.id}`}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm
                                   no-underline transition hover:border-vs-naranja-700">
                    {u.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">Todas las cuentas</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
            <table id="tabla-cuentas" className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  <th className="px-4 py-2.5 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Correo</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Rol</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Contraseña</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Sesiones</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} data-cuenta={u.id}
                      className={`border-t border-vs-linea ${u.activo ? "" : "opacity-60"}`}>
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/usuarios/${u.id}`} className="no-underline hover:underline">
                        {u.nombre}
                      </Link>
                      {u.id === sesion.usuarioId && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-vs-tinta-3">
                          eres tú
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-vs-tinta-2">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${COLOR_ROL[u.rol]}`}>
                        {NOMBRE_ROL[u.rol]}
                      </span>
                      {u.docenteId !== null && u.rol !== "docente" && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-vs-tinta-3">
                          con ficha
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-vs-tinta-2">
                      {debeCambiarPassword(u.passwordCambiadaEn)
                        ? <span className="text-amber-800">La que se generó</span>
                        : `Suya desde el ${fechaMedia(u.passwordCambiadaEn!)}`}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-vs-tinta-2">
                      {u.sesionesAbiertas > 0 ? u.sesionesAbiertas : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.activo
                        ? <span className="text-green-800">Activa</span>
                        : <span className="text-vs-tinta-3">Desactivada</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
