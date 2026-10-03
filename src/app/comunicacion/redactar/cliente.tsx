"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { guardarBorrador, type EstadoMensajeUI } from "../acciones";

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

type Version = { plantillaId: number; nombre: string; texto: string; faltantes: string[] };

function Guardar({ bloqueado }: { bloqueado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || bloqueado}
            className="rounded-lg bg-vs-naranja px-5 py-2.5 text-sm font-semibold text-vs-tinta
                       transition hover:bg-vs-naranja-claro disabled:opacity-50">
      {pending ? "Guardando…" : "Mandar a aprobación"}
    </button>
  );
}

export function Redactor({
  versiones, alumnoId, prospectoId, destinatario, telefono,
}: {
  versiones: Version[]; alumnoId: number | null; prospectoId: number | null;
  destinatario: string; telefono: string | null;
}) {
  const [estado, accion] = useActionState<EstadoMensajeUI, FormData>(guardarBorrador, {});
  const primera = versiones[0];
  const [elegida, setElegida] = useState(primera?.plantillaId ?? 0);
  const [texto, setTexto] = useState(primera?.texto ?? "");
  const [tel, setTel] = useState(telefono ?? "");

  const cambiar = (id: number) => {
    setElegida(id);
    const v = versiones.find((x) => x.plantillaId === id);
    if (v) setTexto(v.texto);
  };

  const huecos = [...texto.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g)].map((m) => m[1]);
  const sinTelefono = tel.trim() === "";
  const bloqueado = huecos.length > 0 || sinTelefono || texto.trim() === "";

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="plantillaId" value={elegida} />
      <input type="hidden" name="alumnoId" value={alumnoId ?? ""} />
      <input type="hidden" name="prospectoId" value={prospectoId ?? ""} />
      <input type="hidden" name="destinatario" value={destinatario} />

      {estado.error && (
        <p id="error-redactar" role="alert"
           className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Plantilla</h2>
        <div className="mt-3 flex flex-col gap-2">
          {versiones.map((v) => (
            <label key={v.plantillaId} htmlFor={`pl-${v.plantillaId}`}
                   className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                     elegida === v.plantillaId
                       ? "border-vs-naranja bg-vs-crema"
                       : "border-vs-linea hover:border-vs-line-strong"
                   }`}>
              <input id={`pl-${v.plantillaId}`} type="radio" name="_plantilla" className="mt-1"
                     checked={elegida === v.plantillaId}
                     onChange={() => cambiar(v.plantillaId)} />
              <span className="flex-1">
                <span className="text-sm font-medium">{v.nombre}</span>
                {v.faltantes.length > 0 && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                    faltan {v.faltantes.length} dato{v.faltantes.length === 1 ? "" : "s"}
                  </span>
                )}
                <span className="mt-0.5 block line-clamp-2 text-xs text-vs-tinta-3">
                  {v.texto.split("\n")[0]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-vs-linea bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Texto</h2>
        <p className="mt-1 text-sm text-vs-tinta-2">
          Esto es exactamente lo que va a leer <strong>{destinatario}</strong>. Edítalo si hace
          falta: lo que se aprueba es este texto, no la plantilla.
        </p>

        <textarea
          id="cuerpo" name="cuerpo" rows={12}
          className={`${campo} mt-3 w-full font-mono`}
          value={texto} onChange={(e) => setTexto(e.target.value)}
        />

        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor="telefono" className="text-xs font-medium text-vs-tinta-2">
            Teléfono de {destinatario}
          </label>
          <input id="telefono" name="telefono" className={campo}
                 value={tel} onChange={(e) => setTel(e.target.value)} />
        </div>

        {huecos.length > 0 && (
          <p id="aviso-huecos"
             className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            Quedan datos sin llenar: <strong>{huecos.map((h) => `{{${h}}}`).join(", ")}</strong>.
            El sistema no deja guardarlo así — «Hola {"{{tutor}}"}» no es un mensaje incompleto,
            es un mensaje que no se puede mandar.
          </p>
        )}
        {sinTelefono && (
          <p id="aviso-sin-telefono"
             className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Sin teléfono no hay a dónde mandarlo. Complétalo en el expediente o escríbelo aquí.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Guardar bloqueado={bloqueado} />
        <p className="text-xs text-vs-tinta-3">
          Queda en la bandeja hasta que alguien con permiso lo apruebe.
        </p>
      </div>
    </form>
  );
}
