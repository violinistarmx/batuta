/**
 * Semillas de Batuta.
 *
 * Todo dato aqui sale del contrato VioliniStar 2025 o de una decision de direccion
 * registrada en el analisis previo. Nada esta inventado: si un valor no estaba en
 * el contrato ni fue confirmado, no aparece.
 *
 * Idempotente: se puede correr varias veces sin duplicar.
 */

import { eq } from "drizzle-orm";

import { db, sqlite } from "./index";
import {
  aulas,
  configuracion,
  instrumentos,
  niveles,
  permisos,
  preciosVigencia,
  plantillas, programas,
  roles,
  rolesPermisos,
} from "./schema/index";

const HOY = new Date().toISOString().slice(0, 10);

// --- Instrumentos -----------------------------------------------------------
// Clausula 9a: los de gran formato no salen de las instalaciones.
const INSTRUMENTOS = [
  { nombre: "Violín", granFormato: false },
  { nombre: "Piano", granFormato: true },
  { nombre: "Canto", granFormato: false },
  { nombre: "Guitarra", granFormato: false },
  { nombre: "Guitarra eléctrica", granFormato: false },
  { nombre: "Bajo", granFormato: false },
  { nombre: "Ukelele", granFormato: false },
  { nombre: "Violonchelo", granFormato: true },
];

// --- Programas --------------------------------------------------------------
// Nombres, descripciones y tarifas literales de la Clausula Segunda.
const PROGRAMAS = [
  {
    clave: "plan_por_clase",
    nombre: "Plan por Clase",
    descripcion: "Clase individual suelta, reagendable",
    clasesPorCiclo: 1,
    minutosPorClase: 60,
    renovable: false,
    permitePrestamoACasa: false,
    alumnosIncluidos: 1,
    precioCentavos: 20_000,
  },
  {
    clave: "allegro_andante",
    nombre: "Allegro Andante",
    descripcion: "4 clases individuales al mes",
    clasesPorCiclo: 4,
    minutosPorClase: 60,
    renovable: true,
    permitePrestamoACasa: false,
    alumnosIncluidos: 1,
    precioCentavos: 75_000,
  },
  {
    clave: "allegro_virtuoso",
    nombre: "Allegro Virtuoso",
    descripcion: "8 clases individuales al mes",
    clasesPorCiclo: 8,
    minutosPorClase: 60,
    renovable: true,
    // Unico programa que autoriza llevarse el instrumento a casa (clausula 9a).
    permitePrestamoACasa: true,
    alumnosIncluidos: 1,
    precioCentavos: 150_000,
  },
  {
    clave: "presto_virtuoso",
    nombre: "Presto Virtuoso",
    descripcion: "8 sesiones de 2 horas al mes",
    clasesPorCiclo: 8,
    minutosPorClase: 120,
    renovable: true,
    permitePrestamoACasa: false,
    alumnosIncluidos: 1,
    precioCentavos: 250_000,
  },
  // Planes familiares. `clasesPorCiclo` es lo que recibe CADA alumno: un Family
  // Duet de dos son ocho clases al mes y ocho horas de maestro, no cuatro. El
  // precio es del grupo y lo carga una sola inscripcion, la titular.
  {
    clave: "allegro_andante_family_2",
    nombre: "Allegro Andante Family Duet · 2 alumnos",
    descripcion: "Clase individual, 4 sesiones al mes para cada uno de 2 alumnos",
    clasesPorCiclo: 4,
    minutosPorClase: 60,
    renovable: true,
    permitePrestamoACasa: false,
    alumnosIncluidos: 2,
    precioCentavos: 145_000,
  },
  {
    clave: "allegro_andante_family_3",
    nombre: "Allegro Andante Family Duet · 3 alumnos",
    descripcion: "Clase individual, 4 sesiones al mes para cada uno de 3 alumnos",
    clasesPorCiclo: 4,
    minutosPorClase: 60,
    renovable: true,
    permitePrestamoACasa: false,
    alumnosIncluidos: 3,
    precioCentavos: 210_000,
  },
  {
    clave: "allegro_virtuoso_familiar_2",
    nombre: "Allegro Virtuoso Familiar · 2 alumnos",
    descripcion: "Clase individual, 8 sesiones al mes (2 por semana) para cada uno de 2 alumnos",
    clasesPorCiclo: 8,
    minutosPorClase: 60,
    renovable: true,
    permitePrestamoACasa: true,
    alumnosIncluidos: 2,
    precioCentavos: 280_000,
  },
  {
    clave: "allegro_virtuoso_familiar_3",
    nombre: "Allegro Virtuoso Familiar · 3 alumnos",
    descripcion: "Clase individual, 8 sesiones al mes (2 por semana) para cada uno de 3 alumnos",
    clasesPorCiclo: 8,
    minutosPorClase: 60,
    renovable: true,
    permitePrestamoACasa: true,
    alumnosIncluidos: 3,
    precioCentavos: 409_500,
  },
];

/**
 * Plantillas de mensajes. El texto es el que la academia usa hoy por WhatsApp;
 * vive en la base para que cambiarlo no exija tocar el codigo.
 *
 * Los huecos {{asi}} se llenan al redactar. Si alguno queda sin llenar, el sistema
 * se niega a guardar el borrador: mas vale un error que un «Hola {{tutor}}».
 */
const PLANTILLAS = [
  {
    clave: "recordatorio_clase",
    nombre: "Recordatorio de clase",
    descripcion: "Se manda la vispera para bajar las faltas sin aviso",
    canal: "whatsapp" as const,
    cuerpo:
      "Hola {{tutor}}, le recordamos que {{alumno}} tiene clase el {{fecha}} a las " +
      "{{hora}} con {{maestro}}.\n\nSi no puede asistir, avisenos con al menos " +
      "{{horas_aviso}} horas para reprogramarla (clausula 4a).\n\nAcademia de Musica VioliniStar",
  },
  {
    clave: "aviso_adeudo",
    nombre: "Aviso de adeudo",
    descripcion: "Cobranza amable cuando la mensualidad vencio",
    canal: "whatsapp" as const,
    cuerpo:
      "Hola {{tutor}}, esperamos que {{alumno}} este disfrutando sus clases.\n\n" +
      "Le recordamos que quedo pendiente el pago de {{concepto}} por {{monto}}, con " +
      "vencimiento el {{vence}}.\n\nPuede liquidarlo en la academia o por transferencia. " +
      "Cualquier duda estamos para servirle.\n\nAcademia de Musica VioliniStar",
  },
  {
    clave: "periodo_por_vencer",
    nombre: "Periodo por vencer",
    descripcion: "Renovacion antes de que el alumno se quede sin clases",
    canal: "whatsapp" as const,
    cuerpo:
      "Hola {{tutor}}, el periodo de {{alumno}} en {{programa}} termina el {{termina}}.\n\n" +
      "Para que no pierda continuidad, podemos dejar listo el siguiente periodo esta " +
      "semana. Le recordamos que las clases no tomadas no se acumulan al mes siguiente " +
      "(clausula 4a).\n\nAcademia de Musica VioliniStar",
  },
  {
    clave: "bienvenida",
    nombre: "Bienvenida",
    descripcion: "Primer mensaje despues de inscribir",
    canal: "whatsapp" as const,
    cuerpo:
      "Bienvenida a la familia VioliniStar, {{tutor}}. Nos da mucho gusto que {{alumno}} " +
      "empiece {{programa}} con {{maestro}}.\n\nSu primera clase es el {{fecha}} a las " +
      "{{hora}}. La credencial oficial se entrega dentro de {{dias_credencial}} dias, sin " +
      "costo.\n\nNuestra mision es que te enamores de la musica.",
  },
  {
    clave: "seguimiento_prospecto",
    nombre: "Seguimiento a prospecto",
    descripcion: "Para quien pregunto y todavia no se inscribe",
    canal: "whatsapp" as const,
    cuerpo:
      "Hola {{contacto}}, le escribimos de la Academia de Musica VioliniStar por su " +
      "interes en clases para {{nombre}}.\n\n{{mensaje}}\n\nQuedamos atentos a " +
      "cualquier duda. La inscripcion es gratuita e incluye credencial oficial.",
  },
  {
    clave: "clase_muestra",
    nombre: "Confirmacion de clase muestra",
    descripcion: "La vispera de una clase muestra agendada",
    canal: "whatsapp" as const,
    cuerpo:
      "Hola {{contacto}}, confirmamos la clase muestra de {{nombre}} el {{fecha}} a las " +
      "{{hora}}, en Av. de los Venados #100, Col. Los Cipreses.\n\nSolo hace falta que " +
      "vengan con ganas; el instrumento lo ponemos nosotros.\n\nAcademia de Musica VioliniStar",
  },
];

const NIVELES = ["Inicial", "Básico", "Intermedio", "Avanzado"];

// Clausula 5a: la academia opera con dos cubiculos de ensenanza.
const AULAS = ["Cubículo 1", "Cubículo 2"];

// --- Parametros de operacion ------------------------------------------------
const CONFIG: {
  clave: string;
  valor: string;
  tipo: "texto" | "entero" | "decimal" | "booleano";
  descripcion: string;
  fuente: string;
}[] = [
  { clave: "tarifa_docente_hora_centavos", valor: "12000", tipo: "entero",
    descripcion: "Pago docente por hora impartida. Clase de 1 h = $120; de 2 h = $240.",
    fuente: "Dirección" },
  { clave: "factor_falta_sin_aviso", valor: "0.75", tipo: "decimal",
    descripcion: "Proporción que cobra el docente cuando el alumno falta sin avisar.",
    fuente: "Dirección" },
  { clave: "horas_aviso_posposicion", valor: "24", tipo: "entero",
    descripcion: "Anticipación mínima para posponer sin consumir la clase.",
    fuente: "Contrato cláusula 4ª" },
  { clave: "max_posposiciones_por_ciclo", valor: "2", tipo: "entero",
    descripcion: "Tope de posposiciones por período. La tercera se consume.",
    fuente: "Contrato cláusula 4ª" },
  { clave: "recuperacion_dentro_del_ciclo", valor: "true", tipo: "booleano",
    descripcion: "La clase pospuesta debe recuperarse dentro del mismo período.",
    fuente: "Contrato cláusula 4ª" },
  { clave: "arrastre_max_clases", valor: "0", tipo: "entero",
    descripcion: "Las clases no tomadas no se acumulan para el siguiente mes.",
    fuente: "Contrato cláusula 4ª" },
  { clave: "excepcion_requiere_motivo", valor: "true", tipo: "booleano",
    descripcion: "El director puede autorizar bajo el umbral, dejando motivo en bitácora.",
    fuente: "Dirección" },
  { clave: "anclaje_ciclo", valor: "inscripcion", tipo: "texto",
    descripcion: "El período corre desde la primera clase pagada, no del 1 al 30.",
    fuente: "Contrato cláusula 3ª" },
  { clave: "costo_inscripcion_centavos", valor: "0", tipo: "entero",
    descripcion: "La inscripción es gratuita e incluye credencial oficial.",
    fuente: "Contrato cláusula 2ª" },
  { clave: "dias_entrega_credencial", valor: "7", tipo: "entero",
    descripcion: "Días tras el alta para entregar la credencial oficial.",
    fuente: "Contrato cláusula 10ª" },
  { clave: "horas_aviso_baja", valor: "72", tipo: "entero",
    descripcion: "Anticipación para terminar el contrato. Sin derecho a devolución.",
    fuente: "Contrato cláusula 12ª" },
  { clave: "cubiculos", valor: "2", tipo: "entero",
    descripcion: "Límite de clases presenciales simultáneas.",
    fuente: "Contrato cláusula 5ª" },
  { clave: "modalidad_clase_default", valor: "presencial", tipo: "texto",
    descripcion: "La clase en línea existe como opción y no ocupa cubículo.",
    fuente: "Dirección" },
  { clave: "canal_aviso_oficial", valor: "whatsapp", tipo: "texto",
    descripcion: "Canal formal para avisar una posposición.",
    fuente: "Contrato cláusula 4ª" },
  { clave: "minutos_practica_diaria", valor: "30", tipo: "entero",
    descripcion: "Práctica diaria comprometida por el tutor.",
    fuente: "Contrato cláusula 5ª" },
  { clave: "zona_horaria", valor: "America/Mexico_City", tipo: "texto",
    descripcion: "Presentación de toda fecha y hora.", fuente: "Dirección" },
  { clave: "ia_habilitada", valor: "false", tipo: "booleano",
    descripcion: "El asistente de IA arranca apagado.", fuente: "Dirección" },

  // Datos institucionales para contratos, recibos y notas de remisión.
  { clave: "academia_nombre", valor: "Academia de Música VioliniStar", tipo: "texto",
    descripcion: "Razón comercial.", fuente: "Contrato" },
  { clave: "academia_representante", valor: "Juan Ángel Monzalvo Cervantes", tipo: "texto",
    descripcion: "Director y representante legal.", fuente: "Contrato" },
  { clave: "academia_domicilio",
    valor: "Av. de los Venados #100, Col. Los Cipreses, C.P. 42185, Fraccionamientos del Sur, Hgo.",
    tipo: "texto",
    descripcion: "Domicilio vigente. La nota de remisión trae uno anterior: corregir esa plantilla.",
    fuente: "Contrato" },
  { clave: "academia_telefono", valor: "771-773-5124", tipo: "texto",
    descripcion: "Teléfono oficial.", fuente: "Contrato" },
  { clave: "academia_rfc", valor: "MOCJ020104JW9", tipo: "texto",
    descripcion: "RFC del representante legal.", fuente: "Contrato" },
  { clave: "academia_instagram", valor: "violinistarmx", tipo: "texto",
    descripcion: "Cuenta oficial.", fuente: "Nota de remisión" },
  { clave: "academia_lema", valor: "Nuestra misión es que te enamores de la música", tipo: "texto",
    descripcion: "Lema institucional.", fuente: "Nota de remisión" },
  { clave: "recibo_prefijo_folio", valor: "VS", tipo: "texto",
    descripcion: "Prefijo del folio. El recibo NO es un comprobante fiscal digital.",
    fuente: "Dirección" },
];

// --- Roles y permisos -------------------------------------------------------
const PERMISOS = [
  ["buscar", "Usar la búsqueda global"],
  ["alumnos.leer", "Ver expedientes de alumnos"],
  ["alumnos.crear", "Dar de alta alumnos"],
  ["alumnos.editar", "Modificar alumnos"],
  // Descartar NO es dar de baja: borra por completo a un alumno que nunca
  // debió existir (de prueba, duplicado). Solo dirección, y solo si no dejó
  // rastro real — ver lib/dominio/descarte.ts.
  ["alumnos.descartar", "Descartar un alumno sin actividad real (borra su expediente)"],
  ["salud.leer", "Ver datos de salud (sensibles)"],
  ["salud.editar", "Capturar datos de salud (sensibles)"],
  ["inscripciones.leer", "Ver inscripciones y saldos"],
  ["inscripciones.crear", "Crear inscripciones"],
  ["inscripciones.baja", "Dar de baja una inscripción (cláusula 12ª)"],
  ["clases.leer", "Ver clases"],
  ["clases.crear", "Programar clases"],
  ["clases.reprogramar", "Posponer y crear recuperaciones"],
  ["clases.autorizar_excepcion", "Autorizar posposición bajo el umbral"],
  // Corregir NO es posponer: no consume posposición ni genera recuperación.
  // Es para el error de captura —hora equivocada, cubículo mal elegido—, y por
  // eso queda solo en dirección: mover una clase sin dejar rastro contractual
  // es justo lo que la cláusula 4ª pretende impedir.
  ["clases.corregir", "Corregir horario o cubículo de una clase ya programada"],
  ["asistencia.registrar", "Registrar asistencia"],
  ["planeaciones.subir", "Adjuntar planeación de clase"],
  ["planeaciones.leer_todas", "Ver planeaciones de todos los docentes"],
  ["pagos.registrar", "Registrar pagos"],
  ["finanzas.leer", "Ver finanzas de la academia"],
  ["recibos.emitir", "Emitir recibos"],
  ["nomina.leer_propia", "Ver la nómina propia"],
  ["nomina.leer", "Ver la nómina de todos los docentes"],
  ["prospectos.leer", "Ver prospectos"],
  ["prospectos.crear", "Registrar prospectos"],
  ["prospectos.editar", "Mover etapa y registrar seguimientos"],
  ["prospectos.convertir", "Convertir prospecto en alumno"],
  ["comunicacion.redactar", "Preparar mensajes"],
  ["comunicacion.aprobar", "Aprobar y enviar mensajes"],
  ["documentos.leer", "Descargar documentos del expediente"],
  ["inventario.gestionar", "Gestionar inventario y préstamos"],
  ["recitales.leer", "Ver recitales y su programa"],
  ["recitales.proponer", "Proponer alumnos para un recital"],
  ["recitales.gestionar", "Crear recitales, confirmar participaciones y vender boletos"],
  ["reportes.leer", "Consultar reportes"],
  ["usuarios.gestionar", "Dar de alta y administrar cuentas"],
  ["configuracion.gestionar", "Modificar la configuración"],
  ["bitacora.leer", "Consultar la auditoría"],
  ["respaldos.crear", "Crear respaldos"],
  ["respaldos.restaurar", "Restaurar respaldos"],
  ["ia.usar", "Usar el asistente de IA"],
] as const;

// El director tiene todo. El docente ve lo suyo y nada de dinero ajeno.
//
// `documentos.leer` es necesario: sin él, un maestro sube su planeación y no
// puede volver a abrirla. El alcance por fila ya lo limita a documentos de sus
// propias clases, así que el permiso no amplía lo que alcanza.
const PERMISOS_DOCENTE = [
  "alumnos.leer", "salud.leer", "inscripciones.leer", "clases.leer",
  "asistencia.registrar", "planeaciones.subir", "documentos.leer",
  "nomina.leer_propia",
  // El maestro sabe quién tiene una pieza lista: propone, no confirma.
  "recitales.leer", "recitales.proponer",
];

// El asistente arranca con lo operativo. El director ajusta desde configuración.
const PERMISOS_ASISTENTE = [
  "buscar", "alumnos.leer", "alumnos.crear", "alumnos.editar",
  "inscripciones.leer", "inscripciones.crear", "clases.leer", "clases.crear",
  "clases.reprogramar", "asistencia.registrar", "pagos.registrar",
  "prospectos.leer", "prospectos.crear", "prospectos.editar", "prospectos.convertir",
  "comunicacion.redactar",
  // Quien entrega el instrumento en el mostrador es quien tiene que registrarlo.
  // Sin esto, cada prestamo esperaba a que el director abriera su sesion.
  "inventario.gestionar",
  "recitales.leer", "recitales.proponer", "recitales.gestionar",
];

function sembrar() {
  db.transaction((tx) => {
    tx.insert(instrumentos).values(
      INSTRUMENTOS.map((i, orden) => ({ ...i, orden })),
    ).onConflictDoNothing().run();

    tx.insert(plantillas).values(
      PLANTILLAS.map((p, orden) => ({ ...p, orden })),
    ).onConflictDoNothing().run();

    tx.insert(niveles).values(
      NIVELES.map((nombre, orden) => ({ nombre, orden })),
    ).onConflictDoNothing().run();

    tx.insert(aulas).values(AULAS.map((nombre) => ({ nombre })))
      .onConflictDoNothing().run();

    for (const [orden, p] of PROGRAMAS.entries()) {
      const { precioCentavos, ...programa } = p;
      tx.insert(programas).values({ ...programa, orden }).onConflictDoNothing().run();

      const fila = tx.select({ id: programas.id }).from(programas)
        .where(eq(programas.clave, p.clave)).get();
      if (!fila) continue;

      const yaTiene = tx.select({ id: preciosVigencia.id }).from(preciosVigencia)
        .where(eq(preciosVigencia.programaId, fila.id)).get();
      if (!yaTiene) {
        tx.insert(preciosVigencia).values({
          programaId: fila.id, precioCentavos, vigenteDesde: HOY,
        }).run();
      }
    }

    for (const c of CONFIG) {
      tx.insert(configuracion).values(c).onConflictDoNothing().run();
    }

    tx.insert(roles).values([
      { clave: "director", nombre: "Director" },
      { clave: "docente", nombre: "Docente" },
      { clave: "asistente", nombre: "Asistente" },
    ]).onConflictDoNothing().run();

    tx.insert(permisos).values(
      PERMISOS.map(([clave, descripcion]) => ({ clave, descripcion })),
    ).onConflictDoNothing().run();

    const todosLosRoles = tx.select().from(roles).all();
    const todosLosPermisos = tx.select().from(permisos).all();

    for (const rol of todosLosRoles) {
      const claves =
        rol.clave === "director" ? PERMISOS.map(([k]) => k as string)
        : rol.clave === "docente" ? PERMISOS_DOCENTE
        : PERMISOS_ASISTENTE;

      for (const permiso of todosLosPermisos.filter((p) => claves.includes(p.clave))) {
        tx.insert(rolesPermisos).values({ rolId: rol.id, permisoId: permiso.id })
          .onConflictDoNothing().run();
      }
    }
  });
}

sembrar();

const resumen = {
  instrumentos: db.select().from(instrumentos).all().length,
  programas: db.select().from(programas).all().length,
  plantillas: db.select().from(plantillas).all().length,
  aulas: db.select().from(aulas).all().length,
  niveles: db.select().from(niveles).all().length,
  parametros: db.select().from(configuracion).all().length,
  permisos: db.select().from(permisos).all().length,
};

sqlite.close();
console.log("Semillas aplicadas:", resumen);
