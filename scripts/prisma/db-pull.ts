#!/usr/bin/env node

/**
 * Database pull script for Prisma
 * This script pulls the database schema and updates the Prisma client
 */

import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the sync-db-url script
const syncScriptPath = path.join(__dirname, "..", "sync-db-url.ts");

console.log("🔄 Pulling database schema...");

try {
  // First sync the database URL
  console.log("🔗 Syncing database URL...");
  execSync(`npx tsx "${syncScriptPath}"`, { stdio: "inherit" });

  // Now pull the database schema
  console.log("📥 Pulling database schema...");
  execSync("npx prisma db pull --force", { stdio: "inherit" });

  // Generate the Prisma client
  console.log("🏗️ Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit" });

  console.log("✅ Database pull and client generation completed successfully!");
} catch (error) {
  console.error(`❌ Operation failed: ${error.message}`);
  process.exit(1);
}
