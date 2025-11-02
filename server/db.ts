import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const useNeon = /neon\.tech/i.test(connectionString);

if (useNeon) {
  neonConfig.webSocketConstructor = ws;
}

console.log(`[db] using ${useNeon ? "Neon serverless" : "node-postgres"} driver`);

export const db = useNeon
  ? neonDrizzle({ client: new NeonPool({ connectionString }), schema })
  : pgDrizzle(new pg.Pool({ connectionString }), { schema });

export type Database = typeof db;
