"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  cambiarEstadoCuenta, cambiarRolCuenta, restablecerCuenta, type EstadoCuentas,
} from "../acciones";
import { Credencial } from "../credencial";

type Cuenta = {
  id: number;
  nombre: string;
  email: string;
  rol: "director" | "docente" | "asistente";
  activo: boolean;
  esTuCuenta: boolean;
  tieneFicha: boolean;
  sesionesAbiertas: number;
};

const campo = "rounded-lg border border-vs-linea bg-white px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vs-naranja-700";

function Boton({ children, tono = "normal" }: { children: React.ReactNode; tono?: "normal" | "riesgo" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
              tono === "riesgo"
                ? "border border-red-300 text-red-800 hover:bg-red-50"
                : "bg-vs-naranja text-vs-tinta hover:bg-vs-naranja-claro"
            }`}>
      {pending ? "Un momento…" : children}
    </button>
  );
}

function Aviso({ estado, id }: { estado: EstadoCuentas; id: string }) {
  if (estado.error) {
    return (
      <p id={`error-${id}`} role="alert"
         className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p id={`ok-${id}`} role="status"
         className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
        {estado.ok}
      </p>
    );
  }
  return null;
}

export function Administrar({ cuenta, motivoBaja }: { cuenta: Cuenta; motivoBaja: string | null }) {
  return (
    <div className="flex flex-col gap-5">
      <Rol cuenta={cuenta} />
      <Restablecer cuenta={cuenta} />
      <Estado cuenta={cuenta} motivoBaja={motivoBaja} />
    </div>
  );
}

// ---------------------------------------------------------------- rol ---

function Rol({ cuenta }: { cuenta: Cuenta }) {
  const [estado, accion] = useActionState<EstadoCuentas, FormData>(cambiarRolCuenta, {});
  const [rol, setRol] = useState(cuenta.rol);

  const bajaDeDocente = cuenta.tieneFicha && rol !== "docente";

  return (
    <section className="rounded-xl border border-vs-linea bg-white p-5">
      <h2 className="font-display text-lg font-semibold">Rol</h2>
      <p className="mt-1 text-sm text-vs-tinta-2">
        Define qué alcanza a ver. Cambiarlo no toca nada de lo que ya hizo.
      </p>

      <form action={accion} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={cuenta.id} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rol" className="text-xs font-medium text-vs-tinta-2">Rol</label>
          <select id="rol" name="rol" className={campo} value={rol}
                  onChange={(e) => setRol(e.target.value as Cuenta["rol"])}>
            <option value="docente">Maestro</option>
            <option value="asistente">Asistente</option>
            <option value="director">Director</option>
          </select>
        </div>
        <Boton>Cambiar el rol</Boton>
      </form>

      {cuenta.esTuCuenta && cuenta.rol === "director" && rol !== "director" && (
        <p id="aviso-tu-propio-rol"
           className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Es tu propia cuenta. Batuta no te va a dejar quitarte el rol de director:
          saldrías de esta pantalla sin poder volver a entrar a ella.
        </p>
      )}

      {bajaDeDocente && (
        <p id="aviso-deja-de-ser-maestro"
           className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tiene ficha de maestro. Si deja de ser maestro, su ficha y su nómina se
          quedan completas, pero él dejará de verlas desde su sesión.
        </p>
      )}

      <Aviso estado={estado} id="rol" />
    </section>
  );
}

// ------------------------------------------------------- restablecer ---

function Restablecer({ cuenta }: { cuenta: Cuenta }) {
  const [estado, accion] = useActionState<EstadoCuentas, FormData>(restablecerCuenta, {});

  if (estado.credencial) {
    return <Credencial c={estado.credencial} />;
  }

  return (
    <section className="rounded-xl border border-vs-linea bg-white p-5">
      <h2 className="font-display text-lg font-semibold">Restablecer la contraseña</h2>
      <p className="mt-1 text-sm text-vs-tinta-2">
        Para cuando se le olvidó, o cuando hay que suponer que alguien más la conoce.
        Batuta genera una nueva, la muestra una sola vez y le cierra todas las sesiones
        abiertas: si se restablece porque alguien no reconocido estaba usando la cuenta,
        dejarla abierta no resolvería nada.
      </p>

      <form action={accion} className="mt-4">
        <input type="hidden" name="id" value={cuenta.id} />
        <input type="hidden" name="nombre" value={cuenta.nombre} />
        <input type="hidden" name="email" value={cuenta.email} />
        <input type="hidden" name="rol"
               value={{ director: "Director", docente: "Maestro", asistente: "Asistente" }[cuenta.rol]} />
        <Boton>Generar una contraseña nueva</Boton>
      </form>

      <Aviso estado={estado} id="restablecer" />
    </section>
  );
}

// ------------------------------------------------------------ estado ---

function Estado({ cuenta, motivoBaja }: { cuenta: Cuenta; motivoBaja: string | null }) {
  const [estado, accion] = useActionState<EstadoCuentas, FormData>(cambiarEstadoCuenta, {});

  return (
    <section className="rounded-xl border border-vs-linea bg-white p-5">
      <h2 className="font-display text-lg font-semibold">
        {cuenta.activo ? "Desactivar la cuenta" : "Reactivar la cuenta"}
      </h2>
      <p className="mt-1 text-sm text-vs-tinta-2">
        {cuenta.activo
          ? "Es lo que se hace cuando alguien deja la academia. No borra nada: su historial " +
            "sigue ahí y la bitácora sigue diciendo qué hizo y cuándo. Simplemente deja de entrar."
          : "Vuelve a entrar con la contraseña que tenía. Si no la recuerda, genérale una nueva arriba."}
      </p>

      {cuenta.activo && cuenta.sesionesAbiertas > 0 && motivoBaja === null && (
        <p className="mt-3 rounded-lg border border-vs-linea bg-vs-crema px-3 py-2 text-xs">
          Tiene {cuenta.sesionesAbiertas === 1 ? "una sesión abierta" : `${cuenta.sesionesAbiertas} sesiones abiertas`}.
          Se {cuenta.sesionesAbiertas === 1 ? "cierra" : "cierran"} en el mismo momento:
          desactivar sin cerrarlas lo dejaría dentro hasta doce horas más.
        </p>
      )}

      {cuenta.activo && motivoBaja !== null ? (
        <p id="no-se-puede-desactivar"
           className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {motivoBaja}
        </p>
      ) : (
        <form action={accion} className="mt-4">
          <input type="hidden" name="id" value={cuenta.id} />
          <input type="hidden" name="accion" value={cuenta.activo ? "desactivar" : "reactivar"} />
          <Boton tono={cuenta.activo ? "riesgo" : "normal"}>
            {cuenta.activo ? "Desactivar" : "Reactivar"}
          </Boton>
        </form>
      )}

      <Aviso estado={estado} id="estado" />
    </section>
  );
}
