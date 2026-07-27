#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const isWindows = platform() === "win32";
const apiDir = join(root, "apps", "api");
const venvPython = isWindows
  ? join(apiDir, ".venv", "Scripts", "python.exe")
  : join(apiDir, ".venv", "bin", "python");
const pythonCmd = existsSync(venvPython) ? venvPython : "python";

const action = process.argv[2] === "clear" ? "clear" : "seed";
const result = spawnSync(pythonCmd, ["-m", "app.seed", action], { cwd: apiDir, stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
