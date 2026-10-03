import Link from "next/link";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import {
  POR_PAGINA, consultarBitacora, desdeCuandoHayBitacora, quienesAparecen,
} from "@/lib/datos/bitacora";
import {
  NOMBRE_GRUPO, accionesPorGrupo, describir, resumirCambios,
} from "@/lib/dominio/bitacora";
import { fechaMedia, hora } from "@/lib/formato";
import { fechaCivil, hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

type Busqueda = {
  desde?: string; hasta?: string; usuario?: string; accion?: string; q?: string; p?: string;
};

/** A dónde lleva cada renglón, cuando la entidad tiene pantalla propia. */
function enlaceA(entidad: string, id: number | null): string | null {
  if (id === null) return null;
  const rutas: Record<string, string> = {
    alumnos: "/alumnos", inscripciones: "/alumnos", usuarios: "/usuarios",
    ejemplares: "/inventario", recitales: "/recitales", prospectos: "/prospectos",
  };
  const base = rutas[entidad];
  return base ? `${base}/${id}` : null;
}

export default async function Bitacora({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sesion = await exigirPermiso("bitacora.leer");
  const s = await searchParams;

  const hoy = hoyEnMexico();
  const filtro = {
    desde: s.desde || null,
    hasta: s.hasta || null,
    usuarioId: s.usuario ? Number(s.usuario) : null,
    accion: s.accion || null,
    q: s.q || null,
    pagina: Math.max(1, Number(s.p) || 1),
  };

  const { movimientos, total } = consultarBitacora(filtro);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desdeCuando = desdeCuandoHayBitacora();
  const gente = quienesAparecen();

  const conFiltro = Boolean(filtro.desde || filtro.hasta || filtro.usuarioId || filtro.accion || filtro.q);

  const liga = (cambios: Partial<Busqueda>) => {
    const u = new URLSearchParams();
    const base: Busqueda = { desde: s.desde, hasta: s.hasta, usuario: s.usuario, accion: s.accion, q: s.q };
    for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v) u.set(k, String(v));
    const qs = u.toString();
    return qs ? `/bitacora?${qs}` : "/bitacora";
  };

  const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

  return (
    <>
      <Encabezado sesion={sesion} activo="bitacora" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Bitácora</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Quién hizo qué y cuándo. No se edita ni se borra: solo se le agregan renglones.
          Es lo que permite responder «¿quién cambió esa asistencia?» o «¿quién abrió el
          expediente de salud de ese niño?» sin que la respuesta dependa de la memoria de
          nadie.
          {desdeCuando && (
            <> Hay registro desde el {fechaMedia(desdeCuando)}.</>
          )}
        </p>

        <form method="get" action="/bitacora"
              className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-vs-linea bg-white p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="desde" className="text-xs font-medium text-vs-tinta-2">Desde</label>
            <input id="desde" name="desde" type="date" max={hoy} defaultValue={s.desde ?? ""}
                   className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hasta" className="text-xs font-medium text-vs-tinta-2">Hasta</label>
            <input id="hasta" name="hasta" type="date" max={hoy} defaultValue={s.hasta ?? ""}
                   className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="usuario" className="text-xs font-medium text-vs-tinta-2">Quién</label>
            <select id="usuario" name="usuario" defaultValue={s.usuario ?? ""} className={campo}>
              <option value="">Cualquiera</option>
              {gente.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="accion" className="text-xs font-medium text-vs-tinta-2">Qué hizo</label>
            <select id="accion" name="accion" defaultValue={s.accion ?? ""} className={campo}>
              <option value="">Cualquier cosa</option>
              {accionesPorGrupo().map((g) => (
                <optgroup key={g.grupo} label={NOMBRE_GRUPO[g.grupo]}>
                  {g.acciones.map((a) => (
                    <option key={a.clave} value={a.clave}>{a.texto}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q" className="text-xs font-medium text-vs-tinta-2">Contiene</label>
            <input id="q" name="q" defaultValue={s.q ?? ""} className={campo}
                   placeholder="un folio, un motivo…" />
          </div>
          <button type="submit"
                  className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta
                             transition hover:bg-vs-naranja-claro">
            Buscar
          </button>
          {conFiltro && (
            <Link href="/bitacora"
                  className="rounded-lg border border-vs-linea px-4 py-2 text-sm font-medium
                             no-underline transition hover:border-vs-naranja-700">
              Quitar filtros
            </Link>
          )}
        </form>

        <p id="conteo-bitacora" className="mt-4 text-sm text-vs-tinta-2">
          {total === 0
            ? "Ningún movimiento con esos filtros."
            : total === 1
              ? "Un movimiento."
              : `${total.toLocaleString("es-MX")} movimientos${paginas > 1 ? ` · página ${filtro.pagina} de ${paginas}` : ""}.`}
        </p>

        {movimientos.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
            <table id="tabla-bitacora" className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  <th className="px-4 py-2.5 text-left font-semibold">Cuándo</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Quién</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Qué hizo</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Sobre qué</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const d = describir(m.accion);
                  const detalle = resumirCambios(m.cambios);
                  const href = enlaceA(m.entidad, m.entidadId);
                  return (
                    <tr key={m.id} data-movimiento={m.id}
                        className={`border-t border-vs-linea align-top ${d.delicado ? "bg-amber-50/60" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-vs-tinta-2">
                        {fechaCivil(m.creadoEn)}
                        <span className="block text-[11px] text-vs-tinta-3">{hora(m.creadoEn)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {m.quien ?? <span className="text-vs-tinta-3">El sistema</span>}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {d.texto}
                        {d.delicado && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-800">
                            delicado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">
                        {href
                          ? <Link href={href} className="no-underline hover:underline">
                              {m.entidad} #{m.entidadId}
                            </Link>
                          : <>{m.entidad}{m.entidadId !== null && ` #${m.entidadId}`}</>}
                      </td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">
                        {detalle.length === 0
                          ? <span className="text-vs-tinta-3">—</span>
                          : (
                            <ul className="flex flex-col gap-0.5">
                              {detalle.map((c) => (
                                <li key={c.campo}>
                                  <span className="text-[11px] uppercase tracking-wider text-vs-tinta-3">
                                    {c.campo}
                                  </span>{" "}
                                  {c.detalle}
                                </li>
                              ))}
                            </ul>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <nav id="paginas-bitacora" className="mt-4 flex items-center gap-3 text-sm">
            {filtro.pagina > 1 && (
              <Link href={liga({ p: String(filtro.pagina - 1) })}
                    className="rounded-lg border border-vs-linea px-3 py-1.5 no-underline
                               transition hover:border-vs-naranja-700">
                ← Más reciente
              </Link>
            )}
            {filtro.pagina < paginas && (
              <Link href={liga({ p: String(filtro.pagina + 1) })}
                    className="rounded-lg border border-vs-linea px-3 py-1.5 no-underline
                               transition hover:border-vs-naranja-700">
                Más antiguo →
              </Link>
            )}
          </nav>
        )}

        <p className="mt-6 text-xs text-vs-tinta-3">
          La bitácora nunca guarda contraseñas, tokens de credencial ni el contenido de los
          datos de salud: guarda que alguien los abrió, y cuándo.
        </p>
      </main>
    </>
  );
}
