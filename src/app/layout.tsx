import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es-MX">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
