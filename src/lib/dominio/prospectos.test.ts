import assert from "node:assert/strict";
import test from "node:test";

import {
  abiertosEn, diasEntre, embudoVacio, estaAbierto, estadoDeSeguimiento,
  motivoParaRechazarTransicion, ordenarOrigenes, siguienteAccion,
  tasaConversion, transicionValida, type Etapa, type Prospecto,
} from "./prospectos.ts";

const HOY = "2026-09-18";

test("etapas abiertas y cerradas", () => {
  assert.equal(estaAbierto("nuevo"), true);
  assert.equal(estaAbierto("en_negociacion"), true);
  assert.equal(estaAbierto("convertido"), false);
  assert.equal(estaAbierto("perdido"), false);
});

test("no se convierte a alguien con quien nadie habló", () => {
  assert.equal(transicionValida("nuevo", "convertido"), false);
  assert.match(motivoParaRechazarTransicion("nuevo", "convertido") ?? "", /embudo no mide/i);
  assert.equal(transicionValida("contactado", "convertido"), true);
  assert.equal(transicionValida("clase_muestra", "convertido"), true);
});

test("un alumno no vuelve a ser prospecto", () => {
  for (const e of ["nuevo", "contactado", "perdido", "en_negociacion"] as Etapa[]) {
    assert.equal(transicionValida("convertido", e), false, `convertido → ${e}`);
  }
  assert.match(motivoParaRechazarTransicion("convertido", "perdido") ?? "", /ya es alumno/i);
});

test("nadie vuelve a ser nuevo", () => {
  assert.equal(transicionValida("contactado", "nuevo"), false);
  assert.match(motivoParaRechazarTransicion("contactado", "nuevo") ?? "", /no vuelve a ser nuevo/i);
});

test("retroceder sí se permite: la realidad no avanza en línea recta", () => {
  assert.equal(transicionValida("en_negociacion", "contactado"), true);
  assert.equal(transicionValida("clase_muestra", "contactado"), true);
});

test("un perdido se reactiva antes de convertirse", () => {
  assert.equal(transicionValida("perdido", "convertido"), false);
  assert.match(motivoParaRechazarTransicion("perdido", "convertido") ?? "", /reactívalo/i);
  assert.equal(transicionValida("perdido", "contactado"), true);
});

test("quedarse en la misma etapa siempre es válido", () => {
  for (const e of ["nuevo", "contactado", "convertido", "perdido"] as Etapa[]) {
    assert.equal(transicionValida(e, e), true);
    assert.equal(motivoParaRechazarTransicion(e, e), null);
  }
});

test("días entre fechas civiles", () => {
  assert.equal(diasEntre("2026-09-18", "2026-09-18"), 0);
  assert.equal(diasEntre("2026-09-15", "2026-09-18"), 3);
  assert.equal(diasEntre("2026-01-31", "2026-02-01"), 1);
});

test("estado del seguimiento, con «sin agendar» como estado propio", () => {
  assert.equal(estadoDeSeguimiento(null, HOY), "sin_agendar");
  assert.equal(estadoDeSeguimiento("2026-09-15", HOY), "vencido");
  assert.equal(estadoDeSeguimiento("2026-09-18", HOY), "hoy");
  assert.equal(estadoDeSeguimiento("2026-09-25", HOY), "programado");
});

test("la tasa de conversión ignora a los que siguen en juego", () => {
  const e = embudoVacio();
  e.convertido = 3; e.perdido = 1; e.nuevo = 20;
  // 3 de 4 cerrados, no 3 de 24: veinte mensajes de ayer no son un fracaso.
  assert.equal(tasaConversion(e), 75);
});

test("sin nada cerrado la tasa es null, no cero", () => {
  const e = embudoVacio();
  e.nuevo = 5; e.contactado = 2;
  assert.equal(tasaConversion(e), null);
  assert.equal(abiertosEn(e), 7);
});

const base: Prospecto = {
  estado: "contactado",
  proximoSeguimientoEl: null,
  claseMuestraEl: null,
  claseMuestraAsistio: null,
  ultimoContactoEl: null,
};

test("la siguiente acción dice qué hacer, no en qué estado está", () => {
  assert.match(siguienteAccion({ ...base, estado: "nuevo" }, HOY), /escríbele y agenda/i);
  assert.match(siguienteAccion(base, HOY), /se enfría/i);
  assert.match(
    siguienteAccion({ ...base, proximoSeguimientoEl: "2026-09-15" }, HOY),
    /atrasado 3 días/i,
  );
  assert.match(siguienteAccion({ ...base, proximoSeguimientoEl: HOY }, HOY), /hoy/i);
  assert.match(
    siguienteAccion({ ...base, proximoSeguimientoEl: "2026-09-30" }, HOY),
    /2026-09-30/,
  );
});

test("la clase muestra manda sobre el seguimiento", () => {
  const conMuestra = { ...base, estado: "clase_muestra" as Etapa, proximoSeguimientoEl: "2026-09-15" };
  assert.match(
    siguienteAccion({ ...conMuestra, claseMuestraEl: "2026-09-25" }, HOY),
    /confirma un día antes/i,
  );
  assert.match(siguienteAccion({ ...conMuestra, claseMuestraEl: HOY }, HOY), /muestra hoy/i);
  assert.match(
    siguienteAccion({ ...conMuestra, claseMuestraEl: "2026-09-10" }, HOY),
    /registra si asistió/i,
  );
  assert.match(
    siguienteAccion({ ...conMuestra, claseMuestraEl: "2026-09-10", claseMuestraAsistio: true }, HOY),
    /ofrece la inscripción/i,
  );
  assert.match(
    siguienteAccion({ ...conMuestra, claseMuestraEl: "2026-09-10", claseMuestraAsistio: false }, HOY),
    /reagendar/i,
  );
});

test("los cerrados no piden acción", () => {
  assert.match(siguienteAccion({ ...base, estado: "convertido" }, HOY), /ya es alumno/i);
  assert.match(siguienteAccion({ ...base, estado: "perdido" }, HOY), /reactívalo/i);
});

test("los orígenes se ordenan por alumnos conseguidos, no por volumen", () => {
  const r = ordenarOrigenes([
    { origen: "instagram", total: 100, convertidos: 2 },
    { origen: "recomendacion", total: 10, convertidos: 5 },
    { origen: "google", total: 4, convertidos: 2 },
  ]);
  assert.deepEqual(r.map((x) => x.origen), ["recomendacion", "google", "instagram"]);
  // Con los mismos convertidos, gana la mejor tasa: google 50 % sobre instagram 2 %.
  assert.equal(r[1]?.origen, "google");
  assert.equal(r[0]?.tasa, 50);
});

test("un origen sin prospectos no divide entre cero", () => {
  const r = ordenarOrigenes([{ origen: "evento", total: 0, convertidos: 0 }]);
  assert.equal(r[0]?.tasa, null);
});
