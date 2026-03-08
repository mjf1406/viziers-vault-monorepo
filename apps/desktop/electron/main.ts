import { app, BrowserWindow } from "electron";
import path from "path";
import { createDesktopServer } from "./server";

const DESKTOP_API_PORT = 3099;
const API_BASE_URL = `http://127.0.0.1:${DESKTOP_API_PORT}`;

async function bootstrap() {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "db");
  const migrationsFolder =
    process.env.NODE_ENV === "production"
      ? path.join(process.resourcesPath, "migrations")
      : path.resolve(__dirname, "../../../../packages/db/migrations");

  await createDesktopServer(dbPath, migrationsFolder);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(
      __dirname,
      "../preload/preload.mjs"
    ),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.ELECTRON_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  await bootstrap();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
