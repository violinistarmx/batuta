/**
 * Estructura de las dos barras laterales: Ajustes y Finanzas.
 *
 * Todo vive en este archivo a propósito: reordenar, renombrar o mover una sección es editar
 * una lista, no tocar pantallas. Es puro (recibe «¿tiene este permiso?») y se prueba solo.
 *
 * Criterio de la segmentación de Finanzas: las secciones siguen las preguntas en el orden en
 * que se hacen al estudiar el dinero de la academia —cómo voy, qué entra, qué sale, por qué,
 * con qué reglas—, y lo que se consulta junto vive en el mismo grupo.
 */

export type Tiene = (permiso: string) => boolean;

export type Seccion = {
  href: string;
  texto: string;
  /** Una línea que dice para qué sirve; sale como ayuda bajo el título. */
  detalle?: string;
  /** Permiso necesario; sin él la sección ni se muestra. `null` = cualquiera con sesión. */
  permiso: string | null;
  /** Rutas (prefijo) que también cuentan como estar en esta sección, p. ej. sus subpantallas. */
  tambien?: string[];
};

export type GrupoDeSecciones = { titulo: string; secciones: Seccion[] };

const GRUPOS_AJUSTES: GrupoDeSecciones[] = [
  {
    titulo: "Reglas de la academia",
    secciones: [
      { href: "/ajustes/contrato", texto: "Reglas del contrato", detalle: "Cláusulas que el sistema aplica", permiso: "configuracion.gestionar" },
      { href: "/ajustes/direccion", texto: "Decisiones de dirección", detalle: "Ajustes internos de operación", permiso: "configuracion.gestionar" },
      { href: "/ajustes/finanzas", texto: "Metas de finanzas", detalle: "Metas, nómina y Profit First", permiso: "configuracion.gestionar" },
      { href: "/ajustes/institucional", texto: "Datos de la academia", detalle: "Nombre, teléfono, domicilio", permiso: "configuracion.gestionar" },
    ],
  },
  {
    titulo: "Equipo",
    secciones: [
      { href: "/usuarios", texto: "Cuentas", detalle: "Altas, roles y contraseñas", permiso: "usuarios.gestionar" },
    ],
  },
  {
    titulo: "Academia",
    secciones: [
      { href: "/catalogo", texto: "Catálogo", detalle: "Programas, instrumentos y aulas", permiso: null },
    ],
  },
  {
    titulo: "Seguridad",
    secciones: [
      { href: "/bitacora", texto: "Bitácora", detalle: "Quién hizo qué y cuándo", permiso: "bitacora.leer" },
    ],
  },
];

const GRUPOS_FINANZAS: GrupoDeSecciones[] = [
  {
    titulo: "Panorama",
    secciones: [
      { href: "/finanzas", texto: "Resumen", detalle: "Indicadores, gráficas y filtros", permiso: "finanzas.leer" },
    ],
  },
  {
    titulo: "Ingresos · lo que entra",
    secciones: [
      { href: "/finanzas/cobranza", texto: "Cobranza", detalle: "Adeudos y por cobrar", permiso: "finanzas.leer" },
      { href: "/finanzas/productos", texto: "Productos", detalle: "Catálogo, costos y margen", permiso: "productos.gestionar" },
    ],
  },
  {
    titulo: "Egresos · lo que sale",
    secciones: [
      { href: "/finanzas/gastos", texto: "Gastos", detalle: "Renta, servicios, publicidad…", permiso: "gastos.gestionar", tambien: ["/finanzas/gastos/"] },
      { href: "/finanzas/nomina", texto: "Nómina docente", detalle: "Pendientes y pagos a maestros", permiso: "nomina.leer" },
      { href: "/finanzas/tarifas", texto: "Tarifas de maestros", detalle: "Lo que gana cada maestro por hora", permiso: "nomina.leer" },
    ],
  },
  {
    titulo: "Análisis",
    secciones: [
      { href: "/finanzas/reportes", texto: "Reportes", detalle: "Dinero por programa, asistencia, prospectos", permiso: "reportes.leer" },
    ],
  },
  {
    titulo: "Reglas",
    secciones: [
      { href: "/ajustes/finanzas", texto: "Metas y reglas", detalle: "Se editan en Ajustes", permiso: "configuracion.gestionar" },
      { href: "/finanzas/gastos/categorias", texto: "Categorías de gasto", detalle: "Cómo se agrupan los gastos", permiso: "gastos.gestionar" },
    ],
  },
];

function visibles(grupos: GrupoDeSecciones[], tiene: Tiene): GrupoDeSecciones[] {
  return grupos
    .map((g) => ({ ...g, secciones: g.secciones.filter((s) => s.permiso === null || tiene(s.permiso)) }))
    .filter((g) => g.secciones.length > 0);
}

export const seccionesDeAjustes = (tiene: Tiene) => visibles(GRUPOS_AJUSTES, tiene);
export const seccionesDeFinanzas = (tiene: Tiene) => visibles(GRUPOS_FINANZAS, tiene);

const primera = (grupos: GrupoDeSecciones[]) => grupos[0]?.secciones[0]?.href ?? null;

/** A dónde lleva «Ajustes» en el menú: a la primera sección que la cuenta puede abrir. */
export function rutaInicialDeAjustes(tiene: Tiene): string | null {
  // Catálogo está abierto a todas las cuentas; no cuenta como «tener Ajustes».
  const propias = visibles(GRUPOS_AJUSTES, tiene)
    .map((g) => ({ ...g, secciones: g.secciones.filter((s) => s.permiso !== null) }))
    .filter((g) => g.secciones.length > 0);
  return primera(propias);
}

/** A dónde lleva «Finanzas» en el menú. */
export function rutaInicialDeFinanzas(tiene: Tiene): string | null {
  const g = visibles(GRUPOS_FINANZAS, tiene)
    .map((x) => ({ ...x, secciones: x.secciones.filter((s) => s.href.startsWith("/finanzas")) }))
    .filter((x) => x.secciones.length > 0);
  return primera(g);
}

/**
 * ¿Está esta ruta dentro de la sección? Gana la coincidencia más específica: estando en
 * /finanzas/gastos/categorias se marca «Categorías», no «Gastos».
 */
export function seccionActiva(grupos: GrupoDeSecciones[], ruta: string): string | null {
  const limpia = ruta.split("?")[0]!.replace(/\/$/, "") || "/";
  let mejor: { href: string; largo: number } | null = null;
  for (const g of grupos) {
    for (const s of g.secciones) {
      for (const base of [s.href, ...(s.tambien ?? [])]) {
        const coincide = base.endsWith("/")
          ? limpia.startsWith(base)
          : limpia === base || limpia.startsWith(`${base}/`);
        if (coincide && (!mejor || base.length > mejor.largo)) mejor = { href: s.href, largo: base.length };
      }
    }
  }
  return mejor?.href ?? null;
}
