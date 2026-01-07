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

// Parse args
const args = process.argv.slice(2);
const forceZip = args.includes("--zip");

function main(): void {
  console.log("Starting host build...");

  let preservedVendorZipPath: string | null = null;
  const vendorZipDest = path.join(hostDir, "api", "vendor", "vendor.zip");
  const tempVendorZip = path.join(projectRoot, "temp_vendor.zip");

  try {
    // 1. Check if we can preserve vendor.zip
    if (!forceZip && fs.existsSync(vendorZipDest)) {
      console.log("Found existing vendor.zip. Preserving...");
      fs.copyFileSync(vendorZipDest, tempVendorZip);
      preservedVendorZipPath = tempVendorZip;
    }

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

    // Create vendor dir
    if (!fs.existsSync(vendorDestDir)) {
      fs.mkdirSync(vendorDestDir, { recursive: true });
    }

    let vendorZipReady = false;

    // 2. Restore preserved zip if available
    if (preservedVendorZipPath && fs.existsSync(preservedVendorZipPath)) {
      console.log("Restoring preserved vendor.zip...");
      fs.copyFileSync(preservedVendorZipPath, vendorZipDest);
      fs.unlinkSync(preservedVendorZipPath); // Clean up temp
      vendorZipReady = true;
    }

    // 3. Create zip if not ready
    if (!vendorZipReady && fs.existsSync(vendorSrc)) {
      console.log("Processing api/vendor -> vendor.zip...");

      // Use tar (available on Windows 10/11) to create zip with forward slashes
      // -a: Auto-detect compression (zip) based on extension
      // -c: Create
      // -f: File
      // -C: Change directory (so zip contents are relative to vendor root)
      const cmd = `tar -a -c -f "${vendorZipDest}" -C "${vendorSrc}" .`;

      try {
        console.log("Compressing vendor folder using tar...");
        execSync(cmd, { stdio: "inherit" });
        console.log("Vendor zip created successfully.");
      } catch (e) {
        console.error("Failed to create vendor zip:", e);
        if (fs.existsSync(vendorZipDest)) {
          console.log("Removing partial/corrupt vendor.zip...");
          fs.unlinkSync(vendorZipDest);
        }
        throw e;
      }
    } else if (vendorZipReady) {
      console.log("Skipped vendor compression (using preserved file).");
    }

    // Copy and update .htaccess
    console.log("Processing .htaccess...");
    if (fs.existsSync(htaccessFile)) {
      let htaccessContent = fs.readFileSync(htaccessFile, "utf-8");

      // Read APP_BASE_PATH from appBasePath.ts
      const appBasePathFile = path.join(projectRoot, "appBasePath.ts");
      let appBasePath = "/"; // Default fallback
      if (fs.existsSync(appBasePathFile)) {
        const appBaseContent = fs.readFileSync(appBasePathFile, "utf-8");
        const lines = appBaseContent.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments
          if (trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

          // Match const APP_BASE_PATH = '/.../';
          const match = trimmed.match(/const\s+APP_BASE_PATH\s*=\s*['"]([^'"]+)['"]/);
          if (match) {
            appBasePath = match[1];
            console.log(`Found APP_BASE_PATH: ${appBasePath}`);
            break; // Stop after first valid match
          }
        }
      }

      // Replace RewriteBase /mini_erp/ (or whatever is there) with new base path
      // Regex looks for "RewriteBase /.../" and replaces it
      htaccessContent = htaccessContent.replace(
        /RewriteBase\s+\/[^\s]*/,
        `RewriteBase ${appBasePath}`
      );

      fs.writeFileSync(path.join(hostDir, ".htaccess"), htaccessContent);
      console.log(`Copied .htaccess and updated RewriteBase to ${appBasePath}`);
    } else {
      console.log("No .htaccess found to copy.");
    }

    // Replace api/config.php with root config.php
    console.log("Replacing host/api/config.php with project-root config.php...");
    copyFileIfExists(
      rootConfigFile,
      path.join(hostDir, "api", "config.php"),
      "api/config.php",
    );

    console.log("Host build completed successfully.");
    console.log(`Host folder ready at: ${hostDir}`);
    console.log(
      "Contents: api/, dist/, .htaccess, and api/config.php replaced.",
    );
  } catch (err) {
    // Cleanup temp if exists and we crashed
    if (fs.existsSync(tempVendorZip)) {
      fs.unlinkSync(tempVendorZip);
    }

    const error = err as Error;
    console.error("Host build failed:", error.message);
    process.exit(1);
  }
}

main();

