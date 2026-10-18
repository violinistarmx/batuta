import type { ReactNode } from "react";

import { Encabezado } from "@/components/encabezado";
import { EstructuraLateral } from "@/components/estructura-lateral";
import { exigirSesionUsable, permisosDe } from "@/lib/auth/permisos";
import { seccionesDeAjustes } from "@/lib/navegacion";

/**
 * Ajustes: reglas de la academia, cuentas, catálogo y bitácora, con una barra lateral de
 * secciones. Cada pantalla sigue exigiendo su propio permiso; aquí solo se decide qué se muestra.
 * El grupo de ruta `(ajustes)` no cambia las direcciones: /usuarios, /catalogo y /bitacora siguen igual.
 */
export default async function LayoutAjustes({ children }: { children: ReactNode }) {
  const sesion = await exigirSesionUsable();
  const permisos = permisosDe(sesion.usuarioId);
  const grupos = seccionesDeAjustes((p) => permisos.has(p));

  return (
    <>
      <Encabezado sesion={sesion} activo="ajustes" />
      <EstructuraLateral titulo="Ajustes" grupos={grupos}>{children}</EstructuraLateral>
    </>
  );
}
