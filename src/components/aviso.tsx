"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Avisos que llegan tras una redirección de una acción del servidor.
 *
 * Las acciones terminan con `redirect(...)`, así que no pueden devolver un toast.
 * Por eso la acción agrega `?aviso=clave` a la URL, este componente muestra el
 * mensaje y quita el parámetro para que no se repita al recargar.
 */
const MENSAJES: Record<string, string> = {
  "pago-registrado": "Pago registrado",
  "cargo-creado": "Cargo creado",
};

export function AvisoTras() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const clave = params.get("aviso");
    if (!clave) return;
    const mensaje = MENSAJES[clave];
    if (mensaje) toast.success(mensaje);

    const resto = new URLSearchParams(params.toString());
    resto.delete("aviso");
    const qs = resto.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
