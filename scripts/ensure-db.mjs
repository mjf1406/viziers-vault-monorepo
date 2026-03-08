import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const dockerResult = spawnSync(
  "docker",
  ["compose", "up", "-d", "--wait", "postgres"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
  }
);

if (dockerResult.status !== 0) {
  console.error("\nDocker Compose failed. Is Docker Desktop running?");
  process.exit(1);
}

execSync("pnpm --filter @workspace/db migrate", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});
