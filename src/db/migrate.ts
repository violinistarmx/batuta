import { migrate } from "drizzle-orm/mongodb/migrator";
import { db, client, connectToDatabase } from "./index";

async function runMigrations() {
  try {
    // Obtener la instancia de drizzle conectada
    const drizzleDb = await db.query();
    await migrate(drizzleDb, { migrationsFolder: "./drizzle" });
    console.log("Migraciones aplicadas.");
  } catch (error) {
    console.error("Error durante migraciones:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

runMigrations();
