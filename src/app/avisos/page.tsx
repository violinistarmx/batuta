import { Encabezado } from "@/components/encabezado";
import { exigirSesionUsable, tienePermiso } from "@/lib/auth/permisos";
import { adjuntosDeGrupos, bandejaDe, docentesActivos } from "@/lib/datos/avisos";
import { fechaMedia } from "@/lib/formato";
import { FormularioAviso, MarcarLeidos } from "./cliente";

export const dynamic = "force-dynamic";

export default async function Avisos() {
  const sesion = await exigirSesionUsable();
  const bandeja = bandejaDe(sesion.usuarioId);
  const sinLeer = bandeja.filter((a) => a.leidoEn === null).length;
  const adjuntos = adjuntosDeGrupos(bandeja.map((a) => a.grupo).filter((g): g is string => g !== null));

  const puedeEnviar = tienePermiso(sesion, "avisos.enviar");
  const maestros = puedeEnviar ? docentesActivos() : [];

  return (
    <>
      <Encabezado sesion={sesion} />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Avisos</h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          {sinLeer > 0
            ? `Tienes ${sinLeer} ${sinLeer === 1 ? "aviso nuevo" : "avisos nuevos"}.`
            : "Estás al día."}
        </p>

        {puedeEnviar && (
          <details open className="mt-6 rounded-xl border border-vs-linea bg-white p-5">
            <summary className="cursor-pointer font-display text-lg font-semibold">
              Redactar aviso
            </summary>
            <p className="mt-2 text-sm text-vs-tinta-2">
              Llega a la campana de cada maestro. Lo leen al iniciar sesión.
            </p>
            <FormularioAviso maestros={maestros} />
          </details>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {bandeja.length === 0 && (
            <li className="rounded-xl border border-vs-linea bg-white px-4 py-6 text-center text-sm text-vs-tinta-3">
              Todavía no tienes avisos.
            </li>
          )}
          {bandeja.map((a) => {
            const nuevo = a.leidoEn === null;
            const archivos = a.grupo ? (adjuntos.get(a.grupo) ?? []) : [];
            return (
              <li
                key={a.id}
                className={`rounded-xl border p-4 ${
                  nuevo ? "border-vs-naranja bg-vs-amarillo-suave/40" : "border-vs-linea bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">{a.asunto}</h2>
                  {nuevo && (
                    <span className="rounded bg-vs-naranja px-2 py-0.5 text-[11px] font-semibold text-vs-tinta">
                      Nuevo
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-vs-tinta-3">
                  De {a.remitente} · {fechaMedia(a.creadoEn)}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm text-vs-tinta">{a.cuerpo}</p>

                {archivos.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3">
                    {archivos.map((f) =>
                      f.tipoMime.startsWith("image/") ? (
                        <a key={f.id} href={`/api/avisos/${f.id}`} target="_blank" rel="noopener noreferrer"
                           className="block w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/avisos/${f.id}`}
                            alt={f.nombre}
                            loading="lazy"
                            className="max-h-56 rounded-lg border border-vs-linea bg-white object-contain"
                          />
                        </a>
                      ) : (
                        <a key={f.id} href={`/api/avisos/${f.id}`} target="_blank" rel="noopener noreferrer"
                           className="flex w-fit items-center gap-2 rounded-lg border border-vs-linea bg-white
                                      px-3 py-2 text-sm no-underline transition hover:bg-vs-crema">
                          <span className="font-medium text-vs-tinta">{f.nombre}</span>
                          <span className="text-xs text-vs-tinta-3">PDF · abrir</span>
                        </a>
                      ),
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {sinLeer > 0 && <MarcarLeidos />}
      </main>
    </>
  );
}
