import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@react-pdf/renderer"],
  allowedDevOrigins: ['192.168.100.20'],
  experimental: {
    // Por defecto Next limita el cuerpo de una acción de servidor a 1 MB. Un aviso
    // puede llevar hasta 3 archivos de 10 MB (30 MB en total), así que el límite
    // cubre ese caso. Cada archivo se valida a 10 MB en lib/dominio/archivos.ts.
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default config;
