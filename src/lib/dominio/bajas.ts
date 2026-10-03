/**
 * Baja de inscripción — cláusula 12ª.
 *
 * El contrato pide 72 horas de aviso y dice «sin derecho a devolución». Eso
 * resuelve lo que ya se pagó y no dice nada de lo que se facturó y sigue sin
 * cobrarse, que es el caso incómodo. Dirección lo resolvió así:
 *
 *   · Mensualidad PAGADA — no se devuelve nada. El alumno conserva sus clases y
 *     la baja surte efecto cuando el período termina. Pagó el mes; es suyo.
 *   · Mensualidad SIN PAGAR — no pagó el mes completo, así que no se le cobra
 *     completo: el cargo se ajusta a la proporción de clases que sí tomó, y la
 *     baja surte efecto a las 72 horas del aviso.
 *
 * En los dos casos se cancelan las clases agendadas DESPUÉS de la fecha efectiva.
 * Las de antes no se tocan: son las que el alumno todavía tiene derecho a tomar.
 */

import { sumarDias } from "./ciclos.ts";

export type Mensualidad = {
  cargoId: number;
  montoCentavos: number;
  aplicadoCentavos: number;
};

export type Situacion = {
  /** Día civil en que el tutor avisó, no en que recepción lo capturó. */
  fechaAviso: string;
  horasAviso: number;
  /** El período vigente. Sin ciclo abierto, la baja es inmediata al cumplir el aviso. */
  terminaElPeriodo: string | null;
  mensualidad: Mensualidad | null;
  clasesContratadas: number;
  clasesConsumidas: number;
  estadoInscripcion: string;
  /** Ejemplares de la academia que el alumno todavía tiene. */
  prestamosAbiertos: number;
  /** Hermanos cuya inscripción paga ésta, en un plan familiar. */
  cubiertasActivas: number;
};

export function estaPagada(m: Mensualidad | null): boolean {
  return m !== null && m.aplicadoCentavos >= m.montoCentavos;
}

/**
 * El primer día en que la baja puede surtir efecto por el aviso.
 *
 * 72 horas son tres días. Se cuenta desde el día del aviso porque es lo que el
 * tutor puede demostrar —un mensaje con fecha—, no desde que alguien lo capturó.
 */
export function minimoPorAviso(fechaAviso: string, horasAviso: number): string {
  return sumarDias(fechaAviso, Math.ceil(horasAviso / 24));
}

/**
 * Cuándo deja de estar inscrito.
 *
 * Si pagó el período, al cierre del período —pero nunca antes de cumplirse el
 * aviso, porque el contrato pide las dos cosas, no la que salga primero.
 */
export function fechaEfectiva(s: Situacion): string {
  const minimo = minimoPorAviso(s.fechaAviso, s.horasAviso);
  if (estaPagada(s.mensualidad) && s.terminaElPeriodo) {
    return s.terminaElPeriodo > minimo ? s.terminaElPeriodo : minimo;
  }
  return minimo;
}

export type Ajuste = {
  cargoId: number;
  antesCentavos: number;
  despuesCentavos: number;
  condonadoCentavos: number;
  explicacion: string;
};

/**
 * El ajuste proporcional del cargo que no se alcanzó a cobrar.
 *
 * Nunca baja de lo ya aplicado: reducir el cargo por debajo de lo que el tutor
 * ya entregó sería una devolución con otro nombre, y la cláusula 12ª no la
 * concede. Devuelve null cuando no hay nada que ajustar.
 */
export function ajusteProporcional(s: Situacion): Ajuste | null {
  const m = s.mensualidad;
  if (!m) return null;
  if (estaPagada(m)) return null;
  if (s.clasesContratadas <= 0) return null;

  const tomadas = Math.min(Math.max(s.clasesConsumidas, 0), s.clasesContratadas);
  const prorrata = Math.round((m.montoCentavos * tomadas) / s.clasesContratadas);
  const despues = Math.max(prorrata, m.aplicadoCentavos);

  if (despues >= m.montoCentavos) return null;

  return {
    cargoId: m.cargoId,
    antesCentavos: m.montoCentavos,
    despuesCentavos: despues,
    condonadoCentavos: m.montoCentavos - despues,
    explicacion:
      `Tomó ${tomadas} de ${s.clasesContratadas} clases del período. ` +
      (despues === m.aplicadoCentavos && prorrata < m.aplicadoCentavos
        ? "El cargo se deja en lo que ya pagó: la cláusula 12ª no devuelve."
        : "El cargo se ajusta a esa proporción."),
  };
}

/**
 * Por qué NO se puede dar de baja, o null si sí.
 *
 * Las dos negativas protegen de cosas que después nadie arregla mirando la
 * pantalla: un instrumento de la academia que se va con el alumno, y un plan
 * familiar en el que el hermano que paga se retira y los demás siguen tomando
 * clase sin que se le cobre a nadie.
 */
export function motivoParaNoDarDeBaja(s: Situacion): string | null {
  if (s.estadoInscripcion !== "activa") {
    return "Esa inscripción ya no está activa.";
  }
  if (s.prestamosAbiertos > 0) {
    return s.prestamosAbiertos === 1
      ? "Tiene un instrumento de la academia sin devolver. Recíbelo primero: después de la baja nadie vuelve a esta pantalla a buscarlo."
      : `Tiene ${s.prestamosAbiertos} instrumentos de la academia sin devolver. Recíbelos primero.`;
  }
  if (s.cubiertasActivas > 0) {
    return s.cubiertasActivas === 1
      ? "Es la inscripción que paga por un hermano en el plan familiar. Si se va, el hermano seguiría tomando clase sin que se le cobre a nadie: primero hay que pasarle el cobro o darlo de baja también."
      : `Es la inscripción que paga por ${s.cubiertasActivas} hermanos en el plan familiar. Primero hay que pasarles el cobro o darlos de baja también.`;
  }
  return null;
}

export type Plan = {
  fechaEfectiva: string;
  minimoPorAviso: string;
  /** Si la fecha efectiva la manda el período pagado y no el aviso. */
  esperaAlPeriodo: boolean;
  ajuste: Ajuste | null;
  /** Lo que el alumno todavía puede tomar: clases agendadas hasta la fecha efectiva. */
  conservaClases: boolean;
  resumen: string[];
};

/** Todo lo que va a pasar, en palabras, ANTES de que alguien apriete el botón. */
export function planDeBaja(s: Situacion): Plan {
  const minimo = minimoPorAviso(s.fechaAviso, s.horasAviso);
  const efectiva = fechaEfectiva(s);
  const espera = efectiva !== minimo;
  const ajuste = ajusteProporcional(s);
  const pagada = estaPagada(s.mensualidad);

  const resumen: string[] = [];

  resumen.push(
    espera
      ? `Deja de estar inscrito el ${efectiva}, cuando termina el período que ya pagó.`
      : `Deja de estar inscrito el ${efectiva}, a las ${s.horasAviso} horas del aviso (cláusula 12ª).`,
  );

  if (pagada) {
    resumen.push(
      "El período está pagado y no se devuelve (cláusula 12ª). Conserva sus clases hasta esa fecha.",
    );
  } else if (ajuste) {
    resumen.push(`${ajuste.explicacion} Se le deja de cobrar la diferencia.`);
  } else if (s.mensualidad) {
    resumen.push("El cargo del período se queda como está: ya tomó todas las clases que amparaba.");
  } else {
    resumen.push("No hay mensualidad pendiente de este período.");
  }

  resumen.push(
    `Las clases agendadas después del ${efectiva} se cancelan y su cubículo queda libre.`,
  );

  return {
    fechaEfectiva: efectiva,
    minimoPorAviso: minimo,
    esperaAlPeriodo: espera,
    ajuste,
    conservaClases: pagada,
    resumen,
  };
}
