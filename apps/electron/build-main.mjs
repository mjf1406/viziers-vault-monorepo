import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, "src/main/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(__dirname, "dist/main/index.js"),
  external: ["electron", "@electric-sql/pglite"],
  sourcemap: true,
  target: "node20",
});
