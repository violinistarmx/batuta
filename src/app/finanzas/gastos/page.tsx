import Link from "next/link";

import { exigirPermiso } from "@/lib/auth/permisos";
import { categoriasDeGasto, gastosDelPeriodo, matrizDeGastos } from "@/lib/datos/gastos";
import { limitesDeMes, mesesDelAnio, nombreCortoDeMes, nombreDeMes } from "@/lib/finanzas/fechas";
import { pesosExactos } from "@/lib/formato";
import { hoyEnMexico } from "@/lib/zona";

export const dynamic = "force-dynamic";

type Busqueda = { anio?: string; mes?: string; categoria?: string };

/**
 * Gastos: la matriz anual categoría × mes y el detalle de la celda elegida.
 *
 * Una celda puede sumar varios gastos, así que no se edita como número suelto: al
 * tocarla se abre su detalle, donde cada gasto se edita o se elimina, y el «+» de la
 * celda agrega uno con la categoría y el mes ya puestos.
 */
export default async function PaginaGastos({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sesion = await exigirPermiso("gastos.gestionar");
  const sp = await searchParams;

  const hoy = hoyEnMexico();
  const anioHoy = Number(hoy.slice(0, 4));
  const anio = Number(sp.anio) >= 2000 && Number(sp.anio) <= anioHoy + 1 ? Number(sp.anio) : anioHoy;
  const meses = mesesDelAnio(anio);
  const mesSel = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) && sp.mes.startsWith(String(anio))
    ? sp.mes
    : anio === anioHoy ? hoy.slice(0, 7) : null;
  const catSel = Number(sp.categoria) > 0 ? Number(sp.categoria) : null;

  const categorias = categoriasDeGasto();
  const celdas = matrizDeGastos(anio);
  const valor = (cat: number | null, mes: string) =>
    celdas.find((c) => c.categoriaId === cat && c.mes === mes)?.totalCentavos ?? 0;
  const conValor = new Set(celdas.map((c) => c.categoriaId));
  const filas = [
    ...categorias.filter((c) => c.activo || conValor.has(c.id)).map((c) => ({ id: c.id as number | null, nombre: c.nombre, color: c.color })),
    ...(conValor.has(null) ? [{ id: null, nombre: "Sin categoría", color: "#94a3b8" }] : []),
  ];
  const totalMes = meses.map((m) => celdas.filter((c) => c.mes === m).reduce((s, c) => s + c.totalCentavos, 0));
  const totalAnio = totalMes.reduce((s, v) => s + v, 0);

  const [desde, hasta] = mesSel ? limitesDeMes(mesSel) : [`${anio}-01-01`, `${anio}-12-31`];
  const lista = gastosDelPeriodo(desde, hasta, { categoriaId: catSel });
  const totalLista = lista.reduce((s, g) => s + g.montoCentavos, 0);
  const catNombre = categorias.find((c) => c.id === catSel)?.nombre;

  const url = (cambios: Partial<{ anio: number; mes: string | null; categoria: number | null }>) => {
    const p = new URLSearchParams();
    p.set("anio", String(cambios.anio ?? anio));
    const m = cambios.mes === undefined ? mesSel : cambios.mes;
    const c = cambios.categoria === undefined ? catSel : cambios.categoria;
    if (m) p.set("mes", m);
    if (c) p.set("categoria", String(c));
    return `/finanzas/gastos?${p}`;
  };
  const volverAqui = url({});

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-vs-tinta-3">
              <Link href="/finanzas" className="no-underline hover:underline">Finanzas</Link>
              {" "}›{" "}Gastos
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Gastos {anio}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={url({ anio: anio - 1, mes: null })}
                  className="rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm no-underline">← {anio - 1}</Link>
            {anio < anioHoy && (
              <Link href={url({ anio: anio + 1, mes: null })}
                    className="rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm no-underline">{anio + 1} →</Link>
            )}
            <Link href="/finanzas/gastos/categorias"
                  className="rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm font-medium no-underline">
              Categorías
            </Link>
            <Link
              href={`/finanzas/gastos/nuevo?volver=${encodeURIComponent(volverAqui)}`}
              className="rounded-lg bg-vs-naranja px-4 py-2 text-sm font-semibold text-vs-tinta no-underline
                         transition hover:bg-vs-naranja-700 hover:text-white"
            >
              + Nuevo gasto
            </Link>
          </div>
        </div>

        {/* ── Matriz anual ───────────────────────────────────────────────── */}
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold">Matriz por categoría y mes</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Toca una celda para ver y editar sus gastos; el «+» agrega uno en esa categoría y ese mes.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-vs-linea bg-white">
            <table className="w-full min-w-[980px] border-collapse text-xs tabular-nums">
              <thead>
                <tr className="bg-vs-crema text-[10px] uppercase tracking-wider text-vs-tinta-3">
                  <th className="sticky left-0 z-10 bg-vs-crema px-3 py-2 text-left font-semibold">Categoría</th>
                  {meses.map((m) => (
                    <th key={m} className="px-2 py-2 text-right font-semibold">
                      <Link href={url({ mes: m, categoria: null })}
                            className={`no-underline hover:underline ${m === mesSel ? "text-vs-naranja-700" : ""}`}>
                        {nombreCortoDeMes(m)}
                      </Link>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const total = meses.reduce((s, m) => s + valor(f.id, m), 0);
                  return (
                    <tr key={f.id ?? "sin"} className="border-t border-vs-linea">
                      <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                          {f.nombre}
                        </span>
                      </th>
                      {meses.map((m) => {
                        const v = valor(f.id, m);
                        const activa = m === mesSel && f.id === catSel;
                        return (
                          <td key={m} className={`group relative px-0 py-0 text-right ${activa ? "bg-amber-50" : ""}`}>
                            <Link
                              href={url({ mes: m, categoria: f.id })}
                              className={`block px-2 py-1.5 no-underline hover:bg-vs-crema ${v === 0 ? "text-vs-tinta-3/60" : "text-vs-tinta"}`}
                              aria-label={`${f.nombre}, ${nombreDeMes(m)}: ${pesosExactos(v)}. Ver gastos`}
                            >
                              {v === 0 ? "—" : pesosExactos(v)}
                            </Link>
                            {f.id !== null && (
                              <Link
                                href={`/finanzas/gastos/nuevo?categoria=${f.id}&mes=${m}&volver=${encodeURIComponent(url({ mes: m, categoria: f.id }))}`}
                                className="absolute left-0.5 top-1/2 hidden -translate-y-1/2 rounded bg-vs-naranja px-1 text-[10px] font-bold leading-4 text-vs-tinta no-underline group-hover:block group-focus-within:block"
                                aria-label={`Agregar gasto de ${f.nombre} en ${nombreDeMes(m)}`}
                              >
                                +
                              </Link>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-right font-semibold">{pesosExactos(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-vs-linea bg-vs-crema font-semibold">
                  <th scope="row" className="sticky left-0 z-10 bg-vs-crema px-3 py-2 text-left">Total</th>
                  {totalMes.map((v, i) => <td key={meses[i]} className="px-2 py-2 text-right">{pesosExactos(v)}</td>)}
                  <td className="px-3 py-2 text-right">{pesosExactos(totalAnio)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-vs-tinta-3">
            El costo docente no aparece aquí: sale de las clases impartidas y la nómina, no de gastos capturados.
          </p>
        </section>

        {/* ── Detalle ────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">
              {catNombre ?? "Todos los gastos"} · {mesSel ? `${nombreDeMes(mesSel)} ${anio}` : `año ${anio}`}
              <span className="ml-2 text-sm font-normal text-vs-tinta-3">({lista.length})</span>
            </h2>
            <div className="flex items-baseline gap-3">
              {(catSel || mesSel) && (
                <Link href={url({ mes: null, categoria: null })} className="text-sm no-underline hover:underline">
                  Ver todo el año
                </Link>
              )}
              <p className="text-sm font-semibold tabular-nums">Total: {pesosExactos(totalLista)}</p>
            </div>
          </div>

          {lista.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-vs-linea bg-white p-8 text-center text-sm text-vs-tinta-3">
              Sin gastos registrados aquí.{" "}
              <Link
                href={`/finanzas/gastos/nuevo?${catSel ? `categoria=${catSel}&` : ""}${mesSel ? `mes=${mesSel}&` : ""}volver=${encodeURIComponent(volverAqui)}`}
                className="font-medium text-vs-naranja-700 no-underline hover:underline"
              >
                Registrar uno →
              </Link>
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-vs-linea bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                    <th className="px-4 py-2.5 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Categoría</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Concepto</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Sede · Programa</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Monto</th>
                    <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((g) => (
                    <tr key={g.id} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 tabular-nums text-vs-tinta-2">{g.fecha}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-vs-crema px-2.5 py-0.5 text-[11px] text-vs-tinta-2">
                          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: g.categoriaColor ?? "#94a3b8" }} />
                          {g.categoriaNombre ?? "Sin categoría"}
                          {g.subcategoria && <span className="text-vs-tinta-3">· {g.subcategoria}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{g.concepto}</td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">{g.tipo === "fijo" ? "Fijo" : "Variable"}</td>
                      <td className="px-4 py-2.5 text-vs-tinta-3">
                        {g.sede ?? "General"}{g.programa ? ` · ${g.programa}` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{pesosExactos(g.montoCentavos)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/finanzas/gastos/editar?id=${g.id}&volver=${encodeURIComponent(volverAqui)}`}
                          className="text-xs text-vs-tinta-3 no-underline hover:text-vs-naranja-700 hover:underline"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
