/**
 * Qué se puede tocar de la configuración, y con qué cuidado.
 *
 * Todo lo que la academia decide —cuántas horas de aviso, cuánto se le paga al
 * maestro, cuántos cubículos hay— vive en la base y no en el código, que es lo
 * que permite cambiarlo sin programar. Pero «editable» no significa «todos
 * iguales»: una cláusula del contrato es un acuerdo firmado con los tutores, y
 * la zona horaria no es una decisión de negocio sino el eje sobre el que están
 * fechadas todas las clases ya registradas.
 */

export type Tipo = "texto" | "entero" | "decimal" | "booleano";

export type Parametro = {
  clave: string;
  valor: string;
  tipo: Tipo;
  descripcion: string;
  fuente: string | null;
  actualizadoEn: Date;
};

export type Grupo = "contrato" | "direccion" | "institucional";

export const NOMBRE_GRUPO: Record<Grupo, string> = {
  contrato: "Reglas del contrato",
  direccion: "Decisiones de dirección",
  institucional: "Datos de la academia",
};

export const EXPLICACION_GRUPO: Record<Grupo, string> = {
  contrato:
    "Vienen del contrato que firman los tutores. Cambiarlos aquí cambia lo que el " +
    "sistema aplica de hoy en adelante, no lo que alguien firmó: si la regla cambia " +
    "de verdad, el contrato tiene que cambiar también.",
  direccion:
    "Decisiones internas. Se pueden ajustar cuando haga falta; lo ya registrado no " +
    "se recalcula solo.",
  institucional:
    "Lo que aparece impreso en recibos, notas de remisión y credenciales.",
};

export function grupoDe(p: { clave: string; fuente: string | null }): Grupo {
  if (p.clave.startsWith("academia_") || p.clave.startsWith("recibo_")) return "institucional";
  if ((p.fuente ?? "").toLowerCase().startsWith("contrato")) return "contrato";
  return "direccion";
}

/**
 * Parámetros que la pantalla muestra pero no deja editar, y por qué.
 *
 * No es paternalismo: son los que no se pueden deshacer mirando la pantalla.
 * Cambiar la zona horaria recorre seis horas todas las clases ya fechadas, y
 * cambiar el prefijo del folio parte la numeración de los recibos en dos series
 * que después nadie puede reconciliar.
 */
export const CANDADOS: Record<string, string> = {
  zona_horaria:
    "Toda clase, todo pago y todo corte de nómina ya registrado está fechado con " +
    "esta zona. Cambiarla los movería de día sin avisar.",
  recibo_prefijo_folio:
    "Los folios ya emitidos llevan este prefijo. Cambiarlo dejaría dos series de " +
    "recibos que después no se pueden reconciliar.",
  ia_habilitada:
    "Todavía no hay ningún asistente conectado. Se enciende cuando exista, no antes.",
};

export function esEditable(clave: string): boolean {
  return !(clave in CANDADOS);
}

/** Valores cerrados: se eligen de una lista, no se escriben. */
export const OPCIONES: Record<string, { valor: string; texto: string }[]> = {
  anclaje_ciclo: [
    { valor: "inscripcion", texto: "Desde la primera clase pagada" },
    { valor: "mes_natural", texto: "Del día 1 al último del mes" },
  ],
  modalidad_clase_default: [
    { valor: "presencial", texto: "Presencial" },
    { valor: "en_linea", texto: "En línea" },
  ],
  canal_aviso_oficial: [
    { valor: "whatsapp", texto: "WhatsApp" },
    { valor: "telefono", texto: "Llamada telefónica" },
    { valor: "correo", texto: "Correo electrónico" },
  ],
};

/** Los que se capturan en pesos aunque se guarden en centavos. */
export function esDinero(clave: string): boolean {
  return clave.endsWith("_centavos");
}

export type Validacion = { ok: true; valor: string } | { ok: false; error: string };

/**
 * Valida y normaliza un valor según su tipo.
 *
 * El dinero entra en pesos y sale en centavos, como en todo el sistema: pedirle
 * a alguien que escriba «12000» para decir ciento veinte pesos es pedirle que se
 * equivoque en un factor de cien tarde o temprano.
 */
export function validarValor(clave: string, tipo: Tipo, crudo: string): Validacion {
  const v = crudo.trim();

  if (clave in OPCIONES) {
    return OPCIONES[clave]!.some((o) => o.valor === v)
      ? { ok: true, valor: v }
      : { ok: false, error: "Elige una de las opciones." };
  }

  switch (tipo) {
    case "booleano":
      if (v !== "true" && v !== "false") return { ok: false, error: "Tiene que ser sí o no." };
      return { ok: true, valor: v };

    case "entero": {
      if (esDinero(clave)) {
        const pesos = Number(v);
        if (!Number.isFinite(pesos) || pesos < 0) {
          return { ok: false, error: "Escribe un importe válido, en pesos." };
        }
        return { ok: true, valor: String(Math.round(pesos * 100)) };
      }
      if (!/^\d+$/.test(v)) return { ok: false, error: "Tiene que ser un número entero, sin decimales." };
      return { ok: true, valor: String(Number(v)) };
    }

    case "decimal": {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Tiene que ser un número." };
      return { ok: true, valor: String(n) };
    }

    case "texto":
      if (v === "") return { ok: false, error: "No puede quedar vacío." };
      if (v.length > 300) return { ok: false, error: "Demasiado largo." };
      return { ok: true, valor: v };
  }
}

/**
 * Advertencias que se muestran ANTES de guardar, no después.
 *
 * Ninguna impide el cambio: el director manda. Lo que no puede pasar es que
 * descubra la consecuencia cuando ya está hecha.
 */
export function advertencias(clave: string, antes: string, despues: string): string[] {
  const avisos: string[] = [];
  if (antes === despues) return avisos;

  if (clave === "tarifa_docente_hora_centavos") {
    avisos.push(
      "Los cortes de nómina ya calculados se quedan con la tarifa que tenían. " +
      "Esta aplica a lo que se calcule de aquí en adelante.",
    );
  }
  if (clave === "cubiculos" && Number(despues) < Number(antes)) {
    avisos.push(
      "Bajar el número de cubículos no cancela las clases ya programadas: las que " +
      "hoy se encimarían siguen en la agenda hasta que alguien las mueva.",
    );
  }
  if (clave === "costo_inscripcion_centavos" && Number(despues) > 0) {
    avisos.push(
      "El contrato dice que la inscripción es gratuita (cláusula 2ª). Cobrarla " +
      "obliga a cambiar el contrato antes que el sistema.",
    );
  }
  if (clave === "horas_aviso_posposicion" || clave === "max_posposiciones_por_ciclo"
      || clave === "arrastre_max_clases" || clave === "horas_aviso_baja") {
    avisos.push(
      "Es una regla del contrato firmado. El sistema la aplicará desde ahora; los " +
      "tutores siguen teniendo en la mano el texto anterior.",
    );
  }
  return avisos;
}
