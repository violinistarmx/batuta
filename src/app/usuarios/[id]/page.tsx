import Link from "next/link";
import { notFound } from "next/navigation";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { docentes } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { FotoPerfil } from "@/components/foto-perfil";
import { exigirPermiso } from "@/lib/auth/permisos";
import { resumenFotoDocente } from "@/lib/datos/fotos";
import { parametrosNomina } from "@/lib/datos/costo-docente";
import {
  ROLES_SECUNDARIOS_PERMITIDOS, listarUsuarios, rolesSecundariosDe, usuarioPorId,
  type RolSecundario,
} from "@/lib/datos/usuarios";
import {
  NOMBRE_ROL, debeCambiarPassword, motivoParaNoDesactivar,
} from "@/lib/dominio/usuarios";
import { fechaMedia } from "@/lib/formato";
import { asignarRolAdicionalAccion, quitarRolAdicionalAccion } from "../acciones";
import { Administrar } from "./cliente";

const NOMBRE_ADICIONAL: Record<RolSecundario, string> = {
  administradora: "Administradora",
  asistente: "Asistente",
};

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

  const rolesExtra = rolesSecundariosDe(u.id);
  const disponibles = ROLES_SECUNDARIOS_PERMITIDOS.filter(
    (c) => c !== u.rol && !rolesExtra.some((r) => r.clave === c),
  );
  const foto = u.docenteId !== null
    ? resumenFotoDocente(u.docenteId)
    : { tieneFoto: false, version: null };

  const tarifaDocente = u.docenteId !== null
    ? db.select({ tarifaHoraCentavos: docentes.tarifaHoraCentavos })
        .from(docentes).where(eq(docentes.id, u.docenteId)).get()?.tarifaHoraCentavos ?? null
    : null;
  const { tarifaHoraCentavos: tarifaGlobal } = parametrosNomina();

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

        <section id="roles-adicionales" className="mt-5 rounded-xl border border-vs-linea bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Roles adicionales</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Además de su rol principal ({NOMBRE_ROL[u.rol]}), esta cuenta puede tener otro rol.
            Los permisos de todos sus roles se suman.
          </p>

          {rolesExtra.length === 0 ? (
            <p className="mt-3 text-sm text-vs-tinta-3">Ninguno.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {rolesExtra.map((r) => (
                <li key={r.clave}
                    className="flex items-center gap-3 rounded-lg bg-vs-crema px-3 py-1.5 text-sm">
                  <span className="font-medium">{r.nombre}</span>
                  <form action={quitarRolAdicionalAccion}>
                    <input type="hidden" name="usuarioId" value={u.id} />
                    <input type="hidden" name="rol" value={r.clave} />
                    <button type="submit" className="text-xs text-vs-tinta-3 hover:underline">
                      Quitar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {disponibles.length > 0 && (
            <form action={asignarRolAdicionalAccion} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="usuarioId" value={u.id} />
              <label htmlFor="rol-adicional" className="text-xs font-medium text-vs-tinta-2">
                Agregar rol
                <select id="rol-adicional" name="rol" required defaultValue=""
                        className="mt-1 block rounded-lg border border-vs-linea bg-white px-3 py-1.5 text-sm">
                  <option value="" disabled>Elige…</option>
                  {disponibles.map((c) => (
                    <option key={c} value={c}>{NOMBRE_ADICIONAL[c]}</option>
                  ))}
                </select>
              </label>
              <button type="submit"
                      className="rounded-lg bg-vs-naranja px-3.5 py-1.5 text-sm font-semibold text-vs-tinta hover:bg-vs-naranja-claro">
                Agregar
              </button>
            </form>
          )}
        </section>

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
              docenteId: u.docenteId,
              sesionesAbiertas: u.sesionesAbiertas,
              tarifaPropiaCentavos: tarifaDocente,
              tarifaGlobalCentavos: tarifaGlobal,
            }}
            motivoBaja={motivoBaja}
          />
        </div>
      </main>
    </>
  );
}
