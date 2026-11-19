import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { configuracion, recibos } from "@/db/schema/index";
import { tutoresDe } from "@/lib/datos/alumnos";
import { reciboPorId, renglonesDeRecibo } from "@/lib/datos/finanzas";
import {
  contactoDelComprobante, descripcionDelComprobante, lineasDeClases,
} from "@/lib/dominio/comprobante";
import { esMenorDeEdad } from "@/lib/formato";
import { fechaCivil } from "@/lib/zona";

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const METODOS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia",
  tarjeta: "Tarjeta", deposito: "Depósito", otro: "Otro",
};

/**
 * Todo lo que el comprobante necesita, armado una sola vez para las dos caras del mismo
 * documento: la pantalla (`/recibos/[id]`) y el PDF del enlace privado (`/comprobante/[token]`).
 * Los datos de quien paga salen de la cuenta del alumno; si es menor, del tutor responsable.
 */
export function armarComprobante(reciboId: number) {
  const r = reciboPorId(reciboId);
  if (!r) return null;

  const renglones = renglonesDeRecibo(r.pagoId);
  const cfg = Object.fromEntries(
    db.select().from(configuracion).all().map((c) => [c.clave, c.valor]),
  );

  const [anio = 0, mes = 1, dia = 1] = r.recibidoEl.split("-").map(Number);
  // La emisión es su propio instante: puede caer un día después del pago cuando el recibo se
  // captura tarde, y el documento no debe disimularlo.
  const [ae = 0, me = 1, de = 1] = fechaCivil(r.emitidoEn).split("-").map(Number);
  const aplicado = renglones.reduce((s, x) => s + x.montoAplicado, 0);
  // El dinero real que entró: lo que pagó el alumno menos la condonación.
  const totalReal = r.montoCentavos - r.descuentoCentavos;
  // El saldo a favor refleja solo el dinero real no aplicado a ningún cargo.
  const aFavor = Math.max(0, totalReal - Math.max(0, aplicado - r.descuentoCentavos));

  // Adulto solo si consta que tiene 18 o más (sin fecha se trata como menor, como en los recordatorios).
  const esAdulto = !!r.alumnoNacimiento && !esMenorDeEdad(r.alumnoNacimiento);
  const tutoresDelAlumno = tutoresDe(r.alumnoId);
  const contacto = contactoDelComprobante(
    { nombre: r.alumno, telefono: r.alumnoTelefono, direccion: r.alumnoDireccion },
    esAdulto ? [] : tutoresDelAlumno,
    esAdulto,
  );

  const clasesLista = lineasDeClases(r.clasesTexto);
  const banco = {
    nombre: cfg.recibo_banco_nombre, titular: cfg.recibo_banco_titular, cuenta: cfg.recibo_banco_cuenta,
    clabe: cfg.recibo_banco_clabe, tarjeta: cfg.recibo_banco_tarjeta,
  };

  return {
    r, renglones, cfg,
    fechaPago: { anio, mes, dia },
    emision: { anio: ae, mes: me, dia: de },
    totalReal, aFavor, esAdulto, tutoresDelAlumno, contacto,
    clasesLista,
    descripcionPago: descripcionDelComprobante(r.descripcion, clasesLista),
    banco,
    hayBanco: Boolean(banco.cuenta || banco.clabe || banco.tarjeta),
    instagram: cfg.academia_instagram ? `@${cfg.academia_instagram.replace(/^@/, "")}` : "",
  };
}

export type Comprobante = NonNullable<ReturnType<typeof armarComprobante>>;

/**
 * El token del enlace privado de un recibo; lo crea la primera vez. 256 bits aleatorios: no se
 * puede adivinar ni recorrer. Compartirlo equivale a entregar el comprobante.
 */
export function tokenDeRecibo(reciboId: number): string | null {
  const fila = db.select({ token: recibos.token }).from(recibos).where(eq(recibos.id, reciboId)).get();
  if (!fila) return null;
  if (fila.token) return fila.token;
  const token = randomBytes(32).toString("hex");
  // Solo si sigue vacío: dos pantallas abiertas a la vez no deben pisarse el enlace ya compartido.
  db.update(recibos).set({ token }).where(and(eq(recibos.id, reciboId), isNull(recibos.token))).run();
  const guardado = db.select({ token: recibos.token }).from(recibos).where(eq(recibos.id, reciboId)).get();
  return guardado?.token ?? null;
}

/** El recibo al que apunta un token, o null. Solo acepta el formato exacto del token. */
export function reciboIdDeToken(token: string): number | null {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const fila = db.select({ id: recibos.id }).from(recibos).where(eq(recibos.token, token)).get();
  return fila?.id ?? null;
}
