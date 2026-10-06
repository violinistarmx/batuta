/**
 * Cómo se lee la bitácora.
 *
 * La tabla guarda claves («clase.autorizar_excepcion») y un JSON con el antes y
 * el después. Eso es lo correcto para consultar y lo peor posible para leer. Aquí
 * se traduce a español, porque una auditoría que nadie entiende no audita nada:
 * la única pregunta que importa es «¿quién hizo esto y cuándo?», y tiene que
 * poder responderla el director, no un programador.
 */

export type Grupo =
  | "acceso" | "cuentas" | "alumnos" | "clases" | "dinero"
  | "comunicacion" | "inventario" | "recitales" | "sistema";

export const NOMBRE_GRUPO: Record<Grupo, string> = {
  acceso: "Accesos",
  cuentas: "Cuentas",
  alumnos: "Alumnos y expedientes",
  clases: "Clases y asistencia",
  dinero: "Dinero",
  comunicacion: "Mensajes",
  inventario: "Inventario",
  recitales: "Recitales",
  sistema: "Sistema",
};

type Descripcion = { texto: string; grupo: Grupo; delicado?: boolean };

/**
 * `delicado` marca lo que se revisa con otros ojos: datos de salud de menores,
 * dinero que se modificó después de registrado, expedientes descargados,
 * respaldos restaurados. No es que esté mal; es que hay que poder encontrarlo.
 */
const ACCIONES: Record<string, Descripcion> = {
  "sesion.iniciar": { texto: "Entró al sistema", grupo: "acceso" },
  "sesion.cerrar": { texto: "Salió del sistema", grupo: "acceso" },
  "sesion.rechazada": { texto: "Intento de acceso rechazado", grupo: "acceso", delicado: true },
  "sesion.revocar": { texto: "Cerró una sesión ajena", grupo: "acceso" },

  "usuario.crear": { texto: "Dio de alta una cuenta", grupo: "cuentas" },
  "usuario.editar": { texto: "Modificó una cuenta", grupo: "cuentas" },
  "usuario.desactivar": { texto: "Desactivó una cuenta", grupo: "cuentas", delicado: true },

  "alumno.crear": { texto: "Dio de alta un alumno", grupo: "alumnos" },
  "alumno.editar": { texto: "Modificó un expediente", grupo: "alumnos" },
  "alumno.eliminar": { texto: "Eliminó un alumno", grupo: "alumnos", delicado: true },
  "alumno.consultar_qr": { texto: "Consultó un alumno por su QR", grupo: "alumnos" },
  "salud.leer": { texto: "Abrió datos de salud", grupo: "alumnos", delicado: true },
  "salud.editar": { texto: "Capturó datos de salud", grupo: "alumnos", delicado: true },
  "documento.subir": { texto: "Adjuntó un documento", grupo: "alumnos" },
  "documento.descargar": { texto: "Descargó un documento", grupo: "alumnos", delicado: true },
  "documento.eliminar": { texto: "Eliminó un documento", grupo: "alumnos", delicado: true },

  "inscripcion.crear": { texto: "Inscribió a un alumno", grupo: "alumnos" },
  "inscripcion.cambiar_programa": { texto: "Cambió de programa", grupo: "alumnos" },
  "inscripcion.baja": { texto: "Dio de baja una inscripción", grupo: "alumnos", delicado: true },
  "ciclo.renovar": { texto: "Renovó el período", grupo: "alumnos" },
  "ciclo.cerrar": { texto: "Cerró el período", grupo: "alumnos" },

  "clase.crear": { texto: "Programó una clase", grupo: "clases" },
  "clase.asistencia": { texto: "Registró asistencia", grupo: "clases" },
  "clase.reprogramar": { texto: "Pospuso o recuperó una clase", grupo: "clases" },
  "clase.autorizar_excepcion": {
    texto: "Autorizó una posposición fuera de plazo", grupo: "clases", delicado: true,
  },

  "pago.registrar": { texto: "Registró un pago", grupo: "dinero" },
  "pago.modificar": { texto: "Modificó un pago ya registrado", grupo: "dinero", delicado: true },
  "pago.editar": { texto: "Editó un pago registrado", grupo: "dinero", delicado: true },
  "cargo.generar": { texto: "Generó cargos", grupo: "dinero" },
  "cargo.editar": { texto: "Editó un cargo", grupo: "dinero", delicado: true },
  "cargo.cancelar": { texto: "Canceló un cargo", grupo: "dinero", delicado: true },
  "nomina.calcular": { texto: "Calculó un corte de nómina", grupo: "dinero" },
  "nomina.pagar": { texto: "Marcó un corte como pagado", grupo: "dinero" },
  "recibo.emitir": { texto: "Emitió un recibo", grupo: "dinero" },
  "recibo.imprimir": { texto: "Imprimió un recibo", grupo: "dinero" },

  "prospecto.crear": { texto: "Registró un prospecto", grupo: "comunicacion" },
  "prospecto.seguimiento": { texto: "Dejó un seguimiento", grupo: "comunicacion" },
  "prospecto.etapa": { texto: "Movió un prospecto de etapa", grupo: "comunicacion" },
  "prospecto.convertir": { texto: "Convirtió un prospecto en alumno", grupo: "comunicacion" },
  "mensaje.redactar": { texto: "Preparó un mensaje", grupo: "comunicacion" },
  "mensaje.aprobar": { texto: "Aprobó un mensaje", grupo: "comunicacion" },
  "mensaje.rechazar": { texto: "Rechazó un mensaje", grupo: "comunicacion" },
  "mensaje.enviar": { texto: "Envió un mensaje", grupo: "comunicacion" },

  "inventario.alta": { texto: "Dio de alta un ejemplar", grupo: "inventario" },
  "inventario.prestar": { texto: "Prestó un instrumento", grupo: "inventario" },
  "inventario.devolver": { texto: "Recibió una devolución", grupo: "inventario" },

  "recital.crear": { texto: "Creó un recital", grupo: "recitales" },
  "recital.estado": { texto: "Cambió el estado de un recital", grupo: "recitales" },
  "recital.proponer": { texto: "Propuso a un alumno", grupo: "recitales" },
  "recital.confirmar": { texto: "Confirmó una participación", grupo: "recitales" },
  "recital.rechazar": { texto: "Devolvió una propuesta", grupo: "recitales" },
  "recital.vender": { texto: "Vendió boletos", grupo: "recitales" },

  "permisos.modificar": { texto: "Modificó permisos", grupo: "sistema", delicado: true },
  "configuracion.modificar": { texto: "Cambió la configuración", grupo: "sistema", delicado: true },
  "respaldo.crear": { texto: "Creó un respaldo", grupo: "sistema" },
  "respaldo.restaurar": { texto: "Restauró un respaldo", grupo: "sistema", delicado: true },
};

export function describir(accion: string): Descripcion {
  return ACCIONES[accion] ?? { texto: accion, grupo: "sistema" };
}

/** Todas las acciones conocidas, agrupadas, para armar el filtro. */
export function accionesPorGrupo(): { grupo: Grupo; acciones: { clave: string; texto: string }[] }[] {
  const mapa = new Map<Grupo, { clave: string; texto: string }[]>();
  for (const [clave, d] of Object.entries(ACCIONES)) {
    const lista = mapa.get(d.grupo) ?? [];
    lista.push({ clave, texto: d.texto });
    mapa.set(d.grupo, lista);
  }
  return (Object.keys(NOMBRE_GRUPO) as Grupo[])
    .filter((g) => mapa.has(g))
    .map((grupo) => ({ grupo, acciones: mapa.get(grupo)! }));
}

/** Los campos que no se muestran aunque estén: son ruido o son secretos. */
const OCULTOS = new Set(["hashPassword", "qrToken", "password"]);

const ETIQUETA: Record<string, string> = {
  nombre: "Nombre", email: "Correo", rol: "Rol", activo: "Activa",
  passwordCambiada: "Cambió su contraseña", passwordRestablecida: "Contraseña restablecida",
  sesionesCerradas: "Se le cerraron las sesiones", motivo: "Motivo",
  codigo: "Folio", programaId: "Programa", montoCentavos: "Importe",
  docenteId: "Maestro", instrumentoId: "Instrumento",
};

function valor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * El JSON de cambios convertido en líneas legibles.
 *
 * `{ rol: ["docente","asistente"] }` se lee «Rol: docente → asistente», y un
 * valor suelto se muestra tal cual. Nunca sale un hash ni un token, aunque
 * alguien los hubiera guardado ahí por descuido.
 */
export function resumirCambios(json: string | null): { campo: string; detalle: string }[] {
  if (!json) return [];
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    return [{ campo: "Cambios", detalle: json }];
  }
  if (typeof datos !== "object" || datos === null) return [];

  return Object.entries(datos as Record<string, unknown>)
    .filter(([campo]) => !OCULTOS.has(campo))
    .map(([campo, v]) => ({
      campo: ETIQUETA[campo] ?? campo,
      detalle: Array.isArray(v) && v.length === 2
        ? `${valor(v[0])} → ${valor(v[1])}`
        : valor(v),
    }));
}
