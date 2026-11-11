import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { Toaster } from "sonner";

import { FondoEscena } from "@/components/fondo-escena";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={interTight.variable}>
      <body className="min-h-screen antialiased">
        <FondoEscena />
        {children}
        <Toaster richColors closeButton position="bottom-right" />
      </body>
    </html>
  );
}
