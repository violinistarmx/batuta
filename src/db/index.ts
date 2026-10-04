import { MongoClient } from "mongodb";
import { drizzle } from "drizzle-orm/mongodb";

import * as schema from "./schema/index";

const mongoUrl =
  process.env.MONGODB_URI ??
  process.env.DATABASE_URL ??
  "mongodb://localhost:27017/batuta";

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
    });

    await client.connect();
    console.log("✅ Connected to MongoDB");

    cachedClient = client;
    cachedDb = client.db("batuta");

    return cachedDb;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// Lazy initialization - la conexión se realiza cuando se necesita
let dbPromise: Promise<any> | null = null;

function getDrizzleDb() {
  if (!dbPromise) {
    dbPromise = connectToDatabase().then(db => drizzle(db, { schema }));
  }
  return dbPromise;
}

// Export para uso en server components
export const db = {
  async query() {
    return getDrizzleDb();
  },
  // Proxy para compatibilidad con código existente
  then(onFulfilled: any) {
    return getDrizzleDb().then(onFulfilled);
  }
};

export { cachedClient as client, connectToDatabase };
