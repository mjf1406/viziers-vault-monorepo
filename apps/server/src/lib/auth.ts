import { db } from "@workspace/db"
import { createAuth } from "@workspace/auth/server"
import { getEnv } from "./env.js"

const env = getEnv()
export const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_ORIGIN,
})
