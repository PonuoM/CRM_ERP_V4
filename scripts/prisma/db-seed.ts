#!/usr/bin/env node

/**
 * Database seed script for Prisma
 * This script seeds the database with initial data
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the sync-db-url script
const syncScriptPath = path.join(__dirname, "..", "sync-db-url.ts");
// Path to the seed-db script
const seedScriptPath = path.join(__dirname, "..", "seed-db.ts");

console.log("🌱 Seeding database...");

try {
  // First sync the database URL
  console.log("🔗 Syncing database URL...");
  execSync(`npx tsx "${syncScriptPath}"`, { stdio: "inherit" });

  // Now seed the database
  console.log("🌱 Seeding database...");
  execSync(`npx tsx "${seedScriptPath}"`, { stdio: "inherit" });

  console.log("✅ Database seeding completed successfully!");
} catch (error) {
  console.error(`❌ Operation failed: ${error.message}`);
  process.exit(1);
}
