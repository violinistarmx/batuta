/**
 * Detección de choques de horario. Funciones puras sobre intervalos.
 *
 * La academia tiene dos cubículos (cláusula 5ª), así que el aula es un recurso
 * escaso de verdad: sin esta comprobación, dos alumnos terminan en el mismo
 * espacio a la misma hora y alguien se va a su casa.
 */

export type Intervalo = { iniciaEn: Date; terminaEn: Date };

export type ClaseAgendada = Intervalo & {
  id: number;
  alumnoId: number;
  docenteId: number;
  aulaId: number | null;
  estado: string;
};

export type TipoConflicto = "alumno" | "docente" | "aula";

export type Conflicto = {
  tipo: TipoConflicto;
  claseId: number;
  iniciaEn: Date;
  terminaEn: Date;
};

/**
 * Dos intervalos se traslapan si cada uno empieza antes de que el otro termine.
 *
 * Los extremos NO cuentan: una clase de 16:00 a 17:00 y otra de 17:00 a 18:00 son
 * consecutivas, no simultáneas. Usar `<=` aquí haría imposible agendar dos clases
 * seguidas, que es exactamente como trabaja la academia.
 */
export function seTraslapan(a: Intervalo, b: Intervalo): boolean {
  return a.iniciaEn < b.terminaEn && b.iniciaEn < a.terminaEn;
}

/** Una clase cancelada o reprogramada libera su horario: ya no ocupa nada. */
export function ocupaHorario(estado: string): boolean {
  return estado !== "cancelada" && estado !== "reprogramada";
}

export type Candidata = Intervalo & {
  alumnoId: number;
  docenteId: number;
  aulaId: number | null;
  /** Al mover una clase existente, se excluye a sí misma de la comparación. */
  excluirClaseId?: number;
};

export function buscarConflictos(
  candidata: Candidata,
  agendadas: readonly ClaseAgendada[],
): Conflicto[] {
  const conflictos: Conflicto[] = [];

  for (const c of agendadas) {
    if (c.id === candidata.excluirClaseId) continue;
    if (!ocupaHorario(c.estado)) continue;
    if (!seTraslapan(candidata, c)) continue;

    const base = { claseId: c.id, iniciaEn: c.iniciaEn, terminaEn: c.terminaEn };

    if (c.alumnoId === candidata.alumnoId) conflictos.push({ tipo: "alumno", ...base });
    if (c.docenteId === candidata.docenteId) conflictos.push({ tipo: "docente", ...base });
    // Una clase en línea no ocupa cubículo, así que no choca por aula con nadie.
    if (candidata.aulaId !== null && c.aulaId === candidata.aulaId) {
      conflictos.push({ tipo: "aula", ...base });
    }
  }

  return conflictos;
}

export function describirConflicto(c: Conflicto, hora: (d: Date) => string): string {
  const cuando = `${hora(c.iniciaEn)} a ${hora(c.terminaEn)}`;
  switch (c.tipo) {
    case "alumno": return `El alumno ya tiene clase de ${cuando}.`;
    case "docente": return `El maestro ya tiene clase de ${cuando}.`;
    case "aula": return `El cubículo está ocupado de ${cuando}.`;
  }
}
