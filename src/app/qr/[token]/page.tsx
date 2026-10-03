import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { EstatusAlumno } from "@/components/estatus-alumno";
import { alcanceDe, exigirPermiso, tienePermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { alumnoPorQr } from "@/lib/datos/alumnos";
import { estatusDeAlumno } from "@/lib/datos/estatus";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

/**
 * Lo que se ve al escanear el QR del alumno.
 *
 * Antes redirigía al expediente completo. El expediente contesta bien «cuéntame
 * todo» y mal «¿este niño puede pasar a su clase?», que es la única pregunta que
 * se hace con un teléfono en la mano frente al mostrador. Ahora aterriza en el
 * estatus, y desde ahí se abre el expediente en un clic.
 *
 * `exigirPermiso` manda a la pantalla de acceso si no hay sesión, y Next conserva
 * el destino: escanear sin sesión no revela absolutamente nada, ni siquiera que el
 * token exista.
 */
export default async function ResolverQr({ params }: { params: Promise<{ token: string }> }) {
  const sesion = await exigirPermiso("alumnos.leer");
  const { token } = await params;

  const alumno = alumnoPorQr(token, alcanceDe(sesion));
  if (!alumno) notFound();

  const hoy = hoyEnMexico();
  const verFinanzas = tienePermiso(sesion, "finanzas.leer") || tienePermiso(sesion, "pagos.registrar");
  const e = estatusDeAlumno(alumno.id, alcanceDe(sesion), verFinanzas, hoy);
  if (!e) notFound();

  // Escanear una credencial es un acceso al expediente y queda registrado como tal:
  // «quién consultó a este alumno y cuándo» tiene que poder contestarse.
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "alumno.consultar_qr",
    entidad: "alumnos",
    entidadId: alumno.id,
    cambios: { via: "qr" },
  });

  return (
    <>
      <Encabezado sesion={sesion} activo="alumnos" />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
          Credencial escaneada
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Estatus</h1>
        <p className="mt-1 text-sm text-vs-tinta-3">{hoy}</p>

        <div className="mt-6">
          <EstatusAlumno e={e} hoy={hoy} verFinanzas={verFinanzas} />
        </div>

        <p className="mt-8 text-xs text-vs-tinta-3">
          <Link href="/alumnos" className="no-underline hover:underline">Buscar otro alumno</Link>
          {" · "}El QR no contiene ningún dato del alumno: solo un token que hay que
          resolver con sesión activa.
        </p>
      </main>
    </>
  );
}
