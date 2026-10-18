"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirPermiso } from "@/lib/auth/permisos";
import { registrar } from "@/lib/bitacora";
import { crearPrograma } from "@/lib/datos/catalogo";

export type EstadoNuevo = { error?: string };

const Esquema = z.object({
  clave: z
    .string()
    .trim()
    .min(2, "La clave debe tener al menos 2 caracteres.")
    .max(30, "Máximo 30 caracteres.")
    .regex(/^[a-z0-9_-]+$/, "Solo letras minúsculas, números, guiones y guiones bajos."),
  nombre: z.string().trim().min(1, "El nombre no puede estar vacío.").max(80),
  descripcion: z.string().trim().min(1, "La descripción no puede estar vacía.").max(200),
  clasesPorCiclo: z.coerce.number().int().min(1, "Al menos 1 clase por ciclo.").max(31),
  minutosPorClase: z.coerce.number().int().min(15).max(180),
  alumnosIncluidos: z.coerce.number().int().min(1).max(5),
  renovable: z.coerce.boolean().default(true),
  permitePrestamoACasa: z.coerce.boolean().default(false),
  orden: z.coerce.number().int().min(0).default(0),
  precioPesos: z.coerce
    .number({ invalid_type_error: "Escribe el precio en pesos." })
    .positive("El precio debe ser mayor a cero.")
    .multipleOf(0.5, "Solo hasta 50 centavos de precisión."),
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
});

export async function crearProgramaAccion(
  _previo: EstadoNuevo,
  datos: FormData,
): Promise<EstadoNuevo> {
  const sesion = await exigirPermiso("configuracion.gestionar");

  const parsed = Esquema.safeParse({
    clave: datos.get("clave"),
    nombre: datos.get("nombre"),
    descripcion: datos.get("descripcion"),
    clasesPorCiclo: datos.get("clasesPorCiclo"),
    minutosPorClase: datos.get("minutosPorClase"),
    alumnosIncluidos: datos.get("alumnosIncluidos"),
    renovable: datos.get("renovable") === "1",
    permitePrestamoACasa: datos.get("permitePrestamoACasa") === "1",
    orden: datos.get("orden"),
    precioPesos: datos.get("precioPesos"),
    vigenteDesde: datos.get("vigenteDesde"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;
  const precioCentavos = Math.round(d.precioPesos * 100);

  let programaId: number;
  try {
    programaId = crearPrograma({
      clave: d.clave,
      nombre: d.nombre,
      descripcion: d.descripcion,
      clasesPorCiclo: d.clasesPorCiclo,
      minutosPorClase: d.minutosPorClase,
      alumnosIncluidos: d.alumnosIncluidos,
      renovable: d.renovable,
      permitePrestamoACasa: d.permitePrestamoACasa,
      orden: d.orden,
      precioCentavos,
      vigenteDesde: d.vigenteDesde,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo crear el programa.";
    if (msg.includes("UNIQUE") || msg.includes("ux_programas_clave")) {
      return { error: `La clave "${d.clave}" ya existe. Elige otra.` };
    }
    return { error: msg };
  }

  registrar({
    usuarioId: sesion.usuarioId,
    accion: "configuracion.modificar",
    entidad: "programas",
    entidadId: programaId,
    cambios: { accion: "crear", ...d, precioCentavos },
  });

  redirect(`/catalogo/programas/${programaId}`);
}
