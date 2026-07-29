#!/usr/bin/env node
// Bundles the extension's TypeScript entry points with esbuild and copies static assets into dist/.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

// The MV3 service worker is loaded with "type": "module" and can stay a single ESM bundle.
const esmEntryPoints = {
  "background/service-worker": "src/background/service-worker.ts",
};

// Everything else is loaded via a plain <script src> (offscreen/popup/options HTML) or a
// classic content_scripts entry — neither supports top-level import/export, so bundle as IIFE.
const iifeEntryPoints = {
  "offscreen/offscreen": "src/offscreen/offscreen.ts",
  "content/meet-content": "src/content/meet-content.ts",
  "content/zoom-content": "src/content/zoom-content.ts",
  "popup/popup": "src/popup/popup.ts",
  "options/options": "src/options/options.ts",
};

function copyStaticAssets() {
  cpSync(join(root, "manifest.json"), join(distDir, "manifest.json"));
  mkdirSync(join(distDir, "offscreen"), { recursive: true });
  mkdirSync(join(distDir, "popup"), { recursive: true });
  mkdirSync(join(distDir, "options"), { recursive: true });
  mkdirSync(join(distDir, "content"), { recursive: true });
  cpSync(join(root, "src", "offscreen", "offscreen.html"), join(distDir, "offscreen", "offscreen.html"));
  cpSync(join(root, "src", "popup", "popup.html"), join(distDir, "popup", "popup.html"));
  cpSync(join(root, "src", "popup", "popup.css"), join(distDir, "popup", "popup.css"));
  cpSync(join(root, "src", "options", "options.html"), join(distDir, "options", "options.html"));
  cpSync(join(root, "src", "content", "banner.css"), join(distDir, "content", "banner.css"));
}

function commonOptions(format, entryPoints) {
  return {
    entryPoints,
    entryNames: "[dir]/[name]",
    outdir: distDir,
    bundle: true,
    format,
    target: "chrome116",
    sourcemap: watch ? "inline" : false,
    minify: !watch,
    logLevel: "info",
  };
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

if (watch) {
  const esmCtx = await esbuild.context(commonOptions("esm", esmEntryPoints));
  const iifeCtx = await esbuild.context(commonOptions("iife", iifeEntryPoints));
  copyStaticAssets();
  await Promise.all([esmCtx.watch(), iifeCtx.watch()]);
  console.log("Watching for changes... (static assets are copied once at startup)");
} else {
  await esbuild.build(commonOptions("esm", esmEntryPoints));
  await esbuild.build(commonOptions("iife", iifeEntryPoints));
  copyStaticAssets();
  console.log(`Build complete -> ${distDir}`);
}
