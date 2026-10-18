import type { ReactNode } from "react";

import { Encabezado } from "@/components/encabezado";
import { EstructuraLateral } from "@/components/estructura-lateral";
import { ResumenFinanzas } from "@/components/resumen-finanzas";
import { exigirSesionUsable, permisosDe } from "@/lib/auth/permisos";
import { seccionesDeFinanzas } from "@/lib/navegacion";

/**
 * Finanzas con barra lateral: panorama, ingresos, egresos, análisis y reglas (ver
 * `lib/navegacion.ts` para el criterio). La barra es para dirección; un maestro que solo entra a
 * «Mi nómina» ve la pantalla sin ella. Cada pantalla exige su propio permiso.
 */
export default async function LayoutFinanzas({ children }: { children: ReactNode }) {
  const sesion = await exigirSesionUsable();
  const permisos = permisosDe(sesion.usuarioId);
  const tiene = (p: string) => permisos.has(p);

  if (!tiene("finanzas.leer")) {
    return (
      <>
        <Encabezado sesion={sesion} activo="finanzas" />
        {children}
      </>
    );
  }

  return (
    <>
      <Encabezado sesion={sesion} activo="finanzas" />
      <EstructuraLateral titulo="Finanzas" grupos={seccionesDeFinanzas(tiene)} resumen={<ResumenFinanzas />}>
        {children}
      </EstructuraLateral>
    </>
  );
}
