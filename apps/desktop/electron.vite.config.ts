import path from "path";
import { defineConfig } from "electron-vite";

const webAppRoot = path.resolve(__dirname, "../web");

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      lib: {
        entry: path.resolve(__dirname, "electron/main.ts"),
      },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      lib: {
        entry: path.resolve(__dirname, "electron/preload.ts"),
      },
    },
  },
  renderer: {
    root: webAppRoot,
    resolve: {
      alias: {
        "@": path.join(webAppRoot, "src"),
      },
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: path.join(webAppRoot, "index.html"),
      },
    },
  },
});
