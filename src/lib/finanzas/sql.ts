/**
 * Consultas de los "hechos" del dashboard de finanzas.
 *
 * Cada consulta devuelve filas finas con sus dimensiones (mes, programa,
 * instrumento, maestro, sede); el filtrado y los indicadores se hacen después en
 * funciones puras (lib/finanzas/dashboard.ts). Así el mismo cálculo sirve para el
 * dashboard y el PDF, y la lógica se prueba sin base de datos.
 *
 * Este módulo no importa nada a propósito: las cadenas se ejecutan igual con
 * better-sqlite3 en la app y con el SQLite de las pruebas. Parámetros con nombre:
 * :desde y :hasta (fechas civiles YYYY-MM-DD, inclusive).
 *
 * El día civil de una clase usa `localtime`: el contenedor fija
 * TZ=America/Mexico_City en el Dockerfile.
 */

/** Sede de una inscripción: la del aula de su clase más reciente. En línea = NULL. */
const sedeDeInscripcion = (alias: string) => `(
  SELECT a2.sede_id FROM clases c2 JOIN aulas a2 ON a2.id = c2.aula_id
  WHERE c2.inscripcion_id = ${alias}.id
  ORDER BY c2.inicia_en DESC LIMIT 1
)`;

const DIA = (alias: string) => `date(${alias}.inicia_en, 'unixepoch', 'localtime')`;

/** Tarifa del maestro vigente el día de la clase (tarifas_docente). */
const tarifaVigente = (alias: string) => `(
  SELECT td.tarifa_hora_centavos FROM tarifas_docente td
  WHERE td.docente_id = ${alias}.docente_id
    AND td.vigente_desde <= ${DIA(alias)}
    AND (td.vigente_hasta IS NULL OR td.vigente_hasta >= ${DIA(alias)})
  ORDER BY td.vigente_desde DESC LIMIT 1
)`;

/**
 * Dinero recibido. Pagos reales, por fecha de pago.
 *
 * `pagos.monto_centavos` es lo que entró; el descuento es una condonación que se
 * aplica a los cargos sin que entre dinero. Por eso cada aplicación se escala por
 * monto / (monto + descuento): así se atribuye al programa solo dinero real.
 * La parte de un pago que no se aplicó a ningún cargo (saldo a favor) entra sin
 * dimensiones: cuenta en el total, pero no se puede atribuir a un programa.
 */
export const SQL_INGRESOS = `
SELECT substr(p.recibido_el, 1, 7) AS mes,
  i.programa_id AS programaId, i.instrumento_id AS instrumentoId,
  i.docente_id AS docenteId, ${sedeDeInscripcion("i")} AS sedeId,
  sum(ap.monto_centavos * 1.0 * p.monto_centavos / (p.monto_centavos + p.descuento_centavos)) AS centavos
FROM aplicaciones ap
JOIN pagos p ON p.id = ap.pago_id
JOIN cargos ca ON ca.id = ap.cargo_id
LEFT JOIN inscripciones i ON i.id = ca.inscripcion_id
WHERE p.recibido_el BETWEEN :desde AND :hasta
  AND (p.monto_centavos + p.descuento_centavos) > 0
GROUP BY mes, programaId, instrumentoId, docenteId, sedeId
UNION ALL
SELECT substr(p.recibido_el, 1, 7) AS mes, NULL, NULL, NULL, NULL,
  sum(p.monto_centavos - coalesce((
    SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.pago_id = p.id
  ), 0) * 1.0 * p.monto_centavos / (p.monto_centavos + p.descuento_centavos)) AS centavos
FROM pagos p
WHERE p.recibido_el BETWEEN :desde AND :hasta
  AND (p.monto_centavos + p.descuento_centavos) > 0
GROUP BY mes
`;

/**
 * Clases impartidas, una fila por clase, con lo necesario para su costo docente.
 * Solo los estados que generan pago: asistió, falta sin aviso y falta justificada.
 */
export const SQL_CLASES = `
SELECT strftime('%Y-%m', c.inicia_en, 'unixepoch', 'localtime') AS mes,
  i.programa_id AS programaId, i.instrumento_id AS instrumentoId,
  c.docente_id AS docenteId, a.sede_id AS sedeId,
  c.estado AS estado, c.minutos AS minutos,
  ${tarifaVigente("c")} AS tarifaDocente,
  pr.tarifa_docente_hora_centavos AS tarifaPrograma,
  np.importe_centavos AS importePartida
FROM clases c
JOIN inscripciones i ON i.id = c.inscripcion_id
JOIN programas pr ON pr.id = i.programa_id
LEFT JOIN aulas a ON a.id = c.aula_id
LEFT JOIN nomina_partidas np ON np.clase_id = c.id
WHERE ${DIA("c")} BETWEEN :desde AND :hasta
  AND c.estado IN ('asistio', 'falta', 'falta_justificada')
`;

/** Nómina efectivamente pagada, por fecha de pago del corte. Para el flujo de caja. */
export const SQL_NOMINA_PAGADA = `
SELECT substr(n.pagado_el, 1, 7) AS mes,
  i.programa_id AS programaId, i.instrumento_id AS instrumentoId,
  c.docente_id AS docenteId, a.sede_id AS sedeId,
  sum(np.importe_centavos) AS centavos
FROM nomina_partidas np
JOIN nomina_pagos n ON n.id = np.nomina_id
JOIN clases c ON c.id = np.clase_id
JOIN inscripciones i ON i.id = c.inscripcion_id
LEFT JOIN aulas a ON a.id = c.aula_id
WHERE n.pagado_el BETWEEN :desde AND :hasta
GROUP BY mes, programaId, instrumentoId, docenteId, sedeId
`;

/** Gastos registrados, por fecha del gasto. */
export const SQL_GASTOS = `
SELECT substr(g.fecha, 1, 7) AS mes,
  g.categoria_id AS categoriaId, g.subcategoria AS subcategoria, g.tipo AS tipo,
  g.sede_id AS sedeId, g.programa_id AS programaId,
  sum(g.monto_centavos) AS centavos
FROM gastos g
WHERE g.fecha BETWEEN :desde AND :hasta
GROUP BY mes, categoriaId, subcategoria, tipo, sedeId, programaId
`;

/**
 * Lo facturado (cargos no cancelados, por fecha de vencimiento) y cuánto de eso ya
 * está saldado. Lo no saldado es "por cobrar".
 */
export const SQL_CARGOS = `
SELECT substr(ca.vence_el, 1, 7) AS mes,
  i.programa_id AS programaId, i.instrumento_id AS instrumentoId,
  i.docente_id AS docenteId, ${sedeDeInscripcion("i")} AS sedeId,
  sum(ca.monto_centavos) AS facturado,
  sum(min(ca.monto_centavos, coalesce((
    SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = ca.id
  ), 0))) AS saldado
FROM cargos ca
LEFT JOIN inscripciones i ON i.id = ca.inscripcion_id
WHERE ca.cancelado = 0 AND ca.vence_el BETWEEN :desde AND :hasta
GROUP BY mes, programaId, instrumentoId, docenteId, sedeId
`;

/**
 * Inscripciones (no canceladas) con su alumno y el origen del alumno. Sin filtro
 * de fecha: activos, altas, bajas y retención se calculan sobre todas.
 */
export const SQL_INSCRIPCIONES = `
SELECT i.id AS id, i.alumno_id AS alumnoId,
  i.programa_id AS programaId, i.instrumento_id AS instrumentoId,
  i.docente_id AS docenteId, ${sedeDeInscripcion("i")} AS sedeId,
  i.fecha_inicio AS fechaInicio, i.fecha_fin AS fechaFin,
  al.origen AS origen
FROM inscripciones i
JOIN alumnos al ON al.id = i.alumno_id
WHERE i.estado <> 'cancelada'
`;

/** Catálogos para nombrar dimensiones. Sin teléfonos ni datos de contacto. */
export const SQL_CATALOGOS = {
  programas: `SELECT id, nombre FROM programas ORDER BY orden, nombre`,
  instrumentos: `SELECT id, nombre FROM instrumentos ORDER BY orden, nombre`,
  sedes: `SELECT id, nombre FROM sedes WHERE activo = 1 ORDER BY orden, nombre`,
  docentes: `SELECT id, nombre FROM docentes ORDER BY nombre`,
  categorias: `SELECT id, nombre, color, clave FROM categorias_gasto ORDER BY orden, nombre`,
} as const;
