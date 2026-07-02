#!/usr/bin/env node
/**
 * Beta Deploy Script
 * Copies built frontend (dist/) + API to C:/AppServ/www/beta_test/
 * Run after: npm run build  (or use: npm run beta:build which does both)
 *
 * Excludes: api/config.php, api/uploads/, api/vendor/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const apiDir = path.join(projectRoot, "api");
const betaDir = "C:\\AppServ\\www\\beta_test";

const excludedApiPaths = ["uploads", "vendor", "config.php"];

function shouldExclude(filePath: string): boolean {
  const relative = path.relative(apiDir, filePath);
  return excludedApiPaths.some(
    (name) => relative === name || relative.startsWith(name + path.sep)
  );
}

function copyDirectory(src: string, dest: string, excludeFn?: (p: string) => boolean): void {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (excludeFn && excludeFn(srcPath)) continue;
    if (entry.isDirectory()) copyDirectory(srcPath, destPath, excludeFn);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function main(): void {
  if (!fs.existsSync(betaDir)) {
    console.error(`beta_test directory not found: ${betaDir}`);
    process.exit(1);
  }

  console.log("Copying frontend (dist/) to beta_test...");
  copyDirectory(distDir, betaDir);
  console.log("Frontend done.");

  console.log("Syncing api/ to beta_test/api/ (excluding config, uploads, vendor)...");
  copyDirectory(apiDir, path.join(betaDir, "api"), shouldExclude);
  console.log("API done.");

  const priceImagesDir = path.join(betaDir, "api", "uploads", "price_images");
  if (!fs.existsSync(priceImagesDir)) fs.mkdirSync(priceImagesDir, { recursive: true });

  console.log("\n✅ Beta deploy complete → http://localhost/beta_test/");
}

main();
