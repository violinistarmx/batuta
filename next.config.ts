import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ['192.168.100.20'],
  experimental: {
    serverActionsBodySizeLimit: 10 * 1024 * 1024,
  },
};

export default config;
