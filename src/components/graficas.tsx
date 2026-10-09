import type { CategoriaGasto } from "@/lib/datos/gastos";
import { ETIQUETA_CATEGORIA } from "@/lib/datos/gastos";
import type { PuntoMes } from "@/lib/datos/metricas";
import { etiquetaDeMes } from "@/lib/dominio/meses";

/**
 * Gráficas de una sola serie, dibujadas en SVG en el servidor.
 *
 * Sin librería de gráficos a propósito: son dos formas y una serie cada una, y una
 * dependencia de ese tamaño pesaría más que el código que sustituye. El SVG se
 * imprime nítido y no necesita JavaScript en el cliente, igual que el QR.
 *
 * Una sola serie no lleva leyenda: el título ya dice qué se está viendo, y una caja
 * con un solo color repetiría el título gastando espacio.
 *
 * El color es #c2600a, el derivado accesible del naranja de marca que ya vive en
 * globals.css. El naranja oficial (#f27405) no alcanza contraste suficiente.
 */

const TINTA = "#4a3b28";
const TINTA_SUAVE = "#6e5c45";
const LINEA = "#e6dcc0";
const SERIE = "#c2600a";
const SERIE2 = "#a16207"; // egresos — ámbar oscuro, complementa el naranja

const ANCHO = 720;
const ALTO = 220;
const M = { arriba: 18, derecha: 14, abajo: 30, izquierda: 60 };

const areaAncho = ANCHO - M.izquierda - M.derecha;
const areaAlto = ALTO - M.arriba - M.abajo;

/** Redondea el techo a una cifra limpia para que las marcas del eje sean legibles. */
function escala(max: number): { techo: number; marcas: number[] } {
  if (max <= 0) return { techo: 1, marcas: [0, 1] };

  const magnitud = 10 ** Math.floor(Math.log10(max));
  const paso = [1, 2, 2.5, 5, 10].map((p) => p * magnitud).find((p) => max <= p * 4) ?? magnitud * 10;
  const techo = Math.ceil(max / paso) * paso;

  const marcas: number[] = [];
  for (let v = 0; v <= techo + 1e-9; v += paso) marcas.push(v);
  return { techo, marcas };
}

function Rejilla({ marcas, techo, formato }: {
  marcas: number[]; techo: number; formato: (n: number) => string;
}) {
  return (
    <g>
      {marcas.map((v) => {
        const y = M.arriba + areaAlto - (v / techo) * areaAlto;
        return (
          <g key={v}>
            {/* Hairline sólida y discreta: la rejilla orienta, no compite. */}
            <line x1={M.izquierda} y1={y} x2={ANCHO - M.derecha} y2={y}
                  stroke={LINEA} strokeWidth="1" />
            <text x={M.izquierda - 8} y={y + 3.5} textAnchor="end"
                  fontSize="10" fill={TINTA_SUAVE}>
              {formato(v)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function EtiquetasDeMes({ datos }: { datos: PuntoMes[] }) {
  const paso = areaAncho / datos.length;
  return (
    <g>
      {datos.map((d, i) => (
        <text key={d.mes} x={M.izquierda + paso * (i + 0.5)} y={ALTO - 10}
              textAnchor="middle" fontSize="10" fill={TINTA_SUAVE}>
          {etiquetaDeMes(d.mes)}
        </text>
      ))}
    </g>
  );
}

/** Columna con remate redondeado arriba y escuadra en la base. */
function columna(x: number, y: number, ancho: number, alto: number): string {
  const r = Math.min(4, ancho / 2, Math.max(alto, 0));
  if (alto <= 0) return "";
  const base = y + alto;
  return `M ${x} ${base} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} ` +
         `L ${x + ancho - r} ${y} Q ${x + ancho} ${y} ${x + ancho} ${y + r} ` +
         `L ${x + ancho} ${base} Z`;
}

export function GraficaColumnas({ datos, formatoValor, formatoEje, titulo }: {
  datos: PuntoMes[];
  formatoValor: (n: number) => string;
  formatoEje: (n: number) => string;
  titulo: string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 0);
  const { techo, marcas } = escala(max);
  const paso = areaAncho / datos.length;
  // Tope de 24px: la columna no llena la banda, el aire sobrante la separa.
  const ancho = Math.min(24, paso - 10);
  const indiceMax = datos.findIndex((d) => d.valor === max && max > 0);

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full" role="img"
         aria-label={titulo}>
      <Rejilla marcas={marcas} techo={techo} formato={formatoEje} />

      {datos.map((d, i) => {
        const alto = (d.valor / techo) * areaAlto;
        const x = M.izquierda + paso * (i + 0.5) - ancho / 2;
        const y = M.arriba + areaAlto - alto;
        return (
          <g key={d.mes}>
            <path d={columna(x, y, ancho, alto)} fill={SERIE} />
            <title>{`${etiquetaDeMes(d.mes)}: ${formatoValor(d.valor)}`}</title>
            {/* Solo el mes más alto lleva número encima: una cifra sobre cada
                columna se vuelve ruido y nadie la lee. */}
            {i === indiceMax && (
              <text x={x + ancho / 2} y={y - 6} textAnchor="middle"
                    fontSize="11" fontWeight="600" fill={TINTA}>
                {formatoValor(d.valor)}
              </text>
            )}
          </g>
        );
      })}

      <EtiquetasDeMes datos={datos} />
    </svg>
  );
}

export function GraficaLinea({ datos, formatoValor, formatoEje, titulo }: {
  datos: PuntoMes[];
  formatoValor: (n: number) => string;
  formatoEje: (n: number) => string;
  titulo: string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 0);
  const { techo, marcas } = escala(max);
  const paso = areaAncho / datos.length;

  const puntos = datos.map((d, i) => ({
    ...d,
    x: M.izquierda + paso * (i + 0.5),
    y: M.arriba + areaAlto - (d.valor / techo) * areaAlto,
  }));

  const trazo = puntos.map((p) => `${p.x} ${p.y}`).join(" L ");
  const base = M.arriba + areaAlto;
  const ultimo = puntos[puntos.length - 1];

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full" role="img"
         aria-label={titulo}>
      <Rejilla marcas={marcas} techo={techo} formato={formatoEje} />

      {/* Relleno al 10%: un lavado que da cuerpo a la línea sin taparla. */}
      <path d={`M ${puntos[0]!.x} ${base} L ${trazo} L ${ultimo!.x} ${base} Z`}
            fill={SERIE} fillOpacity="0.1" />

      <path d={`M ${trazo}`} fill="none" stroke={SERIE} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />

      {puntos.map((p) => (
        <g key={p.mes}>
          {/* Anillo blanco de 2px: el punto se lee aunque cruce la línea. */}
          <circle cx={p.x} cy={p.y} r="4" fill={SERIE} stroke="#ffffff" strokeWidth="2" />
          <title>{`${etiquetaDeMes(p.mes)}: ${formatoValor(p.valor)}`}</title>
        </g>
      ))}

      {/* El valor va al final de la línea, que es donde está la pregunta:
          cuántos alumnos hay hoy. */}
      <text x={ultimo!.x} y={ultimo!.y - 12} textAnchor="end"
            fontSize="12" fontWeight="600" fill={TINTA}>
        {formatoValor(ultimo!.valor)}
      </text>

      <EtiquetasDeMes datos={datos} />
    </svg>
  );
}

/**
 * Gráfica de columnas con dos series: ingresos (naranja) vs egresos (ámbar).
 * Las columnas se muestran lado a lado dentro de cada mes.
 */
export function GraficaDosSeries({
  ingresos,
  egresos,
  formatoValor,
  formatoEje,
  titulo,
}: {
  ingresos: PuntoMes[];
  egresos: PuntoMes[];
  formatoValor: (n: number) => string;
  formatoEje: (n: number) => string;
  titulo: string;
}) {
  const max = Math.max(...ingresos.map((d) => d.valor), ...egresos.map((d) => d.valor), 0);
  const { techo, marcas } = escala(max);
  const paso = areaAncho / ingresos.length;
  const grupoAncho = Math.min(52, paso - 8);
  const barAncho = (grupoAncho - 4) / 2;

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full" role="img" aria-label={titulo}>
      <Rejilla marcas={marcas} techo={techo} formato={formatoEje} />

      {ingresos.map((d, i) => {
        const eg = egresos[i]?.valor ?? 0;
        const cx = M.izquierda + paso * (i + 0.5);
        const xIn = cx - grupoAncho / 2;
        const xEg = xIn + barAncho + 4;

        const altoIn = (d.valor / techo) * areaAlto;
        const altoEg = (eg / techo) * areaAlto;
        const yIn = M.arriba + areaAlto - altoIn;
        const yEg = M.arriba + areaAlto - altoEg;

        return (
          <g key={d.mes}>
            <path d={columna(xIn, yIn, barAncho, altoIn)} fill={SERIE}>
              <title>{`${etiquetaDeMes(d.mes)} ingresos: ${formatoValor(d.valor)}`}</title>
            </path>
            <path d={columna(xEg, yEg, barAncho, altoEg)} fill={SERIE2} fillOpacity="0.75">
              <title>{`${etiquetaDeMes(d.mes)} egresos: ${formatoValor(eg)}`}</title>
            </path>
          </g>
        );
      })}

      <EtiquetasDeMes datos={ingresos} />

      {/* Leyenda compacta arriba a la derecha */}
      <g>
        <rect x={ANCHO - M.derecha - 120} y={M.arriba} width="10" height="10" rx="2" fill={SERIE} />
        <text x={ANCHO - M.derecha - 107} y={M.arriba + 9} fontSize="10" fill={TINTA_SUAVE}>Ingresos</text>
        <rect x={ANCHO - M.derecha - 55} y={M.arriba} width="10" height="10" rx="2" fill={SERIE2} fillOpacity="0.75" />
        <text x={ANCHO - M.derecha - 42} y={M.arriba + 9} fontSize="10" fill={TINTA_SUAVE}>Egresos</text>
      </g>
    </svg>
  );
}

/** Donut de distribución de gastos por categoría. */
export function GraficaDonut({
  datos,
  titulo,
  formatoValor,
}: {
  datos: { categoria: CategoriaGasto; totalCentavos: number }[];
  titulo: string;
  formatoValor: (n: number) => string;
}) {
  const PALETA = ["#c2600a", "#a16207", "#854d0e", "#92400e", "#78350f", "#d97706", "#b45309"];

  const total = datos.reduce((s, d) => s + d.totalCentavos, 0);
  if (total === 0) return null;

  const CX = 100;
  const CY = 100;
  const R = 70;
  const RIN = 42;

  function arco(pct: number, inicio: number, radio: number, rIn: number): string {
    const ang = pct * 2 * Math.PI;
    const x1e = CX + radio * Math.sin(inicio);
    const y1e = CY - radio * Math.cos(inicio);
    const x2e = CX + radio * Math.sin(inicio + ang);
    const y2e = CY - radio * Math.cos(inicio + ang);
    const x1i = CX + rIn * Math.sin(inicio + ang);
    const y1i = CY - rIn * Math.cos(inicio + ang);
    const x2i = CX + rIn * Math.sin(inicio);
    const y2i = CY - rIn * Math.cos(inicio);
    const grande = ang > Math.PI ? 1 : 0;
    return [
      `M ${x1e} ${y1e}`,
      `A ${radio} ${radio} 0 ${grande} 1 ${x2e} ${y2e}`,
      `L ${x1i} ${y1i}`,
      `A ${rIn} ${rIn} 0 ${grande} 0 ${x2i} ${y2i}`,
      "Z",
    ].join(" ");
  }

  let acum = 0;
  const sectores = datos.map((d, i) => {
    const pct = d.totalCentavos / total;
    const path = arco(pct, acum * 2 * Math.PI, R, RIN);
    acum += pct;
    return { ...d, pct, path, color: PALETA[i % PALETA.length]! };
  });

  const ANCHO_D = 380;
  const ALTO_D = 200;

  return (
    <svg viewBox={`0 0 ${ANCHO_D} ${ALTO_D}`} className="h-auto w-full max-w-sm" role="img" aria-label={titulo}>
      {sectores.map((s) => (
        <path key={s.categoria} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5">
          <title>{`${ETIQUETA_CATEGORIA[s.categoria]}: ${formatoValor(s.totalCentavos)} (${(s.pct * 100).toFixed(1)}%)`}</title>
        </path>
      ))}

      {sectores.map((s, i) => (
        <g key={`leg-${s.categoria}`} transform={`translate(210, ${16 + i * 22})`}>
          <rect width="10" height="10" rx="2" fill={s.color} />
          <text x="14" y="9" fontSize="10" fill={TINTA_SUAVE}>
            {ETIQUETA_CATEGORIA[s.categoria]}
          </text>
          <text x="155" y="9" textAnchor="end" fontSize="10" fontWeight="600" fill={TINTA}>
            {(s.pct * 100).toFixed(0)}%
          </text>
        </g>
      ))}
    </svg>
  );
}
