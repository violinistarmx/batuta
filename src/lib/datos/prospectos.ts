import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, instrumentos, programas, prospectos, seguimientos, usuarios,
} from "@/db/schema/index";
import { crearAlumno } from "@/lib/datos/alumnos";
import {
  embudoVacio, motivoParaRechazarTransicion, type Embudo, type Etapa,
} from "@/lib/dominio/prospectos";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DatosProspecto = {
  nombre: string;
  edadAproximada: number | null;
  contactoNombre: string | null;
  contactoParentesco: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  programaInteresId: number | null;
  instrumentoInteresId: number | null;
  origen: "instagram" | "facebook" | "tiktok" | "recomendacion" | "paso_por_la_calle"
    | "whatsapp" | "google" | "evento" | "otro";
  origenDetalle: string | null;
  proximoSeguimientoEl: string | null;
  notas: string | null;
};

export function crearProspecto(d: DatosProspecto, usuarioId: number): number {
  const fila = db.insert(prospectos).values({ ...d, creadoPor: usuarioId })
    .returning({ id: prospectos.id }).get();
  if (!fila) throw new Error("No se pudo registrar el prospecto.");
  return fila.id;
}

/**
 * Posibles duplicados por teléfono o por nombre.
 *
 * Deliberadamente NO hay índice único sobre el teléfono: en una familia el número
 * es el mismo para los tres hermanos, y bloquear el alta obligaría a inventar
 * teléfonos falsos. Se avisa y decide la persona.
 */
export function posiblesDuplicados(telefono: string | null, nombre: string, excluirId = 0) {
  const tel = (telefono ?? "").replace(/\D/g, "");
  return db
    .select({
      id: prospectos.id,
      nombre: prospectos.nombre,
      telefono: prospectos.telefono,
      estado: prospectos.estado,
      creadoEn: prospectos.creadoEn,
    })
    .from(prospectos)
    .where(and(
      sql`${prospectos.id} <> ${excluirId}`,
      sql`(
        (${tel} <> '' AND replace(replace(replace(coalesce(prospectos.telefono, ''), ' ', ''), '-', ''), '+', '') = ${tel})
        OR sin_acentos(prospectos.nombre) = sin_acentos(${nombre})
      )`,
    ))
    .orderBy(desc(prospectos.creadoEn))
    .limit(5)
    .all();
}

export function prospectoPorId(id: number) {
  return db
    .select({
      id: prospectos.id,
      nombre: prospectos.nombre,
      edadAproximada: prospectos.edadAproximada,
      contactoNombre: prospectos.contactoNombre,
      contactoParentesco: prospectos.contactoParentesco,
      telefono: prospectos.telefono,
      whatsapp: prospectos.whatsapp,
      email: prospectos.email,
      programaInteresId: prospectos.programaInteresId,
      programa: programas.nombre,
      instrumento: instrumentos.nombre,
      origen: prospectos.origen,
      origenDetalle: prospectos.origenDetalle,
      estado: prospectos.estado,
      claseMuestraEl: prospectos.claseMuestraEl,
      claseMuestraHora: prospectos.claseMuestraHora,
      claseMuestraAsistio: prospectos.claseMuestraAsistio,
      motivoPerdida: prospectos.motivoPerdida,
      motivoDetalle: prospectos.motivoDetalle,
      proximoSeguimientoEl: prospectos.proximoSeguimientoEl,
      alumnoId: prospectos.alumnoId,
      convertidoEn: prospectos.convertidoEn,
      notas: prospectos.notas,
      creadoEn: prospectos.creadoEn,
      creadoPor: usuarios.nombre,
    })
    .from(prospectos)
    .leftJoin(programas, eq(programas.id, prospectos.programaInteresId))
    .leftJoin(instrumentos, eq(instrumentos.id, prospectos.instrumentoInteresId))
    .leftJoin(usuarios, eq(usuarios.id, prospectos.creadoPor))
    .where(eq(prospectos.id, id))
    .get();
}

export type FilaProspecto = {
  id: number;
  nombre: string;
  telefono: string | null;
  estado: Etapa;
  origen: string;
  programa: string | null;
  proximoSeguimientoEl: string | null;
  claseMuestraEl: string | null;
  claseMuestraAsistio: boolean | null;
  ultimoContactoEl: string | null;
  contactos: number;
};

/** Lista con el último contacto ya resuelto: el dato que decide a quién buscar. */
export function listarProspectos(estado?: Etapa | "abiertos"): FilaProspecto[] {
  const filtro = estado === "abiertos"
    ? sql`prospectos.estado IN ('nuevo','contactado','clase_muestra','en_negociacion')`
    : estado
      ? eq(prospectos.estado, estado)
      : undefined;

  const q = db
    .select({
      id: prospectos.id,
      nombre: prospectos.nombre,
      telefono: prospectos.telefono,
      estado: prospectos.estado,
      origen: prospectos.origen,
      programa: programas.nombre,
      proximoSeguimientoEl: prospectos.proximoSeguimientoEl,
      claseMuestraEl: prospectos.claseMuestraEl,
      claseMuestraAsistio: prospectos.claseMuestraAsistio,
      ultimoContactoEl: sql<string | null>`(
        SELECT max(s.fecha) FROM seguimientos s WHERE s.prospecto_id = prospectos.id
      )`,
      contactos: sql<number>`(
        SELECT count(*) FROM seguimientos s WHERE s.prospecto_id = prospectos.id
      )`,
    })
    .from(prospectos)
    .leftJoin(programas, eq(programas.id, prospectos.programaInteresId));

  return (filtro ? q.where(filtro) : q)
    .orderBy(asc(sql`coalesce(prospectos.proximo_seguimiento_el, '9999-12-31')`), desc(prospectos.id))
    .all();
}

export function seguimientosDe(prospectoId: number) {
  return db
    .select({
      id: seguimientos.id,
      fecha: seguimientos.fecha,
      canal: seguimientos.canal,
      resultado: seguimientos.resultado,
      nota: seguimientos.nota,
      usuario: usuarios.nombre,
    })
    .from(seguimientos)
    .leftJoin(usuarios, eq(usuarios.id, seguimientos.registradoPor))
    .where(eq(seguimientos.prospectoId, prospectoId))
    .orderBy(desc(seguimientos.fecha), desc(seguimientos.id))
    .all();
}

export type DatosSeguimiento = {
  prospectoId: number;
  fecha: string;
  canal: "whatsapp" | "llamada" | "mensaje_directo" | "correo" | "presencial" | "otro";
  resultado: "contactado" | "sin_respuesta" | "agendo_clase_muestra"
    | "pidio_informacion" | "rechazo" | "otro";
  nota: string | null;
  proximoSeguimientoEl: string | null;
};

/**
 * Registra un contacto y mueve la etapa si corresponde.
 *
 * Las dos cosas van juntas en una transacción porque separarlas produce el caso que
 * hace inútil el módulo: un seguimiento escrito y una etapa que sigue diciendo
 * «nuevo», de modo que la lista de a quién buscar nunca se vacía.
 */
export function registrarSeguimiento(d: DatosSeguimiento, usuarioId: number): Etapa {
  return db.transaction((tx) => {
    const p = tx.select({ estado: prospectos.estado })
      .from(prospectos).where(eq(prospectos.id, d.prospectoId)).get();
    if (!p) throw new Error("El prospecto no existe.");

    tx.insert(seguimientos).values({
      prospectoId: d.prospectoId,
      fecha: d.fecha,
      canal: d.canal,
      resultado: d.resultado,
      nota: d.nota,
      registradoPor: usuarioId,
    }).run();

    // Un prospecto «nuevo» al que ya se le escribió deja de ser nuevo aunque no
    // haya contestado: lo nuevo era la falta de intento, no la falta de respuesta.
    let estado: Etapa = p.estado;
    if (d.resultado === "agendo_clase_muestra") estado = "clase_muestra";
    else if (d.resultado === "rechazo") estado = "perdido";
    else if (p.estado === "nuevo") estado = "contactado";

    tx.update(prospectos).set({
      estado,
      proximoSeguimientoEl: d.proximoSeguimientoEl,
      actualizadoEn: new Date(),
    }).where(eq(prospectos.id, d.prospectoId)).run();

    return estado;
  });
}

export type CambioDeEtapa = {
  prospectoId: number;
  estado: Etapa;
  motivoPerdida?: "precio" | "horario" | "distancia" | "no_contesto"
    | "eligio_otra" | "sin_interes" | "otro" | null;
  motivoDetalle?: string | null;
  claseMuestraEl?: string | null;
  claseMuestraHora?: string | null;
  claseMuestraAsistio?: boolean | null;
  proximoSeguimientoEl?: string | null;
};

export function cambiarEtapa(d: CambioDeEtapa): void {
  db.transaction((tx) => {
    const p = tx.select({ estado: prospectos.estado })
      .from(prospectos).where(eq(prospectos.id, d.prospectoId)).get();
    if (!p) throw new Error("El prospecto no existe.");

    // «Convertido» NO se alcanza por aquí, ni siquiera desde una etapa desde la que
    // la transición es legítima. Convertir significa abrir un expediente, y eso solo
    // lo hace `convertirProspecto`. Sin esta puerta, un formulario editado a mano
    // dejaba el prospecto marcado como convertido con `alumno_id` en NULL: el embudo
    // contaba una inscripción que nunca existió y nadie podía encontrar al alumno.
    if (d.estado === "convertido") {
      throw new Error("Para convertirlo hay que abrir su expediente, no solo cambiar la etapa.");
    }

    // La regla se comprueba dentro de la transacción: la pantalla puede deshabilitar
    // el botón, pero el formulario viaja y quien lo edite llegaría igual.
    const motivo = motivoParaRechazarTransicion(p.estado, d.estado);
    if (motivo) throw new Error(motivo);

    if (d.estado === "perdido" && !d.motivoPerdida) {
      throw new Error("Un prospecto perdido necesita motivo: sin eso el reporte no enseña nada.");
    }

    tx.update(prospectos).set({
      estado: d.estado,
      motivoPerdida: d.estado === "perdido" ? d.motivoPerdida ?? null : null,
      motivoDetalle: d.estado === "perdido" ? d.motivoDetalle ?? null : null,
      ...(d.claseMuestraEl !== undefined ? { claseMuestraEl: d.claseMuestraEl } : {}),
      ...(d.claseMuestraHora !== undefined ? { claseMuestraHora: d.claseMuestraHora } : {}),
      ...(d.claseMuestraAsistio !== undefined ? { claseMuestraAsistio: d.claseMuestraAsistio } : {}),
      ...(d.proximoSeguimientoEl !== undefined
        ? { proximoSeguimientoEl: d.proximoSeguimientoEl } : {}),
      actualizadoEn: new Date(),
    }).where(eq(prospectos.id, d.prospectoId)).run();
  });
}

// ------------------------------------------------------------- conversión ---

export type DatosConversion = {
  prospectoId: number;
  fechaNacimiento: string | null;
  avisoPrivacidad: boolean;
  usoImagen: boolean;
  tutorExistenteId: number | null;
};

/**
 * Convierte el prospecto en alumno, en una sola transacción.
 *
 * El alta del alumno y el cierre del prospecto no pueden separarse: un alumno
 * creado con su prospecto todavía «en negociación» sale dos veces —una en el
 * expediente y otra en la lista de a quién buscar— y alguien le escribe para
 * ofrecerle lo que ya compró.
 *
 * El contacto del prospecto se convierte en tutor cuando es otra persona. Si el
 * adulto preguntó por sí mismo, no se inventa un tutor: la N:N admite cero.
 */
export function convertirProspecto(
  d: DatosConversion,
  usuarioId: number,
  diasCredencial: number,
): { alumnoId: number; codigo: string } {
  const p = prospectoPorId(d.prospectoId);
  if (!p) throw new Error("El prospecto no existe.");
  if (p.alumnoId !== null) throw new Error("Este prospecto ya se convirtió en alumno.");

  const motivo = motivoParaRechazarTransicion(p.estado as Etapa, "convertido");
  if (motivo) throw new Error(motivo);

  if (!d.avisoPrivacidad) {
    throw new Error("Sin aviso de privacidad no hay base legal para abrir el expediente.");
  }

  // El contacto es tutor solo si es otra persona: un adulto que pregunta por sí
  // mismo no es su propio tutor, y registrarlo así ensucia el padrón.
  const hayTutor = d.tutorExistenteId !== null
    || (p.contactoNombre !== null && p.contactoNombre.trim() !== ""
        && p.contactoNombre.trim().toLowerCase() !== p.nombre.trim().toLowerCase());

  const creado = crearAlumno({
    nombre: p.nombre,
    fechaNacimiento: d.fechaNacimiento,
    sexo: null,
    telefono: p.telefono,
    email: p.email,
    direccion: null,
    colonia: null,
    objetivoMusical: p.notas,
    experienciaPrevia: null,
    observaciones: p.origenDetalle ? `Origen: ${p.origen} · ${p.origenDetalle}` : `Origen: ${p.origen}`,
    tutor: hayTutor
      ? {
          existenteId: d.tutorExistenteId,
          nombre: p.contactoNombre ?? "",
          parentesco: p.contactoParentesco ?? "Tutor",
          telefono: p.telefono,
          whatsapp: p.whatsapp ?? p.telefono,
          email: p.email,
          esResponsablePago: true,
        }
      : null,
    salud: null,
    consiente: {
      avisoPrivacidad: d.avisoPrivacidad,
      usoImagen: d.usoImagen,
      otorgadoPor: p.contactoNombre ?? p.nombre,
    },
  }, usuarioId, diasCredencial);

  // El índice único sobre alumno_id impide que dos clics seguidos dejen dos
  // expedientes reclamando al mismo prospecto.
  db.update(prospectos).set({
    estado: "convertido",
    alumnoId: creado.id,
    convertidoEn: new Date(),
    proximoSeguimientoEl: null,
    actualizadoEn: new Date(),
  }).where(eq(prospectos.id, d.prospectoId)).run();

  return { alumnoId: creado.id, codigo: creado.codigo };
}

// ---------------------------------------------------------------- reportes ---

export function embudo(desde?: string, hasta?: string): Embudo {
  const filtro = desde && hasta
    ? sql`date(prospectos.creado_en, 'unixepoch') BETWEEN ${desde} AND ${hasta}`
    : undefined;

  const q = db.select({ estado: prospectos.estado, n: sql<number>`count(*)` }).from(prospectos);
  const filas = (filtro ? q.where(filtro) : q).groupBy(prospectos.estado).all();

  const e = embudoVacio();
  for (const f of filas) e[f.estado as Etapa] = f.n;
  return e;
}

export function porOrigen(desde?: string, hasta?: string) {
  const filtro = desde && hasta
    ? sql`date(prospectos.creado_en, 'unixepoch') BETWEEN ${desde} AND ${hasta}`
    : undefined;

  const q = db
    .select({
      origen: prospectos.origen,
      total: sql<number>`count(*)`,
      convertidos: sql<number>`sum(CASE WHEN prospectos.estado = 'convertido' THEN 1 ELSE 0 END)`,
    })
    .from(prospectos);

  return (filtro ? q.where(filtro) : q).groupBy(prospectos.origen).all();
}

export function motivosDePerdida(desde?: string, hasta?: string) {
  const filtro = desde && hasta
    ? sql`date(prospectos.creado_en, 'unixepoch') BETWEEN ${desde} AND ${hasta}`
    : undefined;

  const base = and(eq(prospectos.estado, "perdido"), sql`prospectos.motivo_perdida IS NOT NULL`);

  return db
    .select({ motivo: prospectos.motivoPerdida, n: sql<number>`count(*)` })
    .from(prospectos)
    .where(filtro ? and(base, filtro) : base)
    .groupBy(prospectos.motivoPerdida)
    .orderBy(desc(sql`count(*)`))
    .all();
}

/** Prospectos abiertos cuyo seguimiento venció o nunca se agendó. */
export function seguimientosPendientes(hoy: string) {
  return db
    .select({
      id: prospectos.id,
      nombre: prospectos.nombre,
      estado: prospectos.estado,
      proximoSeguimientoEl: prospectos.proximoSeguimientoEl,
      claseMuestraEl: prospectos.claseMuestraEl,
      claseMuestraAsistio: prospectos.claseMuestraAsistio,
    })
    .from(prospectos)
    .where(and(
      sql`prospectos.estado IN ('nuevo','contactado','clase_muestra','en_negociacion')`,
      sql`(prospectos.proximo_seguimiento_el IS NULL OR prospectos.proximo_seguimiento_el <= ${hoy})`,
    ))
    .orderBy(asc(sql`coalesce(prospectos.proximo_seguimiento_el, '0000-01-01')`))
    .all();
}
