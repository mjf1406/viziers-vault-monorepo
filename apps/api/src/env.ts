import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DEPLOYMENT_MODE: z.enum(["cloud", "self-host"]).default("self-host"),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_BASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}
