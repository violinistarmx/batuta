import { migrate } from "drizzle-orm/mongodb/migrator";
import { db, client } from "./index";

async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migraciones aplicadas.");
  } catch (error) {
    console.error("Error durante migraciones:", error);
    throw error;
  } finally {
    await client.close();
  }
}

runMigrations();
