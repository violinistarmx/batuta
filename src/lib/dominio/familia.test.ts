import assert from "node:assert/strict";
import test from "node:test";

import {
  ahorroFamiliarCentavos, cupoRestante, esPlanFamiliar,
  motivoParaRechazarCobertura, precioDelCicloCentavos, precioPorAlumnoCentavos,
  type SolicitudDeCobertura,
} from "./familia.ts";

test("reconoce un plan familiar", () => {
  assert.equal(esPlanFamiliar({ alumnosIncluidos: 1 }), false);
  assert.equal(esPlanFamiliar({ alumnosIncluidos: 2 }), true);
  assert.equal(esPlanFamiliar({ alumnosIncluidos: 3 }), true);
});

test("cupo de un plan familiar", () => {
  // Family Duet de 2: el titular ocupa uno, queda uno.
  assert.equal(cupoRestante(2, 0), 1);
  assert.equal(cupoRestante(2, 1), 0);
  // De 3: caben dos hermanos además del titular.
  assert.equal(cupoRestante(3, 0), 2);
  assert.equal(cupoRestante(3, 2), 0);
  // Nunca negativo, aunque los datos vengan mal.
  assert.equal(cupoRestante(2, 5), 0);
  assert.equal(cupoRestante(1, 0), 0);
});

test("precio por alumno, solo para mostrar", () => {
  // Los cuatro precios familiares dividen exacto; es casualidad útil, no una regla.
  assert.equal(precioPorAlumnoCentavos(145_000, 2), 72_500);
  assert.equal(precioPorAlumnoCentavos(210_000, 3), 70_000);
  assert.equal(precioPorAlumnoCentavos(280_000, 2), 140_000);
  assert.equal(precioPorAlumnoCentavos(409_500, 3), 136_500);
  // Y si algún día no divide, redondea sin perder centavos en el aire.
  assert.equal(precioPorAlumnoCentavos(100_001, 3), 33_334);
  assert.equal(precioPorAlumnoCentavos(75_000, 1), 75_000);
});

test("ahorro frente a inscripciones sueltas", () => {
  assert.equal(ahorroFamiliarCentavos(145_000, 75_000, 2), 5_000);
  assert.equal(ahorroFamiliarCentavos(210_000, 75_000, 3), 15_000);
  assert.equal(ahorroFamiliarCentavos(280_000, 150_000, 2), 20_000);
  assert.equal(ahorroFamiliarCentavos(409_500, 150_000, 3), 40_500);
});

const base: SolicitudDeCobertura = {
  programaIdTitular: 5,
  programaIdNuevo: 5,
  alumnosIncluidos: 2,
  cubiertasActuales: 0,
  titularYaEstaCubierto: false,
  titularActivo: true,
  compartenTutor: true,
  mismoAlumno: false,
};

test("acepta al hermano que cumple todo", () => {
  assert.equal(motivoParaRechazarCobertura(base), null);
});

test("rechaza cobertura sobre un programa individual", () => {
  const m = motivoParaRechazarCobertura({ ...base, alumnosIncluidos: 1 });
  assert.match(m ?? "", /individual/i);
});

test("rechaza mezclar programas distintos", () => {
  const m = motivoParaRechazarCobertura({ ...base, programaIdNuevo: 6 });
  assert.match(m ?? "", /mismo programa/i);
});

test("rechaza colgarse de una inscripción que ya está cubierta", () => {
  const m = motivoParaRechazarCobertura({ ...base, titularYaEstaCubierto: true });
  assert.match(m ?? "", /titular/i);
});

test("rechaza un plan ya lleno", () => {
  const m = motivoParaRechazarCobertura({ ...base, cubiertasActuales: 1 });
  assert.match(m ?? "", /2 alumnos/);
  // El de tres todavía acepta uno más en ese mismo punto.
  assert.equal(
    motivoParaRechazarCobertura({ ...base, alumnosIncluidos: 3, cubiertasActuales: 1 }),
    null,
  );
});

test("exige tutor en común: nadie se cuelga de un plan ajeno", () => {
  const m = motivoParaRechazarCobertura({ ...base, compartenTutor: false });
  assert.match(m ?? "", /tutor en común/i);
});

test("un alumno no ocupa dos lugares del mismo plan", () => {
  const m = motivoParaRechazarCobertura({ ...base, mismoAlumno: true });
  assert.match(m ?? "", /dos lugares/i);
});

test("rechaza un plan inactivo", () => {
  const m = motivoParaRechazarCobertura({ ...base, titularActivo: false });
  assert.match(m ?? "", /no está activo/i);
});

test("la inscripción cubierta abre su ciclo en cero", () => {
  assert.equal(precioDelCicloCentavos(145_000, false), 145_000);
  assert.equal(precioDelCicloCentavos(145_000, true), 0);
});
