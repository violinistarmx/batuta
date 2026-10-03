import "server-only";

import { readdirSync } from "node:fs";

import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, cargos, ciclos, clases, credenciales, docentes, inscripciones,
  nominaPartidas, planeaciones, programas,
} from "@/db/schema/index";
import { cuentaPorEstado } from "@/lib/datos/comunicacion";
import { prestamosVigentes } from "@/lib/datos/inventario";
import { seguimientosPendientes } from "@/lib/datos/prospectos";
import { proximosRecitales } from "@/lib/datos/recitales";
import {
  estadoDeSeguimiento, siguienteAccion, type Etapa,
} from "@/lib/dominio/prospectos";
import { estadoDeDevolucion } from "@/lib/dominio/inventario";
import { respaldoAlDia } from "@/lib/dominio/respaldos";
import {
  ordenarAlertas, severidadDeAdeudo, severidadDeAsistencia, severidadDeCredencial,
  severidadDePeriodo, type Alerta,
} from "@/lib/dominio/alertas";
import { pesos } from "@/lib/formato";
import { fechaCivil, instanteEnMexico } from "@/lib/zona";
import type { Alcance } from "@/lib/auth/permisos";

/** Lo aplicado a un cargo, calculado. Nunca un campo guardado. */
const APLICADO = sql<number>`coalesce((
  SELECT sum(ap.monto_centavos) FROM aplicaciones ap WHERE ap.cargo_id = cargos.id
), 0)`;

const diasEntreCivil = (desde: string, hasta: string) => {
  const c = (f: string) => {
    const [y = 0, m = 1, d = 1] = f.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((c(hasta) - c(desde)) / 86_400_000);
};

function filtroDocente(alcance: Alcance) {
  if (alcance.tipo === "todo") return undefined;
  if (alcance.docenteId === null) return sql`0 = 1`;
  return eq(clases.docenteId, alcance.docenteId);
}

/**
 * La bandeja de pendientes del día.
 *
 * Cada alerta se construye de una consulta distinta a propósito: una sola consulta
 * gigante con uniones a todo sería más difícil de leer que las siete juntas, y con
 * veinte alumnos el costo es irrelevante. Lo que sí importa es el ALCANCE: un
 * maestro recibe solo lo suyo y nunca ve dinero de la academia.
 */
export function alertasDe(
  alcance: Alcance,
  puedeVerFinanzas: boolean,
  hoy: string,
  verProspectos = false,
  puedeAprobarMensajes = false,
  ultimoRespaldo: string | null = null,
  verInventario = false,
  verRecitales = false,
): Alerta[] {
  const alertas: Alerta[] = [];
  const delDocente = filtroDocente(alcance);

  // --- clases que ya pasaron y siguen sin registrar -------------------------
  // La más valiosa: sin registro el saldo del alumno miente y la nómina falta.
  const ahora = instanteEnMexico(hoy, "23:59");
  const sinRegistrar = db
    .select({
      claseId: clases.id,
      iniciaEn: clases.iniciaEn,
      alumno: alumnos.nombre,
      docente: docentes.nombre,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(and(eq(clases.estado, "programada"), lt(clases.iniciaEn, ahora),
      ...(delDocente ? [delDocente] : [])))
    .orderBy(asc(clases.iniciaEn))
    .all();

  for (const c of sinRegistrar) {
    const dias = diasEntreCivil(fechaCivil(c.iniciaEn), hoy);
    const sev = severidadDeAsistencia(dias);
    if (!sev) continue;
    alertas.push({
      clase: "asistencia",
      severidad: sev,
      titulo: `Falta registrar la clase de ${c.alumno}`,
      detalle: `${fechaCivil(c.iniciaEn)} con ${c.docente} · ${dias} día${dias === 1 ? "" : "s"} sin registrar`,
      href: `/clases/${c.claseId}`,
      peso: dias,
    });
  }

  // --- planeación pendiente -------------------------------------------------
  const sinPlaneacion = db
    .select({ claseId: clases.id, iniciaEn: clases.iniciaEn, alumno: alumnos.nombre })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .leftJoin(planeaciones, eq(planeaciones.claseId, clases.id))
    .where(and(eq(clases.estado, "asistio"), isNull(planeaciones.id),
      ...(delDocente ? [delDocente] : [])))
    .orderBy(asc(clases.iniciaEn))
    .all();

  for (const c of sinPlaneacion) {
    alertas.push({
      clase: "planeacion",
      severidad: "informativa",
      titulo: `Sin planeación: ${c.alumno}`,
      detalle: `Clase del ${fechaCivil(c.iniciaEn)}`,
      href: `/clases/${c.claseId}`,
      peso: diasEntreCivil(fechaCivil(c.iniciaEn), hoy),
    });
  }

  // --- período por vencer o vencido ----------------------------------------
  const periodos = db
    .select({
      inscripcionId: inscripciones.id,
      alumno: alumnos.nombre,
      programa: programas.nombre,
      terminaEl: ciclos.terminaEl,
      saldo: sql<number>`coalesce((
        SELECT sum(cc.delta) FROM creditos_clase cc WHERE cc.ciclo_id = ciclos.id
      ), 0)`,
    })
    .from(ciclos)
    .innerJoin(inscripciones, eq(inscripciones.id, ciclos.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .where(and(eq(ciclos.estado, "abierto"), eq(inscripciones.estado, "activa"),
      ...(alcance.tipo === "propio"
        ? [alcance.docenteId === null ? sql`0 = 1` : eq(inscripciones.docenteId, alcance.docenteId)]
        : [])))
    .all();

  for (const p of periodos) {
    const restan = diasEntreCivil(hoy, p.terminaEl);
    const sev = severidadDePeriodo(p.terminaEl, hoy);
    if (sev === "informativa" && p.saldo > 0) continue;

    // Saldo agotado con período vivo: hay que renovar aunque falten días.
    const agotado = p.saldo <= 0;
    alertas.push({
      clase: agotado ? "saldo" : "periodo",
      severidad: agotado && sev === "informativa" ? "pronto" : sev,
      titulo: agotado
        ? `${p.alumno} agotó sus clases`
        : restan < 0
          ? `Período vencido: ${p.alumno}`
          : `Período por vencer: ${p.alumno}`,
      detalle: agotado
        ? `${p.programa} · termina el ${p.terminaEl}`
        : restan < 0
          ? `${p.programa} · venció hace ${-restan} día${-restan === 1 ? "" : "s"}`
          : `${p.programa} · ${restan === 0 ? "termina hoy" : `quedan ${restan} días`}`,
      href: `/inscripciones/${p.inscripcionId}`,
      peso: agotado ? 100 - restan : -restan,
    });
  }

  // --- credencial por entregar (cláusula 10ª) -------------------------------
  if (alcance.tipo === "todo") {
    const pendientesCred = db
      .select({ alumnoId: alumnos.id, alumno: alumnos.nombre, emitirDesde: credenciales.emitirDesde })
      .from(credenciales)
      .innerJoin(alumnos, eq(alumnos.id, credenciales.alumnoId))
      .where(and(isNull(credenciales.entregadaEn), lte(credenciales.emitirDesde, hoy)))
      .all();

    for (const c of pendientesCred) {
      const sev = severidadDeCredencial(c.emitirDesde, hoy);
      if (!sev) continue;
      const dias = diasEntreCivil(c.emitirDesde, hoy);
      alertas.push({
        clase: "credencial",
        severidad: sev,
        titulo: `Credencial pendiente: ${c.alumno}`,
        detalle: `Debió entregarse desde el ${c.emitirDesde}`,
        href: `/alumnos/${c.alumnoId}`,
        peso: dias,
      });
    }
  }

  // --- dinero: solo para quien puede ver finanzas ---------------------------
  if (puedeVerFinanzas) {
    const adeudos = db
      .select({
        alumnoId: alumnos.id,
        alumno: alumnos.nombre,
        descripcion: cargos.descripcion,
        venceEl: cargos.venceEl,
        montoCentavos: cargos.montoCentavos,
        aplicadoCentavos: APLICADO,
      })
      .from(cargos)
      .innerJoin(alumnos, eq(alumnos.id, cargos.alumnoId))
      .where(eq(cargos.cancelado, false))
      .all();

    for (const c of adeudos) {
      const adeudo = c.montoCentavos - c.aplicadoCentavos;
      if (adeudo <= 0) continue;
      const sev = severidadDeAdeudo(c.venceEl, hoy);
      if (sev === "informativa") continue;
      const dias = diasEntreCivil(c.venceEl, hoy);
      alertas.push({
        clase: "adeudo",
        severidad: sev,
        titulo: `Adeudo de ${c.alumno}: ${pesos(adeudo)}`,
        detalle: dias > 0
          ? `${c.descripcion} · venció hace ${dias} día${dias === 1 ? "" : "s"}`
          : `${c.descripcion} · vence el ${c.venceEl}`,
        href: `/alumnos/${c.alumnoId}`,
        peso: adeudo / 100 + Math.max(0, dias) * 100,
      });
    }

    const porPagar = db
      .select({
        docenteId: docentes.id,
        docente: docentes.nombre,
        clases: sql<number>`count(*)`,
        total: sql<number>`sum(nomina_partidas.importe_centavos)`,
      })
      .from(nominaPartidas)
      .innerJoin(docentes, eq(docentes.id, nominaPartidas.docenteId))
      .where(isNull(nominaPartidas.nominaId))
      .groupBy(docentes.id, docentes.nombre)
      .all();

    for (const n of porPagar) {
      alertas.push({
        clase: "nomina",
        severidad: "informativa",
        titulo: `Nómina por pagar: ${n.docente}`,
        detalle: `${n.clases} clase${n.clases === 1 ? "" : "s"} · ${pesos(n.total)}`,
        href: "/finanzas/nomina",
        peso: n.total / 100,
      });
    }
  }

  // --- prospectos sin seguimiento --------------------------------------------
  // Un prospecto no se pierde por falta de interés: se pierde porque nadie volvió
  // a escribirle. Es la única alerta que representa dinero que todavía no entró.
  if (verProspectos) {
    for (const p of seguimientosPendientes(hoy)) {
      const seg = estadoDeSeguimiento(p.proximoSeguimientoEl, hoy);
      const dias = p.proximoSeguimientoEl ? diasEntreCivil(p.proximoSeguimientoEl, hoy) : 0;
      alertas.push({
        clase: "prospecto",
        severidad: seg === "vencido" && dias >= 3 ? "urgente" : "pronto",
        titulo: `Prospecto sin seguir: ${p.nombre}`,
        detalle: siguienteAccion({
          estado: p.estado as Etapa,
          proximoSeguimientoEl: p.proximoSeguimientoEl,
          claseMuestraEl: p.claseMuestraEl,
          claseMuestraAsistio: p.claseMuestraAsistio,
          ultimoContactoEl: null,
        }, hoy),
        href: `/prospectos/${p.id}`,
        peso: dias,
      });
    }
  }

  // --- mensajes esperando aprobación -----------------------------------------
  // Un mensaje sin aprobar no lo recibe nadie: la cola detenida es el tutor que
  // se quedó sin su recordatorio, no un pendiente administrativo.
  if (puedeAprobarMensajes) {
    const m = cuentaPorEstado();
    if (m.borrador > 0) {
      alertas.push({
        clase: "mensaje",
        severidad: "pronto",
        titulo: `${m.borrador} mensaje${m.borrador === 1 ? "" : "s"} esperando tu aprobación`,
        detalle: "Mientras no los apruebes, no los recibe nadie.",
        href: "/comunicacion?estado=borrador",
        peso: m.borrador,
      });
    }
    if (m.aprobado > 0) {
      alertas.push({
        clase: "mensaje",
        severidad: "pronto",
        titulo: `${m.aprobado} mensaje${m.aprobado === 1 ? "" : "s"} aprobado${m.aprobado === 1 ? "" : "s"} sin mandar`,
        detalle: "Ya están autorizados; falta mandarlos y marcar el envío.",
        href: "/comunicacion?estado=aprobado",
        peso: m.aprobado,
      });
    }
  }

  // --- instrumentos prestados cuyo período ya cerró -------------------------
  // El préstamo dura lo que dura el período. Cuando el período vence sin renovar,
  // el instrumento está en casa de alguien que ya no toma clases: es la única
  // situación del inventario que de verdad urge.
  if (verInventario) {
    for (const pr of prestamosVigentes()) {
      const est = estadoDeDevolucion(pr.terminaEl, hoy);
      if (est === "vigente") continue;
      const dias = diasEntreCivil(pr.terminaEl, hoy);
      alertas.push({
        clase: "prestamo",
        severidad: est === "vencido" ? "urgente" : "pronto",
        titulo: `${pr.instrumento} sin devolver: ${pr.alumno}`,
        detalle: est === "vencido"
          ? `El período cerró hace ${dias} día${dias === 1 ? "" : "s"} · folio ${pr.codigo}`
          : `El período termina el ${pr.terminaEl} · folio ${pr.codigo}`,
        href: `/inventario/${pr.ejemplarId}`,
        peso: dias,
      });
    }
  }

  // --- recitales ---------------------------------------------------------
  // Una propuesta sin confirmar es un alumno que no sabe si toca. Se avisa con más
  // urgencia conforme se acerca la fecha: a tres días ya no hay margen para ensayar.
  if (verRecitales) {
    for (const rec of proximosRecitales(hoy)) {
      if (rec.propuestas === 0) continue;
      const faltan = diasEntreCivil(hoy, rec.fecha);
      alertas.push({
        clase: "recital",
        severidad: faltan <= 3 ? "urgente" : "pronto",
        titulo: `${rec.propuestas} propuesta(s) sin confirmar: ${rec.nombre}`,
        detalle: faltan === 0
          ? "El recital es hoy."
          : `Faltan ${faltan} día${faltan === 1 ? "" : "s"} para el recital.`,
        href: `/recitales/${rec.id}`,
        peso: 100 - faltan,
      });
    }
  }

  // --- respaldo -------------------------------------------------------------
  // El aviso útil no es «no hay respaldo» —eso se ve—, sino «el último es de hace
  // demasiado», que es el que nadie nota hasta que lo necesita.
  if (alcance.tipo === "todo" && !respaldoAlDia(ultimoRespaldo, hoy)) {
    const dias = ultimoRespaldo ? diasEntreCivil(ultimoRespaldo, hoy) : null;
    alertas.push({
      clase: "respaldo",
      severidad: dias === null || dias > 7 ? "urgente" : "pronto",
      titulo: ultimoRespaldo
        ? `El último respaldo es de hace ${dias} día${dias === 1 ? "" : "s"}`
        : "No hay ningún respaldo",
      detalle: "Corre `npm run respaldo` y guarda la copia fuera de este servidor.",
      href: "/catalogo",
      peso: dias ?? 999,
    });
  }

  return ordenarAlertas(alertas);
}

// ------------------------------------------------------------------- hoy ---

export type ClaseDeHoy = {
  id: number;
  iniciaEn: Date;
  minutos: number;
  alumno: string;
  alumnoId: number;
  docente: string;
  programa: string;
  estado: string;
  modalidad: string;
};

/** La agenda del día, ya filtrada por alcance. Es la primera pregunta de la mañana. */
export function clasesDeHoy(alcance: Alcance, hoy: string): ClaseDeHoy[] {
  const delDocente = filtroDocente(alcance);
  return db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      minutos: clases.minutos,
      alumno: alumnos.nombre,
      alumnoId: alumnos.id,
      docente: docentes.nombre,
      programa: programas.nombre,
      estado: clases.estado,
      modalidad: clases.modalidad,
    })
    .from(clases)
    .innerJoin(inscripciones, eq(inscripciones.id, clases.inscripcionId))
    .innerJoin(alumnos, eq(alumnos.id, inscripciones.alumnoId))
    .innerJoin(programas, eq(programas.id, inscripciones.programaId))
    .innerJoin(docentes, eq(docentes.id, clases.docenteId))
    .where(and(
      gte(clases.iniciaEn, instanteEnMexico(hoy, "00:00")),
      lte(clases.iniciaEn, instanteEnMexico(hoy, "23:59")),
      ...(delDocente ? [delDocente] : []),
    ))
    .orderBy(asc(clases.iniciaEn))
    .all();
}

export type Indicadores = {
  alumnosActivos: number;
  inscripcionesActivas: number;
  clasesHoy: number;
  clasesEstaSemana: number;
};

export function indicadores(alcance: Alcance, hoy: string): Indicadores {
  const delDocente = filtroDocente(alcance);
  const propio = alcance.tipo === "propio";
  const enSieteDias = new Date(instanteEnMexico(hoy, "23:59").getTime() + 7 * 86_400_000);

  return {
    alumnosActivos: db.select({ n: sql<number>`count(DISTINCT alumnos.id)` })
      .from(alumnos)
      .innerJoin(inscripciones, eq(inscripciones.alumnoId, alumnos.id))
      .where(and(eq(alumnos.estado, "activo"), eq(inscripciones.estado, "activa"),
        ...(propio
          ? [alcance.docenteId === null ? sql`0 = 1` : eq(inscripciones.docenteId, alcance.docenteId)]
          : [])))
      .get()?.n ?? 0,
    inscripcionesActivas: db.select({ n: sql<number>`count(*)` })
      .from(inscripciones)
      .where(and(eq(inscripciones.estado, "activa"),
        ...(propio
          ? [alcance.docenteId === null ? sql`0 = 1` : eq(inscripciones.docenteId, alcance.docenteId)]
          : [])))
      .get()?.n ?? 0,
    clasesHoy: db.select({ n: sql<number>`count(*)` }).from(clases)
      .where(and(
        gte(clases.iniciaEn, instanteEnMexico(hoy, "00:00")),
        lte(clases.iniciaEn, instanteEnMexico(hoy, "23:59")),
        ...(delDocente ? [delDocente] : []),
      )).get()?.n ?? 0,
    clasesEstaSemana: db.select({ n: sql<number>`count(*)` }).from(clases)
      .where(and(
        gte(clases.iniciaEn, instanteEnMexico(hoy, "00:00")),
        lte(clases.iniciaEn, enSieteDias),
        ...(delDocente ? [delDocente] : []),
      )).get()?.n ?? 0,
  };
}

/**
 * Fecha del respaldo más reciente, leída del disco.
 *
 * No hay tabla de respaldos a propósito: si el registro viviera en la base, un
 * respaldo restaurado traería consigo la lista de respaldos de otro momento. El
 * disco es la única fuente que no miente sobre sus propios archivos.
 */
export function ultimoRespaldo(): string | null {
  const dir = process.env.RESPALDOS_DIR ?? "./respaldos";
  try {
    const fechas = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^batuta-\d{4}-\d{2}-\d{2}/.test(e.name))
      .map((e) => e.name.slice(7, 17))
      .sort();
    return fechas[fechas.length - 1] ?? null;
  } catch {
    // La carpeta todavía no existe: es lo mismo que no tener respaldo.
    return null;
  }
}
