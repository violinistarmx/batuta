"use server";

import { revalidatePath } from "next/cache";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { guardarParametro, parametro } from "@/lib/datos/ajustes";
import { validarValor } from "@/lib/dominio/ajustes";

export type EstadoAjustes = { error?: string; ok?: string; clave?: string };

export async function guardarAjuste(
  _previo: EstadoAjustes,
  datos: FormData,
): Promise<EstadoAjustes> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const clave = String(datos.get("clave") ?? "");
  const crudo = String(datos.get("valor") ?? "");

  const actual = parametro(clave);
  if (!actual) return { error: "Ese parámetro no existe.", clave };

  const v = validarValor(clave, actual.tipo, crudo);
  if (!v.ok) return { error: v.error, clave };

  if (v.valor === actual.valor) return { ok: "No cambió nada.", clave };

  let antes: string;
  try {
    ({ antes } = guardarParametro(clave, v.valor));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar.", clave };
  }

  // Un cambio de configuración cambia cómo se comporta todo el sistema desde ese
  // instante. Si no quedara registrado, dentro de seis meses nadie podría
  // explicar por qué dos cortes de nómina del mismo maestro no cuadran entre sí.
  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "configuracion",
    cambios: { [clave]: [antes, v.valor] },
  });

  revalidatePath("/ajustes");
  revalidatePath("/catalogo");
  return { ok: "Guardado.", clave };
}
