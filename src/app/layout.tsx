import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";

import { FondoEscena } from "@/components/fondo-escena";
import { COOKIE_TEMA, temaValido } from "@/lib/tema";
import "./globals.css";

// Tipografía de toda la app. next/font la descarga al compilar y la sirve desde el mismo
// dominio: el navegador no le pide nada a Google.
const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: "Batuta · VioliniStar",
  description: "Sistema de gestión de la Academia de Música VioliniStar",
  icons: {
    icon: "/logo-violinistar.png",
    apple: "/logo-violinistar.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El tema se lee en el servidor para pintar la página ya con él: sin parpadeo al cargar.
  const tema = temaValido((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <html lang="es-MX" className={interTight.variable} data-tema={tema}>
      <body className="min-h-screen antialiased">
        <FondoEscena tema={tema} />
        {children}
        <Toaster richColors closeButton position="bottom-right" />
      </body>
    </html>
  );
}
