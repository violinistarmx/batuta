/**
 * Política de retención de respaldos.
 *
 * Guardar todo llena el disco y borrar por edad pierde justo el respaldo viejo que
 * hace falta cuando un error llevaba meses pasando inadvertido. La regla es la
 * clásica de abuelo-padre-hijo: se conservan todos los recientes, uno por semana
 * en el mes pasado y uno por mes más atrás.
 */

export type Respaldo = {
  nombre: string;
  /** Fecha civil YYYY-MM-DD en que se tomó. */
  fecha: string;
  bytes: number;
};

export type Politica = {
  /** Días recientes en que se conservan TODOS los respaldos. */
  diariosDias: number;
  /** Semanas en que se conserva uno por semana. */
  semanales: number;
  /** Meses en que se conserva uno por mes. */
  mensuales: number;
};

export const POLITICA: Politica = { diariosDias: 14, semanales: 8, mensuales: 12 };

function aNumero(fecha: string): number {
  const [y = 0, m = 1, d = 1] = fecha.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

const DIA = 86_400_000;

/** Semana ISO aproximada: el lunes de esa semana, como marca única. */
function semanaDe(fecha: string): string {
  const t = aNumero(fecha);
  const diaSemana = (new Date(t).getUTCDay() + 6) % 7; // 0 = lunes
  return new Date(t - diaSemana * DIA).toISOString().slice(0, 10);
}

function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/**
 * Decide qué se conserva y qué se borra.
 *
 * Devuelve las dos listas en vez de borrar: una función que decide y borra a la vez
 * no se puede probar sin arriesgar archivos reales, y esto es justo lo que no se
 * quiere descubrir roto el día que haga falta restaurar.
 */
export function aplicarRetencion(
  respaldos: Respaldo[],
  hoy: string,
  politica: Politica = POLITICA,
): { conservar: Respaldo[]; borrar: Respaldo[] } {
  const orden = [...respaldos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const hoyN = aNumero(hoy);

  const conservar = new Set<Respaldo>();
  const semanasVistas = new Set<string>();
  const mesesVistos = new Set<string>();

  for (const r of orden) {
    const dias = Math.round((hoyN - aNumero(r.fecha)) / DIA);

    if (dias < politica.diariosDias) {
      conservar.add(r);
      continue;
    }

    const semanas = Math.floor(dias / 7);
    if (semanas <= politica.semanales) {
      const s = semanaDe(r.fecha);
      if (!semanasVistas.has(s)) {
        semanasVistas.add(s);
        conservar.add(r);
      }
      continue;
    }

    const meses = Math.floor(dias / 30);
    if (meses <= politica.mensuales) {
      const m = mesDe(r.fecha);
      if (!mesesVistos.has(m)) {
        mesesVistos.add(m);
        conservar.add(r);
      }
    }
  }

  // El más reciente se conserva siempre, aunque la política dijera otra cosa: nunca
  // se borra el único respaldo que existe.
  const primero = orden[0];
  if (primero) conservar.add(primero);

  return {
    conservar: orden.filter((r) => conservar.has(r)),
    borrar: orden.filter((r) => !conservar.has(r)),
  };
}

/** Tamaño legible, para el resumen que imprime el script. */
export function enMegas(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Si un respaldo es lo bastante reciente para servir de algo.
 *
 * El aviso no es «no hay respaldo» —eso se ve—, sino «el último es de hace
 * demasiado», que es el que nadie nota hasta que lo necesita.
 */
export function respaldoAlDia(ultimaFecha: string | null, hoy: string, maxDias = 2): boolean {
  if (!ultimaFecha) return false;
  return Math.round((aNumero(hoy) - aNumero(ultimaFecha)) / DIA) <= maxDias;
}
