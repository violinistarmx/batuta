import { redirect } from "next/navigation";

/** Reportes ahora vive dentro de Finanzas. Esta dirección se conserva para los enlaces guardados. */
export default function Reportes() {
  redirect("/finanzas/reportes");
}
