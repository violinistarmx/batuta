import assert from "node:assert/strict";
import test from "node:test";

import {
  admiteCambios, duracionDelPrograma, formatearFolioBoleto, lugaresDisponibles,
  motivoParaRechazarConfirmacion, motivoParaRechazarPropuesta,
  motivoParaRechazarRechazo, motivoParaRechazarVenta, problemasDelOrden,
  totalDeVenta, type EstadoRecital, type Numero,
} from "./recitales.ts";

test("el recital admite cambios solo mientras se prepara", () => {
  assert.equal(admiteCambios("planeado"), true);
  assert.equal(admiteCambios("abierto"), true);
  for (const e of ["programa_cerrado", "realizado", "cancelado"] as EstadoRecital[]) {
    assert.equal(admiteCambios(e), false, e);
  }
});

const propuesta = {
  estadoRecital: "abierto" as EstadoRecital,
  inscripcionActiva: true,
  yaParticipaConEstaPieza: false,
};

test("el maestro propone sin tropezar con finanzas", () => {
  // La solicitud de propuesta NO tiene campo de adeudo: el maestro no ve dinero y
  // un error por una deuda que no puede consultar sería imposible de resolver.
  assert.equal(motivoParaRechazarPropuesta(propuesta), null);
  assert.equal("adeudoVencidoCentavos" in propuesta, false);
});

test("no se propone en un recital cerrado, realizado o cancelado", () => {
  assert.match(
    motivoParaRechazarPropuesta({ ...propuesta, estadoRecital: "programa_cerrado" }) ?? "",
    /reabrirlo/i,
  );
  assert.match(
    motivoParaRechazarPropuesta({ ...propuesta, estadoRecital: "realizado" }) ?? "",
    /ya se realizó/i,
  );
  assert.match(
    motivoParaRechazarPropuesta({ ...propuesta, estadoRecital: "cancelado" }) ?? "",
    /cancelado/i,
  );
});

test("no se propone a quien no tiene inscripción activa", () => {
  assert.match(
    motivoParaRechazarPropuesta({ ...propuesta, inscripcionActiva: false }) ?? "",
    /no está activa/i,
  );
});

test("no se repite alumno con la misma pieza", () => {
  assert.match(
    motivoParaRechazarPropuesta({ ...propuesta, yaParticipaConEstaPieza: true }) ?? "",
    /ya está propuesto/i,
  );
});

const confirmacion = {
  estadoParticipacion: "propuesta" as const,
  estadoRecital: "abierto" as EstadoRecital,
  adeudoVencidoCentavos: 0,
};

test("se confirma a quien está al corriente", () => {
  assert.equal(motivoParaRechazarConfirmacion(confirmacion), null);
});

test("un adeudo VENCIDO impide confirmar", () => {
  assert.match(
    motivoParaRechazarConfirmacion({ ...confirmacion, adeudoVencidoCentavos: 75_000 }) ?? "",
    /al corriente/i,
  );
});

test("un cargo que todavía no vence no es adeudo", () => {
  // Quien renovó el mismo día del recital tiene un cargo abierto sin vencer, y
  // bloquearlo por eso lo dejaría fuera por estar al día.
  assert.equal(motivoParaRechazarConfirmacion({ ...confirmacion, adeudoVencidoCentavos: 0 }), null);
});

test("no se confirma dos veces ni sobre una cancelada", () => {
  assert.match(
    motivoParaRechazarConfirmacion({ ...confirmacion, estadoParticipacion: "confirmada" }) ?? "",
    /ya estaba confirmada/i,
  );
  assert.match(
    motivoParaRechazarConfirmacion({ ...confirmacion, estadoParticipacion: "cancelada" }) ?? "",
    /cancelada/i,
  );
});

test("un rechazo sin motivo no se acepta", () => {
  assert.match(motivoParaRechazarRechazo(null) ?? "", /por qué se rechaza/i);
  assert.match(motivoParaRechazarRechazo("   ") ?? "", /por qué se rechaza/i);
  assert.equal(motivoParaRechazarRechazo("La pieza todavía no está lista"), null);
});

const num = (id: number, orden: number | null, dur: number | null = 4): Numero =>
  ({ participacionId: id, orden, duracionMinutos: dur });

test("un programa bien ordenado no tiene problemas", () => {
  assert.deepEqual(problemasDelOrden([num(1, 1), num(2, 2), num(3, 3)]), []);
});

test("detecta a quien se quedó sin lugar", () => {
  const p = problemasDelOrden([num(1, 1), num(2, null)]);
  assert.match(p.join(" "), /1 participación\(es\) sin lugar/);
});

test("detecta dos en el mismo lugar", () => {
  // Un programa con dos números tres no se puede leer en voz alta.
  const p = problemasDelOrden([num(1, 1), num(2, 3), num(3, 3)]);
  assert.match(p.join(" "), /mismo lugar: 3/);
});

test("detecta un hueco en la numeración", () => {
  const p = problemasDelOrden([num(1, 1), num(2, 3), num(3, 4)]);
  assert.match(p.join(" "), /Falta el lugar 2/);
});

test("un programa vacío no reporta nada", () => {
  assert.deepEqual(problemasDelOrden([]), []);
});

test("duración del programa, separando lo que no se sabe", () => {
  const d = duracionDelPrograma([num(1, 1, 4), num(2, 2, 6), num(3, 3, null)]);
  assert.deepEqual(d, { minutos: 10, sinDato: 1 });
});

test("el total de la venta se calcula en centavos", () => {
  assert.equal(totalDeVenta(3, 8_000), 24_000);
  assert.equal(totalDeVenta(1, 12_050), 12_050);
  assert.equal(totalDeVenta(0, 8_000), 0);
});

test("lugares disponibles según el aforo", () => {
  assert.equal(lugaresDisponibles({ capacidad: 80, vendidos: 30 }), 50);
  assert.equal(lugaresDisponibles({ capacidad: 80, vendidos: 80 }), 0);
  // Nunca negativo, aunque los datos vengan mal.
  assert.equal(lugaresDisponibles({ capacidad: 80, vendidos: 95 }), 0);
  // Sin aforo declarado no se sabe, y eso no es lo mismo que cero.
  assert.equal(lugaresDisponibles({ capacidad: null, vendidos: 30 }), null);
});

test("no se vende por encima del aforo", () => {
  const a = { capacidad: 50, vendidos: 48 };
  assert.equal(motivoParaRechazarVenta(2, a, "abierto"), null);
  assert.match(motivoParaRechazarVenta(3, a, "abierto") ?? "", /Solo quedan 2/);
  assert.match(
    motivoParaRechazarVenta(1, { capacidad: 50, vendidos: 50 }, "abierto") ?? "",
    /aforo está completo/i,
  );
});

test("sin aforo declarado se vende sin tope", () => {
  assert.equal(motivoParaRechazarVenta(500, { capacidad: null, vendidos: 0 }, "abierto"), null);
});

test("no se venden boletos de un recital cancelado o ya realizado", () => {
  const a = { capacidad: null, vendidos: 0 };
  assert.match(motivoParaRechazarVenta(1, a, "cancelado") ?? "", /cancelado/i);
  assert.match(motivoParaRechazarVenta(1, a, "realizado") ?? "", /ya se realizó/i);
});

test("una cantidad inválida se rechaza antes de tocar el aforo", () => {
  const a = { capacidad: 50, vendidos: 0 };
  assert.match(motivoParaRechazarVenta(0, a, "abierto") ?? "", /al menos 1/);
  assert.match(motivoParaRechazarVenta(-2, a, "abierto") ?? "", /al menos 1/);
  assert.match(motivoParaRechazarVenta(1.5, a, "abierto") ?? "", /al menos 1/);
});

test("folio de boleto, con el recital dentro", () => {
  assert.equal(formatearFolioBoleto(3, 1), "REC-3-0001");
  assert.equal(formatearFolioBoleto(12, 137), "REC-12-0137");
});
