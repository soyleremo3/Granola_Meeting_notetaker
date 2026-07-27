#!/usr/bin/env node
// Runs the FastAPI backend and Next.js frontend together for local development.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const isWindows = platform() === "win32";
const webDir = join(root, "apps", "web");
const apiDir = join(root, "apps", "api");

const venvPython = isWindows
  ? join(apiDir, ".venv", "Scripts", "python.exe")
  : join(apiDir, ".venv", "bin", "python");
const pythonCmd = existsSync(venvPython) ? venvPython : "python";

const children = [];

function launch(name, cmd, args, cwd, useShell = false) {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: useShell });
  child.on("exit", (code) => {
    console.log(`[${name}] exited with code ${code}`);
    shutdown();
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Backend  -> http://localhost:8000");
console.log("Frontend -> http://localhost:3000\n");

launch("api", pythonCmd, ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], apiDir);
launch("web", "npm", ["run", "dev"], webDir, isWindows);
