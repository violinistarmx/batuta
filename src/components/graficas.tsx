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
