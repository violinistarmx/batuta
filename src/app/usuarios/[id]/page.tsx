import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { FotoPerfil } from "@/components/foto-perfil";
import { exigirPermiso } from "@/lib/auth/permisos";
import { resumenFotoDocente } from "@/lib/datos/fotos";
import { listarUsuarios, usuarioPorId } from "@/lib/datos/usuarios";
import {
  NOMBRE_ROL, debeCambiarPassword, motivoParaNoDesactivar,
} from "@/lib/dominio/usuarios";
import { fechaMedia } from "@/lib/formato";
import { Administrar } from "./cliente";

export const dynamic = "force-dynamic";

export default async function Cuenta({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermiso("usuarios.gestionar");

  const { id } = await params;
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId)) notFound();

  const u = usuarioPorId(usuarioId);
  if (!u) notFound();

  // El mismo motivo que va a aplicar el servidor, calculado aquí para poder
  // explicarlo antes de que alguien apriete un botón que no va a funcionar.
  const motivoBaja = motivoParaNoDesactivar(
    { id: u.id, rol: u.rol, activo: u.activo },
    sesion.usuarioId,
    listarUsuarios().map((x) => ({ id: x.id, rol: x.rol, activo: x.activo })),
  );

  const pendiente = debeCambiarPassword(u.passwordCambiadaEn);
  const foto = u.docenteId !== null
    ? resumenFotoDocente(u.docenteId)
    : { tieneFoto: false, version: null };

  return (
    <>
      <Encabezado sesion={sesion} activo="usuarios" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/usuarios" className="text-xs text-vs-tinta-3 no-underline hover:underline">
          ← Cuentas
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{u.nombre}</h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          {NOMBRE_ROL[u.rol]} · {u.email}
          {u.id === sesion.usuarioId && " · eres tú"}
        </p>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-3">
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Estado</dt>
            <dd id="estado-cuenta" className="mt-1 font-display text-lg font-semibold">
              {u.activo ? "Activa" : "Desactivada"}
            </dd>
            <dd className="mt-0.5 text-[11px] text-vs-tinta-3">
              Dada de alta el {fechaMedia(u.creadoEn)}
            </dd>
          </div>
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Contraseña</dt>
            <dd className="mt-1 font-display text-lg font-semibold">
              {pendiente ? "La que se generó" : "Suya"}
            </dd>
            <dd className="mt-0.5 text-[11px] text-vs-tinta-3">
              {pendiente
                ? "No podrá trabajar hasta cambiarla"
                : `La eligió el ${fechaMedia(u.passwordCambiadaEn!)}`}
            </dd>
          </div>
          <div className="bg-white px-4 py-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Sesiones</dt>
            <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
              {u.sesionesAbiertas}
            </dd>
            <dd className="mt-0.5 text-[11px] text-vs-tinta-3">
              {u.sesionesAbiertas === 0 ? "No está dentro ahora" : "Abiertas en este momento"}
            </dd>
          </div>
        </dl>

        {u.docenteId !== null && (
          <>
            <p id="tiene-ficha"
               className="mt-4 rounded-lg border border-vs-linea bg-vs-crema px-4 py-3 text-sm">
              Tiene ficha de maestro. Sus clases, su asistencia y su nómina cuelgan de esa
              ficha, no de la cuenta: desactivarla o cambiarle el rol no borra ni un peso de
              lo que se le debe.{" "}
              <Link href="/finanzas/nomina"
                    className="no-underline hover:underline">Ver su nómina</Link>
            </p>

            <section className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
              <h2 className="font-display text-lg font-semibold">Fotografía</h2>
              <p className="mt-1 text-sm text-vs-tinta-2">
                Se muestra en el sistema para identificar al maestro. No se publica.
              </p>
              <div className="mt-4">
                <FotoPerfil
                  tipo="docente"
                  id={u.docenteId}
                  nombre={u.nombre}
                  tieneFoto={foto.tieneFoto}
                  puedeEditar
                  version={foto.version}
                />
              </div>
            </section>
          </>
        )}

        <div className="mt-7">
          <Administrar
            cuenta={{
              id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo,
              esTuCuenta: u.id === sesion.usuarioId,
              tieneFicha: u.docenteId !== null,
              sesionesAbiertas: u.sesionesAbiertas,
            }}
            motivoBaja={motivoBaja}
          />
        </div>
      </main>
    </>
  );
}
