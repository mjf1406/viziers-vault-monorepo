import { cpSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const migrationsSource = path.resolve(desktopRoot, "../../packages/db/migrations");
const migrationsDest = path.join(desktopRoot, "resources", "migrations");

if (!existsSync(migrationsSource)) {
  console.warn("copy-migrations: source not found:", migrationsSource);
  process.exit(0);
}

mkdirSync(path.dirname(migrationsDest), { recursive: true });
cpSync(migrationsSource, migrationsDest, { recursive: true });
console.log("copy-migrations: copied to", migrationsDest);
