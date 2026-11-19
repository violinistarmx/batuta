const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

/**
 * Lo que el comprobante de pago pide además del monto: descripción, fechas y horarios de las
 * clases, notas y el sello. Lo demás (nombre, código, dirección, teléfono, programa y período)
 * sale solo de la cuenta del alumno o de su tutor. Va igual al registrar y al editar un pago.
 */
export function CamposComprobante({
  inicial, sugeridas = [],
}: {
  inicial?: { descripcion: string; clases: string; nota: string; sello: boolean };
  /** Clases agendadas del período, ya con formato: se ofrecen cuando aún no hay un texto. */
  sugeridas?: string[];
}) {
  const clases = inicial?.clases ?? "";
  const usaSugeridas = clases.trim() === "" && sugeridas.length > 0;
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="clasesTexto" className="text-xs font-medium text-vs-tinta-2">
          Fechas y horarios de las clases{" "}
          <span className="font-normal text-vs-tinta-3">(una por línea; salen numeradas)</span>
        </label>
        <textarea
          id="clasesTexto" name="clasesTexto" rows={4}
          defaultValue={usaSugeridas ? sugeridas.join("\n") : clases}
          placeholder={"Sábado 21 de noviembre 11:00 am a 1:00 pm\nJueves 26 de noviembre 6:00 pm a 8:00 pm"}
          className={campo}
        />
        {usaSugeridas && (
          <p className="text-xs text-vs-tinta-3">
            Sugeridas desde la agenda del período. Corrígelas si hace falta.
          </p>
        )}
      </div>

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
