import Link from "next/link";
import { notFound } from "next/navigation";

import { Encabezado } from "@/components/encabezado";
import { exigirPermiso } from "@/lib/auth/permisos";
import { programaPorId } from "@/lib/datos/catalogo";
import { parametrosNomina } from "@/lib/datos/costo-docente";
import { pesos } from "@/lib/formato";
import { guardarEstructuraPrograma, guardarNombrePrograma, guardarPrecioPrograma, guardarTarifaDocentePrograma } from "./acciones";
import { FormularioEstructura, FormularioNombre, FormularioPrecio, FormularioTarifaDocente } from "./cliente";

export const dynamic = "force-dynamic";

export default async function EditarPrograma({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await exigirPermiso("configuracion.gestionar");
  const { id } = await params;

  const programaId = Number(id);
  if (!Number.isInteger(programaId)) notFound();

  const programa = programaPorId(programaId);
  if (!programa) notFound();

  const hoy = new Date().toISOString().slice(0, 10);
  const precioActualPesos = (programa.precioCentavos / 100).toFixed(2);
  // Programas no renovables (ej: clase única) se cobran por clase, no por mes.
  const etiquetaPrecio = programa.renovable ? "Precio mensual" : "Precio por clase";
  const { tarifaHoraCentavos: tarifaGlobal } = parametrosNomina();

  return (
    <>
      <Encabezado sesion={sesion} activo="catalogo" />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link
          href="/catalogo"
          className="text-xs text-vs-tinta-3 no-underline hover:underline"
        >
          ← Catálogo y reglas
        </Link>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Editar programa
        </h1>
        <p className="mt-1 text-sm text-vs-tinta-2">
          Cambios de nombre aplican de inmediato. Los cambios de precio se registran
          con fecha de vigencia y no afectan contratos activos.
        </p>

        {/* Ficha de referencia rápida */}
        <div className="mt-6 rounded-xl border border-vs-linea bg-vs-crema px-5 py-4 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Clave</dt>
              <dd className="mt-0.5 font-mono font-medium">{programa.clave}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Clases/ciclo</dt>
              <dd className="mt-0.5 font-medium">{programa.clasesPorCiclo}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Min/clase</dt>
              <dd className="mt-0.5 font-medium">{programa.minutosPorClase}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-vs-tinta-3">Precio vigente</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{pesos(programa.precioCentavos)}</dd>
            </div>
          </div>
          <p className="mt-2 text-xs text-vs-tinta-3">
            Precio vigente desde {programa.vigenteDesde}.
            {" "}{programa.renovable ? "Programa renovable mensualmente." : "Programa de clase única — precio por clase."}
          </p>
        </div>

        {/* Formulario: estructura (clave, clases, minutos) */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Estructura del programa</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Clave interna y configuración del ciclo. Aplican de inmediato a los cálculos
            del catálogo; los contratos ya emitidos no se ven afectados.
          </p>
          <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
            <FormularioEstructura
              programaId={programaId}
              claveActual={programa.clave}
              clasesPorCicloActual={programa.clasesPorCiclo}
              minutosPorClaseActual={programa.minutosPorClase}
              accion={guardarEstructuraPrograma}
            />
          </div>
        </section>

        {/* Formulario: nombre y descripción */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Nombre y descripción</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            El nombre aparece en expedientes, recibos e inscripciones.
          </p>
          <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
            <FormularioNombre
              programaId={programaId}
              nombreActual={programa.nombre}
              descripcionActual={programa.descripcion}
              accion={guardarNombrePrograma}
            />
          </div>
        </section>

        {/* Formulario: tarifa de docente */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Tarifa de docente</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            Cuánto se le paga al maestro por hora en este programa. Si no se define,
            se usa la tarifa global del sistema.
          </p>
          <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
            <FormularioTarifaDocente
              programaId={programaId}
              tarifaPropiaCentavos={programa.tarifaDocenteHoraCentavos}
              tarifaGlobalCentavos={tarifaGlobal}
              accion={guardarTarifaDocentePrograma}
            />
          </div>
        </section>

        {/* Formulario: precio */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">{etiquetaPrecio}</h2>
          <p className="mt-1 text-sm text-vs-tinta-2">
            El precio nuevo entra en vigor en la fecha elegida. El historial queda
            intacto: cualquier contrato firmado antes conserva el precio de entonces.
          </p>
          <div className="mt-4 rounded-xl border border-vs-linea bg-white p-5">
            <FormularioPrecio
              programaId={programaId}
              precioActualPesos={precioActualPesos}
              hoy={hoy}
              etiqueta={etiquetaPrecio}
              accion={guardarPrecioPrograma}
            />
          </div>
        </section>
      </main>
    </>
  );
}
