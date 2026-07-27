#!/usr/bin/env node
// Cross-platform setup: installs frontend deps and creates the backend virtualenv.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const isWindows = platform() === "win32";

function run(cmd, args, cwd, useShell = false) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (in ${cwd})`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: useShell });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function copyEnvExample(dir) {
  const example = join(dir, ".env.example");
  const target = join(dir, dir.endsWith("web") ? ".env.local" : ".env");
  if (!existsSync(target) && existsSync(example)) {
    copyFileSync(example, target);
    console.log(`Oluşturuldu: ${target}`);
  }
}

const webDir = join(root, "apps", "web");
const apiDir = join(root, "apps", "api");

console.log("== Frontend kurulumu (apps/web) ==");
run("npm", ["install"], webDir, isWindows);
copyEnvExample(webDir);

console.log("\n== Backend kurulumu (apps/api) ==");
const venvDir = join(apiDir, ".venv");
if (!existsSync(venvDir)) {
  run("python", ["-m", "venv", ".venv"], apiDir, isWindows);
}
const pip = isWindows ? join(venvDir, "Scripts", "pip.exe") : join(venvDir, "bin", "pip");
run(pip, ["install", "--upgrade", "pip"], apiDir);
run(pip, ["install", "-r", "requirements.txt"], apiDir);
copyEnvExample(apiDir);

console.log("\nKurulum tamamlandı. `npm run dev` ile başlatabilirsiniz.");
