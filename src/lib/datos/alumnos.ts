import "server-only";

import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  alumnos, alumnosTutores, consentimientos, credenciales, inscripciones,
  saludAlumno, secuencias, tutores,
} from "@/db/schema/index";
import { cifrarOpcional, descifrarOpcional } from "@/lib/cifrado";
import { generarTokenQr } from "@/lib/qr";
import type { Alcance } from "@/lib/auth/permisos";

/**
 * Acceso a alumnos. El alcance por rol se aplica AQUÍ, no en las pantallas.
 *
 * Si el filtro viviera en la interfaz, cualquier pantalla nueva que olvidara
 * aplicarlo expondría a todos los alumnos. Obligando a pasar el alcance como
 * argumento, omitirlo es un error de compilación.
 */

export type DatosAlta = {
  nombre: string;
  fechaNacimiento: string | null;
  sexo: "F" | "M" | "otro" | "no_especifica" | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  colonia: string | null;
  objetivoMusical: string | null;
  experienciaPrevia: string | null;
  observaciones: string | null;
  tutor: {
    /**
     * Tutor que ya existe en el padrón. Cuando viene, no se crea uno nuevo: se
     * vincula. Sin esto, cada hermano estrenaba su propia copia de la misma madre
     * —tres filas para una persona— y la tabla N:N que existe justo para
     * compartirla no servía para nada.
     */
    existenteId: number | null;
    nombre: string;
    parentesco: string;
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
    esResponsablePago: boolean;
  } | null;
  salud: {
    condicionSalud: string | null;
    trastornoAprendizaje: string | null;
    discapacidadSensorial: string | null;
    medicamentos: string | null;
    consideracionEmocional: string | null;
    observaciones: string | null;
  } | null;
  consiente: { avisoPrivacidad: boolean; usoImagen: boolean; otorgadoPor: string };
};

/** El tipo de transacción de Drizzle, derivado en vez de escrito a mano. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Siguiente folio de alumno: VS-0001. Se incrementa dentro de la transacción. */
function siguienteCodigo(tx: Tx): string {
  tx.insert(secuencias).values({ clave: "alumno", valor: 0 }).onConflictDoNothing().run();
  const fila = tx
    .update(secuencias)
    .set({ valor: sql`${secuencias.valor} + 1` })
    .where(eq(secuencias.clave, "alumno"))
    .returning({ valor: secuencias.valor })
    .get();
  return `VS-${String(fila?.valor ?? 1).padStart(4, "0")}`;
}

/**
 * Alta completa en una sola transacción.
 *
 * Alumno, tutor, ficha de salud, consentimientos y credencial entran juntos o no
 * entra nada. Un alumno a medias —con expediente pero sin consentimiento
 * registrado— es peor que ninguno.
 */
export function crearAlumno(
  datos: DatosAlta,
  usuarioId: number,
  diasCredencial: number,
): { id: number; codigo: string; qrToken: string } {
  return db.transaction((tx) => {
    const codigo = siguienteCodigo(tx);
    const qrToken = generarTokenQr();
    const hoy = new Date().toISOString().slice(0, 10);

    const alumno = tx.insert(alumnos).values({
      codigo,
      qrToken,
      nombre: datos.nombre,
      fechaNacimiento: datos.fechaNacimiento,
      sexo: datos.sexo,
      telefono: datos.telefono,
      email: datos.email,
      direccion: datos.direccion,
      colonia: datos.colonia,
      fechaInscripcion: hoy,
      objetivoMusical: datos.objetivoMusical,
      experienciaPrevia: datos.experienciaPrevia,
      observaciones: datos.observaciones,
    }).returning({ id: alumnos.id }).get();

    if (!alumno) throw new Error("No se pudo crear el alumno.");

    let nombreDelTutor: string | null = null;

    if (datos.tutor) {
      const tutor = datos.tutor.existenteId !== null
        ? tx.select({ id: tutores.id, nombre: tutores.nombre }).from(tutores)
            .where(eq(tutores.id, datos.tutor.existenteId)).get()
        : tx.insert(tutores).values({
            nombre: datos.tutor.nombre,
            telefono: datos.tutor.telefono,
            whatsapp: datos.tutor.whatsapp,
            email: datos.tutor.email,
          }).returning({ id: tutores.id, nombre: tutores.nombre }).get();

      if (!tutor) throw new Error("El tutor seleccionado no existe.");

      // El consentimiento lo otorga quien firma. Con un tutor del padrón, el
      // formulario no trae su nombre: se toma del registro, no del alumno menor.
      nombreDelTutor = tutor.nombre;

      if (tutor) {
        tx.insert(alumnosTutores).values({
          alumnoId: alumno.id,
          tutorId: tutor.id,
          parentesco: datos.tutor.parentesco,
          esResponsablePago: datos.tutor.esResponsablePago,
        }).run();
      }
    }

    // Datos sensibles: cifrados campo por campo antes de tocar el disco.
    if (datos.salud && Object.values(datos.salud).some((v) => v?.trim())) {
      tx.insert(saludAlumno).values({
        alumnoId: alumno.id,
        condicionSalud: cifrarOpcional(datos.salud.condicionSalud),
        trastornoAprendizaje: cifrarOpcional(datos.salud.trastornoAprendizaje),
        discapacidadSensorial: cifrarOpcional(datos.salud.discapacidadSensorial),
        medicamentos: cifrarOpcional(datos.salud.medicamentos),
        consideracionEmocional: cifrarOpcional(datos.salud.consideracionEmocional),
        observaciones: cifrarOpcional(datos.salud.observaciones),
        actualizadoPor: usuarioId,
      }).run();
    }

    // El "no" queda registrado igual que el "sí": hoy depende de que alguien
    // recuerde una conversación, y eso no es un control.
    for (const [tipo, otorgado] of [
      ["aviso_privacidad", datos.consiente.avisoPrivacidad],
      ["uso_imagen", datos.consiente.usoImagen],
    ] as const) {
      tx.insert(consentimientos).values({
        alumnoId: alumno.id,
        tipo,
        otorgado,
        otorgadoPor: nombreDelTutor ?? datos.consiente.otorgadoPor,
        fecha: hoy,
      }).run();
    }

    // Cláusula 10ª: credencial oficial a los 7 días del alta, sin costo.
    const emitir = new Date();
    emitir.setDate(emitir.getDate() + diasCredencial);
    tx.insert(credenciales).values({
      alumnoId: alumno.id,
      emitirDesde: emitir.toISOString().slice(0, 10),
    }).run();

    return { id: alumno.id, codigo, qrToken };
  });
}

/** Filtro de alcance: un docente solo ve alumnos con inscripción activa suya. */
function filtroAlcance(alcance: Alcance) {
  if (alcance.tipo === "todo") return undefined;
  if (alcance.docenteId === null) return sql`0 = 1`; // docente sin ficha: no ve nada
  return sql`EXISTS (
    SELECT 1 FROM ${inscripciones}
    WHERE ${inscripciones.alumnoId} = ${alumnos.id}
      AND ${inscripciones.docenteId} = ${alcance.docenteId}
      AND ${inscripciones.estado} = 'activa'
  )`;
}

export type ResumenAlumno = {
  id: number;
  codigo: string;
  nombre: string;
  fechaNacimiento: string | null;
  telefono: string | null;
  estado: "activo" | "inactivo";
  tutor: string | null;
};

export function listarAlumnos(alcance: Alcance, busqueda?: string): ResumenAlumno[] {
  const condiciones = [filtroAlcance(alcance)];

  if (busqueda?.trim()) {
    // Se normalizan los dos lados: buscar "martinez" encuentra "Martínez".
    const q = `%${busqueda.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}%`;
    condiciones.push(or(
      like(sql`sin_acentos(${alumnos.nombre})`, q),
      like(sql`sin_acentos(${alumnos.codigo})`, q),
      like(alumnos.telefono, q),
      sql`EXISTS (
        SELECT 1 FROM ${alumnosTutores}
        JOIN ${tutores} ON ${tutores.id} = ${alumnosTutores.tutorId}
        WHERE ${alumnosTutores.alumnoId} = ${alumnos.id}
          AND (sin_acentos(${tutores.nombre}) LIKE ${q} OR ${tutores.telefono} LIKE ${q})
      )`,
    ));
  }

  const activas = condiciones.filter(Boolean);

  return db
    .select({
      id: alumnos.id,
      codigo: alumnos.codigo,
      nombre: alumnos.nombre,
      fechaNacimiento: alumnos.fechaNacimiento,
      telefono: alumnos.telefono,
      estado: alumnos.estado,
      tutor: sql<string | null>`(
        SELECT ${tutores.nombre} FROM ${alumnosTutores}
        JOIN ${tutores} ON ${tutores.id} = ${alumnosTutores.tutorId}
        WHERE ${alumnosTutores.alumnoId} = ${alumnos.id}
        LIMIT 1
      )`,
    })
    .from(alumnos)
    .where(activas.length ? and(...activas) : undefined)
    .orderBy(desc(alumnos.creadoEn))
    .limit(200)
    .all();
}

export function alumnoPorId(id: number, alcance: Alcance) {
  const filtro = filtroAlcance(alcance);
  return db
    .select()
    .from(alumnos)
    .where(filtro ? and(eq(alumnos.id, id), filtro) : eq(alumnos.id, id))
    .get();
}

/** Resuelve el token del QR. El alcance aplica igual que en cualquier otra consulta. */
export function alumnoPorQr(token: string, alcance: Alcance) {
  const filtro = filtroAlcance(alcance);
  return db
    .select({ id: alumnos.id })
    .from(alumnos)
    .where(filtro ? and(eq(alumnos.qrToken, token), filtro) : eq(alumnos.qrToken, token))
    .get();
}

export function tutoresDe(alumnoId: number) {
  return db
    .select({
      id: tutores.id,
      nombre: tutores.nombre,
      telefono: tutores.telefono,
      whatsapp: tutores.whatsapp,
      email: tutores.email,
      parentesco: alumnosTutores.parentesco,
      esResponsablePago: alumnosTutores.esResponsablePago,
    })
    .from(alumnosTutores)
    .innerJoin(tutores, eq(tutores.id, alumnosTutores.tutorId))
    .where(eq(alumnosTutores.alumnoId, alumnoId))
    .all();
}

export function consentimientosDe(alumnoId: number) {
  return db.select().from(consentimientos).where(eq(consentimientos.alumnoId, alumnoId)).all();
}

export function credencialDe(alumnoId: number) {
  return db.select().from(credenciales).where(eq(credenciales.alumnoId, alumnoId)).get();
}

/**
 * Ficha de salud, descifrada.
 *
 * Quien llame a esto debe haber verificado el permiso `salud.leer` y registrar la
 * consulta en bitácora. No se expone desde ninguna otra consulta, ni aparece en
 * listados ni exportaciones.
 */
export function saludDe(alumnoId: number) {
  const fila = db.select().from(saludAlumno).where(eq(saludAlumno.alumnoId, alumnoId)).get();
  if (!fila) return null;
  return {
    condicionSalud: descifrarOpcional(fila.condicionSalud),
    trastornoAprendizaje: descifrarOpcional(fila.trastornoAprendizaje),
    discapacidadSensorial: descifrarOpcional(fila.discapacidadSensorial),
    medicamentos: descifrarOpcional(fila.medicamentos),
    consideracionEmocional: descifrarOpcional(fila.consideracionEmocional),
    observaciones: descifrarOpcional(fila.observaciones),
    actualizadoEn: fila.actualizadoEn,
  };
}

/**
 * Tutores ya registrados, con los alumnos que representan.
 *
 * Alimenta el selector del alta: cuando llega el segundo hermano, recepción lo
 * cuelga del tutor que ya existe en vez de teclear el nombre otra vez. De ahí
 * dependen los planes familiares, que exigen tutor en común.
 */
export function tutoresParaVincular() {
  return db
    .select({
      id: tutores.id,
      nombre: tutores.nombre,
      telefono: tutores.telefono,
      alumnos: sql<string>`(
        SELECT group_concat(a.nombre, ', ') FROM alumnos_tutores at
        JOIN alumnos a ON a.id = at.alumno_id
        WHERE at.tutor_id = tutores.id
      )`,
    })
    .from(tutores)
    .orderBy(asc(tutores.nombre))
    .all();
}
