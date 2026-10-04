import { MongoClient } from "mongodb";
import { drizzle } from "drizzle-orm/mongodb";

import * as schema from "./schema/index";

const mongoUrl =
  process.env.MONGODB_URI ??
  process.env.DATABASE_URL ??
  "mongodb://localhost:27017/batuta";

// Crear cliente de MongoDB
const client = new MongoClient(mongoUrl);

// Conectar a MongoDB al inicializar
let connected = false;

async function connectToDatabase() {
  if (!connected) {
    try {
      await client.connect();
      connected = true;
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      throw error;
    }
  }
  return client.db("batuta");
}

// Inicializar la conexión (se ejecuta cuando el módulo se importa)
const mongoDb = client.db("batuta");

export const db = drizzle(mongoDb, { schema });

// Exportar client para que se pueda cerrar si es necesario
export { client, connectToDatabase };
