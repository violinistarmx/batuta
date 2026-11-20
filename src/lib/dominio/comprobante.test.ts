import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparClases, clasesDelFormulario, contactoDelComprobante, descripcionDelComprobante, fechaCorta, horaCorta, lineaDeClase,
  lineasDeClases, periodoLegible, serializarClases, textoComprobanteWhatsApp,
} from "./comprobante.ts";

test("fechaCorta y periodoLegible usan el formato de la plantilla", () => {
  assert.equal(fechaCorta("2026-11-21"), "21 nov 2026");
  assert.equal(periodoLegible("2026-11-20 al 2026-12-19"), "20 nov 2026 al 19 dic 2026");
  assert.equal(periodoLegible("octubre completo"), "octubre completo");
});

test("horaCorta pasa a am/pm", () => {
  assert.equal(horaCorta("11:00"), "11:00 am");
  assert.equal(horaCorta("13:00"), "1:00 pm");
  assert.equal(horaCorta("00:30"), "12:30 am");
  assert.equal(horaCorta("12:00"), "12:00 pm");
});

test("lineaDeClase reproduce el ejemplo de la plantilla", () => {
  assert.equal(lineaDeClase("2026-11-21", "11:00", "13:00"), "Sábado 21 de noviembre 11:00 am a 1:00 pm");
  assert.equal(lineaDeClase("2026-11-26", "18:00", "20:00"), "Jueves 26 de noviembre 6:00 pm a 8:00 pm");
});

test("lineasDeClases ignora renglones vacíos", () => {
  assert.deepEqual(lineasDeClases(" A \r\n\n  B  \n"), ["A", "B"]);
  assert.deepEqual(lineasDeClases(null), []);
});

const alumno = { nombre: "Ana Victoria", telefono: "7710000000", direccion: "Calle 1" };
const mama = { nombre: "Laura", telefono: "7711111111", whatsapp: "7712222222", direccion: null, esResponsablePago: true };

test("un adulto va con sus propios datos", () => {
  assert.deepEqual(contactoDelComprobante(alumno, [mama], true),
    { direccion: "Calle 1", telefono: "7710000000", tutor: null });
});

test("un menor va con el contacto del tutor responsable", () => {
  const c = contactoDelComprobante(alumno, [mama], false);
  assert.equal(c.telefono, "7712222222");
  assert.equal(c.tutor, "Laura");
  assert.equal(c.direccion, "Calle 1"); // el tutor no tiene dirección: la del alumno
});

test("un menor sin tutor usa los datos del alumno", () => {
  assert.deepEqual(contactoDelComprobante(alumno, [], false),
    { direccion: "Calle 1", telefono: "7710000000", tutor: null });
});

test("prefiere al tutor responsable de pago", () => {
  const otro = { ...mama, nombre: "Otro", esResponsablePago: false };
  assert.equal(contactoDelComprobante(alumno, [otro, mama], false).tutor, "Laura");
});

test("la descripción: lo escrito, la frase de la plantilla o nada", () => {
  assert.equal(descripcionDelComprobante(" Mensualidad ", ["x"]), "Mensualidad");
  assert.match(descripcionDelComprobante(null, ["x"]) ?? "", /siguientes fechas y horarios/);
  assert.equal(descripcionDelComprobante(null, []), null);
});

test("el mensaje de WhatsApp al tutor nombra al alumno; al adulto no", () => {
  const base = { saludo: "Sra. Laura", alumno: "Ana Victoria", folio: "VS-2026-0001", total: "$1,450.00" };
  const tutor = textoComprobanteWhatsApp({ ...base, paraTutor: true });
  assert.match(tutor, /Hola, Sra\. Laura/);
  assert.match(tutor, /VS-2026-0001 por \$1,450\.00 de Ana Victoria\./);
  const adulto = textoComprobanteWhatsApp({ ...base, saludo: "Ana", paraTutor: false });
  assert.doesNotMatch(adulto, / de Ana Victoria/);
});

test("el mensaje de WhatsApp incluye el enlace al PDF cuando lo hay", () => {
  const base = { saludo: "Laura", alumno: "Ana", paraTutor: true, folio: "VS-1", total: "$1.00" };
  assert.match(textoComprobanteWhatsApp({ ...base, enlace: "https://x.mx/comprobante/abc" }), /PDF aquí: https:\/\/x\.mx\/comprobante\/abc/);
  assert.doesNotMatch(textoComprobanteWhatsApp(base), /PDF aquí/);
});

test("agruparClases: un plan familiar separa las clases por alumno", () => {
  const g = agruparClases("# Ana María\nSáb 1\nSáb 8\n# Ana Victoria\nDom 2\n\n# Gael\nLun 3\nLun 10\nLun 17");
  assert.deepEqual(g.map((x) => [x.alumno, x.clases.length]), [["Ana María", 2], ["Ana Victoria", 1], ["Gael", 3]]);
});

test("agruparClases: sin marcas son clases sueltas de un grupo sin nombre (pagos anteriores)", () => {
  assert.deepEqual(agruparClases("Sáb 1\nSáb 8"), [{ alumno: null, clases: ["Sáb 1", "Sáb 8"] }]);
  assert.deepEqual(agruparClases(null), []);
});

test("agruparClases ignora grupos sin clases", () => {
  assert.deepEqual(agruparClases("# Ana\n# Gael\nLun 3"), [{ alumno: "Gael", clases: ["Lun 3"] }]);
});

test("serializarClases y agruparClases son inversas", () => {
  const grupos = [{ alumno: "Ana", clases: ["A", "B"] }, { alumno: "Gael", clases: ["C"] }];
  assert.deepEqual(agruparClases(serializarClases(grupos)), grupos);
  assert.equal(serializarClases([{ alumno: "Ana", clases: [" "] }]), null);
});

test("clasesDelFormulario: un campo por alumno en planes familiares, texto libre si no", () => {
  assert.equal(clasesDelFormulario(["Ana", "Gael"], ["A\nB", "C"], ""), "# Ana\nA\nB\n# Gael\nC");
  assert.equal(clasesDelFormulario([], [], " X \n Y"), "X\nY");
  assert.equal(clasesDelFormulario(["Ana", "Gael"], ["", ""], ""), null);
});
