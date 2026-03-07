import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
})

export type Env = z.infer<typeof envSchema>

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten())
    throw new Error("Invalid environment")
  }
  return parsed.data
}
