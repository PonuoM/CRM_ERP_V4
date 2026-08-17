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

// Vite emits content-hashed bundles (index-<hash>.js). Copying without pruning
// leaves every past build behind forever — that is what filled the host quota.
// Keep recent orphans for a grace period so browsers holding a cached index.html
// can still fetch the bundle it points at.
const ASSET_KEEP_DAYS = 7;

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

function pruneStaleAssets(destAssetsDir: string, srcAssetsDir: string): void {
  if (!fs.existsSync(destAssetsDir) || !fs.existsSync(srcAssetsDir)) return;

  const fresh = new Set(fs.readdirSync(srcAssetsDir));
  const cutoff = Date.now() - ASSET_KEEP_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  let freed = 0;
  let kept = 0;

  for (const entry of fs.readdirSync(destAssetsDir, { withFileTypes: true })) {
    if (!entry.isFile() || fresh.has(entry.name)) continue;

    const filePath = path.join(destAssetsDir, entry.name);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs > cutoff) {
      kept++;
      continue;
    }

    fs.unlinkSync(filePath);
    removed++;
    freed += stat.size;
  }

  console.log(
    `Pruned ${removed} stale asset(s), freed ${(freed / 1048576).toFixed(1)} MB` +
      (kept ? ` (kept ${kept} within ${ASSET_KEEP_DAYS}-day grace window)` : ""),
  );
}

function main(): void {
  if (!fs.existsSync(betaDir)) {
    console.error(`beta_test directory not found: ${betaDir}`);
    process.exit(1);
  }

  console.log("Copying frontend (dist/) to beta_test...");
  copyDirectory(distDir, betaDir);
  pruneStaleAssets(path.join(betaDir, "assets"), path.join(distDir, "assets"));
  console.log("Frontend done.");

  console.log("Syncing api/ to beta_test/api/ (excluding config, uploads, vendor)...");
  copyDirectory(apiDir, path.join(betaDir, "api"), shouldExclude);
  console.log("API done.");

  const priceImagesDir = path.join(betaDir, "api", "uploads", "price_images");
  if (!fs.existsSync(priceImagesDir)) fs.mkdirSync(priceImagesDir, { recursive: true });

  console.log("\n✅ Beta deploy complete → http://localhost/beta_test/");
}

main();
