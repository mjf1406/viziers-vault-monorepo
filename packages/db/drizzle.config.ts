import { defineConfig } from "drizzle-kit"

const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/viziers_vault"

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
})
