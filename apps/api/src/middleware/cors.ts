import { cors } from "hono/cors";

/**
 * CORS for local dev only (Vite origin).
 * In self-host/production, nginx same-origin so CORS is not used.
 */
export const devCors = () =>
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
