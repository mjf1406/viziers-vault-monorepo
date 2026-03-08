import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Env } from "./env";
import type { PostgresDb } from "@workspace/db";
import { user, session, account, verification } from "@workspace/db";

export function createAuth(env: Env, db: PostgresDb) {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.DEPLOYMENT_MODE === "cloud" && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    baseURL: env.BETTER_AUTH_BASE_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  });
}

export type Auth = ReturnType<typeof createAuth>;
