import { redirect } from "next/navigation";

import { exigirPermiso } from "@/lib/auth/permisos";

/** /ajustes a secas lleva a la primera sección; cada grupo de reglas vive en /ajustes/<grupo>. */
export default async function AjustesRaiz() {
  await exigirPermiso("configuracion.gestionar");
  redirect("/ajustes/contrato");
}
