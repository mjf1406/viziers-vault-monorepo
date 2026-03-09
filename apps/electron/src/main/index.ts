import { app as electronApp, BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as schema from "@workspace/db/schema";
import { createApp } from "@workspace/api";

const PORT = 3999;

async function main() {
  const userDataPath = electronApp.getPath("userData");
  const pgliteDataDir = path.join(userDataPath, "pglite-data");
  const db = drizzle(pgliteDataDir, { schema });

  const migrationsPath = electronApp.isPackaged
    ? path.join(process.resourcesPath, "migrations")
    : path.resolve(__dirname, "../../../../packages/db/src/migrations");
  await migrate(db, { migrationsFolder: migrationsPath });

  const apiApp = createApp(db);
  const honoApp = new Hono();
  honoApp.route("/api", apiApp);

  const rendererPath = electronApp.isPackaged
    ? path.join(process.resourcesPath, "renderer")
    : path.resolve(__dirname, "../../../web/dist");

  honoApp.get("*", async (c) => {
    const urlPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const filePath = path.join(rendererPath, urlPath.replace(/^\//, ""));
    try {
      const content = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath);
      const mimes: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".ico": "image/x-icon",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
      };
      const mime = mimes[ext] ?? "application/octet-stream";
      return new Response(content, {
        headers: { "Content-Type": mime },
      });
    } catch {
      const indexPath = path.join(rendererPath, "index.html");
      const indexContent = await fs.promises.readFile(indexPath);
      return new Response(indexContent, {
        headers: { "Content-Type": "text/html" },
      });
    }
  });

  serve({ fetch: honoApp.fetch, port: PORT });

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.loadURL(`http://localhost:${PORT}`);
}

electronApp.whenReady().then(main);
