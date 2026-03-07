import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"

const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/viziers_vault"
const client = postgres(connectionString)

export const db = drizzle(client, { schema })
export type Db = typeof db
