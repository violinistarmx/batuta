import assert from "node:assert/strict";
import test from "node:test";

import {
  diasEntre, estadoDeDevolucion, estadoTrasDevolucion, formatearCodigoInventario,
  motivoParaRechazarDevolucion, motivoParaRechazarPrestamo, resumir,
  type Condicion, type EstadoEjemplar, type SolicitudDePrestamo,
} from "./inventario.ts";

const HOY = "2026-09-19";

const base: SolicitudDePrestamo = {
  granFormato: false,
  programaAutoriza: true,
  estadoEjemplar: "disponible",
  condicionEjemplar: "bueno",
  tienePeriodoAbierto: true,
  inscripcionActiva: true,
  yaTienePrestadoEsteInstrumento: false,
};

test("presta cuando se cumple todo", () => {
  assert.equal(motivoParaRechazarPrestamo(base), null);
});

test("el gran formato no sale, aunque el programa lo autorice", () => {
  const m = motivoParaRechazarPrestamo({ ...base, granFormato: true });
  assert.match(m ?? "", /gran formato/i);
  assert.match(m ?? "", /9ª/);
});

test("el gran formato manda sobre cualquier otra objeción", () => {
  // Un piano dañado y prestado sigue siendo, ante todo, un piano.
  const m = motivoParaRechazarPrestamo({
    ...base, granFormato: true, estadoEjemplar: "prestado", condicionEjemplar: "dañado",
  });
  assert.match(m ?? "", /gran formato/i);
});

test("solo Allegro Virtuoso autoriza llevárselo a casa", () => {
  const m = motivoParaRechazarPrestamo({ ...base, programaAutoriza: false });
  assert.match(m ?? "", /Allegro Virtuoso/);
});

test("sin período abierto no hay a qué anclar el préstamo", () => {
  const m = motivoParaRechazarPrestamo({ ...base, tienePeriodoAbierto: false });
  assert.match(m ?? "", /período abierto/i);
});

test("una inscripción inactiva no presta", () => {
  assert.match(
    motivoParaRechazarPrestamo({ ...base, inscripcionActiva: false }) ?? "",
    /no está activa/i,
  );
});

test("el estado del ejemplar bloquea, cada uno con su razón", () => {
  for (const [estado, patron] of [
    ["prestado", /ya está prestado/i],
    ["en_reparacion", /en reparación/i],
    ["baja", /de baja/i],
  ] as [EstadoEjemplar, RegExp][]) {
    assert.match(motivoParaRechazarPrestamo({ ...base, estadoEjemplar: estado }) ?? "", patron);
  }
});

test("un ejemplar dañado se repara antes de prestarse", () => {
  assert.match(
    motivoParaRechazarPrestamo({ ...base, condicionEjemplar: "dañado" }) ?? "",
    /repáralo/i,
  );
});

test("no se acumulan dos del mismo instrumento", () => {
  assert.match(
    motivoParaRechazarPrestamo({ ...base, yaTienePrestadoEsteInstrumento: true }) ?? "",
    /ya tiene prestado/i,
  );
});

test("la devolución normal deja el ejemplar disponible", () => {
  for (const c of ["nuevo", "bueno", "regular"] as Condicion[]) {
    assert.equal(estadoTrasDevolucion("ninguna", c), "disponible");
  }
});

test("una pérdida da de baja el ejemplar, no lo deja disponible", () => {
  // Dejarlo «disponible» lo pondría mañana en la lista de lo que se puede prestar.
  assert.equal(estadoTrasDevolucion("perdida", "bueno"), "baja");
  assert.equal(estadoTrasDevolucion("perdida", "dañado"), "baja");
});

test("un daño manda a reparación aunque lo hayan recibido como «bueno»", () => {
  // La incidencia pesa más que la impresión de quien lo recibió en el mostrador.
  assert.equal(estadoTrasDevolucion("dano", "bueno"), "en_reparacion");
});

test("volver dañado manda a reparación aunque nadie levante incidencia", () => {
  assert.equal(estadoTrasDevolucion("ninguna", "dañado"), "en_reparacion");
});

test("una incidencia sin nota no se acepta", () => {
  assert.match(motivoParaRechazarDevolucion("dano", null) ?? "", /describe qué pasó/i);
  assert.match(motivoParaRechazarDevolucion("perdida", "  ") ?? "", /describe qué pasó/i);
  assert.equal(motivoParaRechazarDevolucion("dano", "Se rompió una clavija"), null);
});

test("una devolución limpia no exige nota", () => {
  assert.equal(motivoParaRechazarDevolucion("ninguna", null), null);
});

test("días entre fechas civiles", () => {
  assert.equal(diasEntre("2026-09-19", "2026-09-19"), 0);
  assert.equal(diasEntre("2026-09-19", "2026-10-18"), 29);
  assert.equal(diasEntre("2026-01-31", "2026-02-01"), 1);
});

test("el préstamo urge cuando el período ya cerró", () => {
  assert.equal(estadoDeDevolucion("2026-09-18", HOY), "vencido");
  assert.equal(estadoDeDevolucion("2026-09-19", HOY), "por_vencer");
  assert.equal(estadoDeDevolucion("2026-09-24", HOY), "por_vencer");
  assert.equal(estadoDeDevolucion("2026-09-25", HOY), "vigente");
  assert.equal(estadoDeDevolucion(null, HOY), "sin_periodo");
});

test("folio de inventario", () => {
  assert.equal(formatearCodigoInventario(1), "INV-0001");
  assert.equal(formatearCodigoInventario(42), "INV-0042");
  assert.equal(formatearCodigoInventario(12345), "INV-12345");
});

test("resumen del inventario", () => {
  const r = resumir([
    { estado: "disponible" }, { estado: "disponible" }, { estado: "prestado" },
    { estado: "en_reparacion" }, { estado: "baja" },
  ]);
  assert.deepEqual(r, { total: 5, disponibles: 2, prestados: 1, enReparacion: 1, deBaja: 1 });
});

test("un inventario vacío cuenta ceros", () => {
  assert.deepEqual(resumir([]), {
    total: 0, disponibles: 0, prestados: 0, enReparacion: 0, deBaja: 0,
  });
});
