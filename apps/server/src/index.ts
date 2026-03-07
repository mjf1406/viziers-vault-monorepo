import { serve } from "@hono/node-server"
import app from "./app.js"
import { getEnv } from "./lib/env.js"

const env = getEnv()
const port = env.PORT

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`)
})
