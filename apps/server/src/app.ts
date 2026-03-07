import { Hono } from "hono"
import { auth } from "./lib/auth.js"

const app = new Hono()

app.get("/api/health", (c) => {
  return c.json({ ok: true, status: "healthy" })
})

app.all("/api/auth/*", (c) => auth.handler(c.req.raw))

app.get("/api/me", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  return c.json({ user: session.user, session: { id: session.session.id, expiresAt: session.session.expiresAt } })
})

export default app
