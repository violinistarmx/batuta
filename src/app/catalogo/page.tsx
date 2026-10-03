import Link from "next/link";
import { eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { aulas, configuracion, instrumentos, preciosVigencia, programas } from "@/db/schema/index";
import { Encabezado } from "@/components/encabezado";
import { exigirSesionUsable, permisosDe, tienePermiso } from "@/lib/auth/permisos";
import { importeDocenteCentavos, margenDelCiclo } from "@/lib/dominio/nomina";
import { pesos } from "@/lib/formato";

export const dynamic = "force-dynamic";

/**
 * Lo que la academia ES: programas, tarifas, reglas del contrato, instrumentos y
 * cubículos. Vivía en el tablero, donde competía por atención con lo que hay que
 * hacer hoy. Son dos preguntas distintas y merecen dos pantallas.
 */
export default async function Catalogo() {
  const sesion = await exigirSesionUsable();
  const misPermisos = permisosDe(sesion.usuarioId);
  const verFinanzas = tienePermiso(sesion, "finanzas.leer");

  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );
  const tarifaHora = Number(cfg.tarifa_docente_hora_centavos ?? 12000);

  const catalogo = db
    .select({
      nombre: programas.nombre,
      descripcion: programas.descripcion,
      clases: programas.clasesPorCiclo,
      minutos: programas.minutosPorClase,
      alumnosIncluidos: programas.alumnosIncluidos,
      precio: preciosVigencia.precioCentavos,
      orden: programas.orden,
    })
    .from(programas)
    .innerJoin(preciosVigencia, eq(preciosVigencia.programaId, programas.id))
    .where(isNull(preciosVigencia.vigenteHasta))
    .all()
    .sort((a, b) => a.orden - b.orden);

  const listaInstrumentos = db.select().from(instrumentos).all().sort((a, b) => a.orden - b.orden);
  const listaAulas = db.select().from(aulas).all();

  const parametrosClave = [
    ["Aviso mínimo para posponer", `${cfg.horas_aviso_posposicion} h`, "Cláusula 4ª"],
    ["Posposiciones por período", cfg.max_posposiciones_por_ciclo, "Cláusula 4ª"],
    ["Arrastre al mes siguiente", `${cfg.arrastre_max_clases} clases`, "Cláusula 4ª"],
    ["Pago docente por hora", pesos(tarifaHora), "Dirección"],
    ["Falta sin aviso", `${Number(cfg.factor_falta_sin_aviso) * 100} %`, "Dirección"],
    ["Costo de inscripción", pesos(Number(cfg.costo_inscripcion_centavos)), "Cláusula 2ª"],
    ["Credencial oficial", `${cfg.dias_entrega_credencial} días`, "Cláusula 10ª"],
    ["Aviso de baja", `${cfg.horas_aviso_baja} h`, "Cláusula 12ª"],
  ] as const;

  return (
    <>
      <Encabezado sesion={sesion} activo="catalogo" />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Catálogo y reglas</h1>
        <p className="mt-1 max-w-2xl text-sm text-vs-tinta-2">
          Lo que la academia ofrece y bajo qué condiciones. Ninguna de estas reglas está
          escrita en el código: viven en la configuración, con su cláusula de origen.
        </p>

        <section className="mt-7">
          <h2 className="font-display text-xl font-semibold">Programas vigentes</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-vs-linea bg-white">
            <table id="tabla-programas" className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-vs-crema text-[11px] uppercase tracking-wider text-vs-tinta-3">
                  <th className="px-4 py-2.5 text-left font-semibold">Programa</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Descripción</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Horas/mes</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tarifa</th>
                  {verFinanzas && (
                    <>
                      <th className="px-4 py-2.5 text-right font-semibold">Costo docente</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Margen</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {catalogo.map((p) => {
                  // En un plan familiar el maestro imparte las clases de CADA hermano.
                  // Sin multiplicar por los alumnos que cubre el precio, un Family Duet
                  // aparentaría 66.9 % de margen donde el real es 33.8 %.
                  const horas = (p.clases * p.minutos * p.alumnosIncluidos) / 60;
                  const costo = p.clases * p.alumnosIncluidos * importeDocenteCentavos(
                    p.minutos, "asistio",
                    {
                      tarifaHoraCentavos: tarifaHora,
                      factorFaltaSinAviso: Number(cfg.factor_falta_sin_aviso),
                    },
                  );
                  const { margenPorcentaje } = margenDelCiclo(p.precio, costo);
                  return (
                    <tr key={p.nombre} className="border-t border-vs-linea">
                      <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-vs-tinta-2">{p.descripcion}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{horas}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pesos(p.precio)}</td>
                      {verFinanzas && (
                        <>
                          <td className="px-4 py-2.5 text-right tabular-nums text-vs-tinta-2">
                            {pesos(costo)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {margenPorcentaje.toFixed(1)} %
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-xs text-vs-tinta-3">
            La inscripción es gratuita e incluye credencial oficial (cláusula 2ª). En los planes
            familiares las horas son las de todo el grupo: cada hermano recibe sus propias clases
            individuales y el maestro cobra por todas.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Reglas en operación</h2>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-vs-linea bg-vs-linea sm:grid-cols-2 lg:grid-cols-4">
            {parametrosClave.map(([etiqueta, valor, fuente]) => (
              <div key={etiqueta} className="bg-white px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">{etiqueta}</dt>
                <dd className="mt-1 font-medium tabular-nums">{valor}</dd>
                <dd className="mt-0.5 text-[11px] text-vs-tinta-3">{fuente}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Instrumentos <span className="text-vs-tinta-3">({listaInstrumentos.length})</span>
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {listaInstrumentos.map((i) => (
                <li key={i.id} className="rounded border border-vs-linea bg-white px-2.5 py-1 text-sm">
                  {i.nombre}
                  {i.granFormato && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-vs-naranja-700">
                      gran formato
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs text-vs-tinta-3">
              Los de gran formato no salen de las instalaciones (cláusula 9ª).
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold">Cubículos</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {listaAulas.map((a) => (
                <li key={a.id} className="rounded border border-vs-linea bg-white px-2.5 py-1 text-sm">
                  {a.nombre}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs text-vs-tinta-3">
              Límite de clases presenciales simultáneas. Una clase en línea no ocupa cubículo.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">
            Tu acceso <span className="text-vs-tinta-3">({misPermisos.size} permisos)</span>
          </h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {[...misPermisos].sort().map((p) => (
              <li key={p} className="rounded border border-vs-linea bg-white px-2 py-0.5 font-mono text-[11px]">
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-vs-tinta-3">
            La sesión cierra sola tras 30 minutos sin actividad, y a las 12 horas en cualquier caso.
          </p>
        </section>

        <footer className="mt-12 border-t border-vs-linea pt-6 text-xs text-vs-tinta-3">
          <Link href="/" className="no-underline hover:underline">← Tablero</Link>
          {" · "}{cfg.academia_domicilio} · Tel. {cfg.academia_telefono}
        </footer>
      </main>
    </>
  );
}
