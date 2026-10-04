import { MongoClient } from "mongodb";
import { drizzle, type MongoDBDatabase } from "drizzle-orm/mongodb";

import * as schema from "./schema/index";

const mongoUrl =
  process.env.MONGODB_URI ??
  process.env.DATABASE_URL ??
  "mongodb://localhost:27017/batuta";

let cachedClient: MongoClient | null = null;
let cachedDrizzleDb: MongoDBDatabase | null = null;

async function connectToDatabase(): Promise<MongoDBDatabase> {
  if (cachedClient && cachedDrizzleDb) {
    return cachedDrizzleDb;
  }

  try {
    const client = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
    });

    await client.connect();
    console.log("✅ Connected to MongoDB");

    cachedClient = client;

    // Para drizzle-orm 0.33.0, pasar el cliente (no la base de datos)
    const db = drizzle(client, {
      schema,
      database: "batuta"
    });

    cachedDrizzleDb = db;

    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// Lazy initialization - la conexión se realiza cuando se necesita
let dbPromise: Promise<MongoDBDatabase> | null = null;

function getDrizzleDb() {
  if (!dbPromise) {
    dbPromise = connectToDatabase();
  }
  return dbPromise;
}

// Export para uso en server components
export const db = {
  async query() {
    return getDrizzleDb();
  },
  // Proxy para compatibilidad con código existente
  then(onFulfilled: (db: MongoDBDatabase) => any) {
    return getDrizzleDb().then(onFulfilled);
  }
};

export { cachedClient as client, connectToDatabase };
