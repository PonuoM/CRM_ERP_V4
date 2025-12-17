#!/usr/bin/env node

/**
 * Host Build Script for CRM_ERP_V4
 *
 * Creates a clean "host" folder with ONLY:
 * - dist/
 * - api/   (excluding api/uploads)
 * - .htaccess (if exists)
 * - api/config.php replaced by project-root config.php
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, "..", "..");
const hostDir = path.join(projectRoot, "host");
const distDir = path.join(projectRoot, "dist");
const apiDir = path.join(projectRoot, "api");
const htaccessFile = path.join(projectRoot, ".htaccess");
const rootConfigFile = path.join(projectRoot, "config.php");

const excludedApiSubdirs = ["uploads", "vendor"];

function shouldExcludeApiPath(filePath: string): boolean {
  const relative = path.relative(apiDir, filePath);
  return excludedApiSubdirs.some(
    (name) =>
      relative === name || relative.startsWith(name + path.sep),
  );
}

function copyDirectory(
  src: string,
  dest: string,
  excludeFn?: (p: string) => boolean,
): void {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (excludeFn && excludeFn(srcPath)) {
      console.log(`Skipping ${path.relative(projectRoot, srcPath)}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, excludeFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyFileIfExists(src: string, dest: string, label?: string): void {
  if (!fs.existsSync(src)) return;

  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  if (label) {
    console.log(`Copied ${label}`);
  }
}

function main(): void {
  console.log("Starting host build...");

  try {
    // Clean host directory
    if (fs.existsSync(hostDir)) {
      console.log("Removing existing host directory...");
      fs.rmSync(hostDir, { recursive: true, force: true });
    }
    fs.mkdirSync(hostDir, { recursive: true });

    // Build frontend
    console.log("Running npm run build...");
    execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });

    // Copy dist/
    console.log("Copying dist/ to host/dist...");
    copyDirectory(distDir, path.join(hostDir, "dist"));

    // Copy api/ (excluding uploads and vendor)
    console.log("Copying api/ to host/api (excluding uploads and vendor)...");
    copyDirectory(apiDir, path.join(hostDir, "api"), shouldExcludeApiPath);

    // Handle api/vendor special case (Compress to zip)
    const vendorSrc = path.join(apiDir, "vendor");
    const vendorDestDir = path.join(hostDir, "api", "vendor");
    if (fs.existsSync(vendorSrc)) {
      console.log("Processing api/vendor -> vendor.zip...");
      if (!fs.existsSync(vendorDestDir)) {
        fs.mkdirSync(vendorDestDir, { recursive: true });
      }

      const vendorZipPath = path.join(vendorDestDir, "vendor.zip");
      const psSrc = path.join(vendorSrc, "*");

      // Use PowerShell to compress. Note: standard string interpolation works for paths on Windows
      // we wrap paths in quotes to handle potential spaces.
      const cmd = `powershell -Command "Compress-Archive -Path '${psSrc}' -DestinationPath '${vendorZipPath}' -Force"`;

      try {
        console.log("Compressing vendor folder...");
        execSync(cmd, { stdio: "inherit" });
        console.log("Vendor zip created successfully.");
      } catch (e) {
        console.error("Failed to create vendor zip:", e);
        // Don't fail the whole build if zip fails? Or should we?
        // Usually build should fail.
        throw e;
      }
    }

    // Copy .htaccess
    console.log("Copying .htaccess (if exists)...");
    copyFileIfExists(htaccessFile, path.join(hostDir, ".htaccess"), ".htaccess");

    // Replace api/config.php with root config.php
    console.log("Replacing host/api/config.php with project-root config.php...");
    copyFileIfExists(
      rootConfigFile,
      path.join(hostDir, "api", "config.php"),
      "api/config.php",
    );

    console.log("Host build completed successfully.");
    console.log(`Host folder ready at: ${hostDir}`);
    console.log("Contents: api/, dist/, .htaccess, and api/config.php replaced.");
  } catch (err) {
    const error = err as Error;
    console.error("Host build failed:", error.message);
    process.exit(1);
  }
}

main();

