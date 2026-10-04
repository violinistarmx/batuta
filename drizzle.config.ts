import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "mongodb",
  dbCredentials: {
    url: process.env.MONGODB_URI ?? process.env.DATABASE_URL ?? "mongodb://localhost:27017/batuta"
  },
  extensionsFilters: ["kysely"],
  strict: true,
  verbose: true,
} satisfies Config;
