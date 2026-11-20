const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

const EJEMPLO = "Sábado 21 de noviembre 11:00 am a 1:00 pm\nJueves 26 de noviembre 6:00 pm a 8:00 pm";

export type IntegranteClases = {
  nombre: string;
  /** Clases agendadas del período, ya con formato: se ofrecen cuando aún no hay un texto. */
  sugeridas?: string[];
  /** Lo que ya tenía guardado (al editar un pago). */
  inicial?: string;
};

/**
 * Lo que el comprobante de pago pide además del monto: descripción, fechas y horarios de las
 * clases, notas y el sello. Lo demás (nombre, código, dirección, teléfono, programa y período)
 * sale solo de la cuenta del alumno o de su tutor. Va igual al registrar y al editar un pago.
 *
 * En un plan familiar las clases se capturan por alumno: un bloque por cada integrante del plan
 * (2 o 3 según el programa), para que el comprobante muestre las 4 clases de cada uno con su
 * nombre y no una lista revuelta.
 */
export function CamposComprobante({
  inicial, sugeridas = [], integrantes,
}: {
  inicial?: { descripcion: string; clases: string; nota: string; sello: boolean };
  /** Clases agendadas del período (pagos de un solo alumno). */
  sugeridas?: string[];
  /** Solo en planes familiares: un bloque por alumno del plan. */
  integrantes?: IntegranteClases[];
}) {
  const clases = inicial?.clases ?? "";
  const usaSugeridas = clases.trim() === "" && sugeridas.length > 0;
  const porAlumno = integrantes !== undefined && integrantes.length > 0;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-xs font-medium text-vs-tinta-2">
          Descripción <span className="font-normal text-vs-tinta-3">(aparece en el comprobante)</span>
        </label>
        <textarea
          id="descripcion" name="descripcion" rows={2}
          defaultValue={inicial?.descripcion ?? ""}
          placeholder="Ej: Clases de violín programadas en las siguientes fechas y horarios"
          className={campo}
        />
      </div>

      {porAlumno ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-vs-linea p-3">
          <legend className="px-1 text-xs font-medium text-vs-tinta-2">
            Fechas y horarios de las clases{" "}
            <span className="font-normal text-vs-tinta-3">
              (plan familiar: las de cada alumno, una por línea; salen numeradas por alumno)
            </span>
          </legend>
          {integrantes.map((m, i) => {
            const guardado = (m.inicial ?? "").trim();
            const sug = guardado === "" ? (m.sugeridas ?? []) : [];
            return (
              <div key={`${m.nombre}-${i}`} className="flex flex-col gap-1.5">
                <input type="hidden" name="claseAlumno" value={m.nombre} />
                <label htmlFor={`clases-${i}`} className="text-xs font-semibold text-vs-tinta-2">{m.nombre}</label>
                <textarea
                  id={`clases-${i}`} name="claseTexto" rows={4}
                  defaultValue={guardado !== "" ? guardado : sug.join("\n")}
                  placeholder={EJEMPLO}
                  className={campo}
                />
                {sug.length > 0 && (
                  <p className="text-xs text-vs-tinta-3">Sugeridas desde su agenda del período. Corrígelas si hace falta.</p>
                )}
              </div>
            );
          })}
        </fieldset>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clasesTexto" className="text-xs font-medium text-vs-tinta-2">
            Fechas y horarios de las clases{" "}
            <span className="font-normal text-vs-tinta-3">(una por línea; salen numeradas)</span>
          </label>
          <textarea
            id="clasesTexto" name="clasesTexto" rows={4}
            defaultValue={usaSugeridas ? sugeridas.join("\n") : clases}
            placeholder={EJEMPLO}
            className={campo}
          />
          {usaSugeridas && (
            <p className="text-xs text-vs-tinta-3">
              Sugeridas desde la agenda del período. Corrígelas si hace falta.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className="text-xs font-medium text-vs-tinta-2">
          Notas <span className="font-normal text-vs-tinta-3">(salen en el comprobante; opcional)</span>
        </label>
        <textarea id="nota" name="nota" rows={2} defaultValue={inicial?.nota ?? ""} className={campo} />
      </div>

      <label className="flex items-center gap-2 text-sm text-vs-tinta-2">
        <input type="checkbox" name="selloPago" value="1" defaultChecked={inicial?.sello ?? true} />
        Mostrar el sello «Pago registrado»
      </label>
    </>
  );
}
