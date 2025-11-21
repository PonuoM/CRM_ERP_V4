#!/usr/bin/env node

/**
 * Database seed script for Prisma.
 *
 * This script:
 * 1) Syncs DATABASE_URL from api/config.php into Prisma/.env
 * 2) Runs scripts/seed-db.ts which seeds data via PrismaClient
 *    using the models defined in prisma/schema.prisma.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const syncScriptPath = path.join(__dirname, "..", "sync-db-url.ts");
const seedScriptPath = path.join(__dirname, "..", "seed-db.ts");

function runStep(description: string, command: string) {
  console.log(`[db:seed] ${description}`);
  execSync(command, { stdio: "inherit" });
}

async function main() {
  console.log("[db:seed] Starting database seed...");

  // Ensure Prisma uses the same database URL as the PHP app
  runStep(
    "Syncing database URL from api/config.php...",
    `npx tsx "${syncScriptPath}"`,
  );

  // Run the actual Prisma-based seeding logic
  runStep(
    "Running seed-db.ts (Prisma seeding)...",
    `npx tsx "${seedScriptPath}"`,
  );

  console.log("[db:seed] Database seeding completed successfully.");
}

main().catch((error) => {
  console.error("[db:seed] Seeding failed:", error);
  process.exit(1);
});

