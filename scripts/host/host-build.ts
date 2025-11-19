#!/usr/bin/env node

/**
 * Host Build Script for CRM_ERP_V4
 * This script creates a "host" folder with api, dist folders and necessary files for deployment
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory
const projectRoot = path.join(__dirname, "..", "..");

// Define paths
const hostDir = path.join(projectRoot, "host");
const distDir = path.join(projectRoot, "dist");
const apiDir = path.join(projectRoot, "api");
const prismaDir = path.join(projectRoot, "prisma");
const scriptsDir = path.join(projectRoot, "scripts");
const htaccessFile = path.join(projectRoot, ".htaccess");
const rootConfigFile = path.join(projectRoot, "config.php");

// Directories and files to exclude when copying
const excludedPaths = [
  "uploads", // Exclude the entire uploads directory in api
];

// Files to copy for Prisma and other essentials
const requiredFiles = [
  {
    src: path.join(projectRoot, "package.json"),
    dest: path.join(hostDir, "package.json"),
    description: "package.json - Node.js dependencies and scripts",
  },
  {
    src: path.join(prismaDir, "schema.prisma"),
    dest: path.join(hostDir, "prisma", "schema.prisma"),
    description: "prisma/schema.prisma - Database schema definition",
  },
  {
    src: path.join(scriptsDir, "sync-db-url.ts"),
    dest: path.join(hostDir, "scripts", "sync-db-url.ts"),
    description: "scripts/sync-db-url.ts - Database URL sync script",
  },
  {
    src: path.join(scriptsDir, "prisma", "db-push.ts"),
    dest: path.join(hostDir, "scripts", "prisma", "db-push.ts"),
    description: "scripts/prisma/db-push.ts - Database push script",
  },
  {
    src: path.join(apiDir, "config.php"),
    dest: path.join(hostDir, "api", "config.php"),
    description: "api/config.php - Database configuration",
  },
  {
    src: path.join(apiDir, "npm"),
    dest: path.join(hostDir, "api", "npm"),
    description: "api/npm - Database management API endpoints",
  },
];

/**
 * Check if a path should be excluded based on the excluded paths list
 */
function shouldExcludePath(filePath: string): boolean {
  const relativePath = path.relative(apiDir, filePath);
  return excludedPaths.some(
    (excludedPath) =>
      relativePath === excludedPath ||
      relativePath.startsWith(excludedPath + path.sep),
  );
}

/**
 * Recursively copy a directory, excluding specified paths
 */
function copyDirectory(
  src: string,
  dest: string,
  excludeFn?: (src: string) => boolean,
): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip if this path should be excluded
    if (excludeFn && excludeFn(srcPath)) {
      console.log(`   Skipping: ${path.relative(projectRoot, srcPath)}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, excludeFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy a file or directory if it exists, creating the directory structure if needed
 */
function copyFileOrDirIfExists(
  src: string,
  dest: string,
  description?: string,
): boolean {
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Check if src is a directory
    if (fs.statSync(src).isDirectory()) {
      copyDirectory(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }

    if (description) {
      console.log(`   ${description}`);
    }
    return true;
  }
  return false;
}

/**
 * Main function to create the host folder with necessary files
 */
function main(): void {
  console.log("🚀 Starting host build process...");

  try {
    // Clean and create host directory
    console.log("📁 Creating host directory...");
    if (fs.existsSync(hostDir)) {
      fs.rmSync(hostDir, { recursive: true, force: true });
    }
    fs.mkdirSync(hostDir, { recursive: true });

    // Run npm run build
    console.log("🔨 Building the project...");
    execSync("npm run build", { stdio: "inherit", cwd: projectRoot });

    // Copy dist folder to host
    console.log("📦 Copying dist folder...");
    copyDirectory(distDir, path.join(hostDir, "dist"));

    // Copy api folder to host (excluding uploads)
    console.log("📋 Copying api folder (excluding uploads)...");
    copyDirectory(apiDir, path.join(hostDir, "api"), shouldExcludePath);

    // Copy .htaccess if it exists
    console.log("🔧 Copying .htaccess (if exists)...");
    copyFileIfExists(
      htaccessFile,
      path.join(hostDir, ".htaccess"),
      ".htaccess - Apache configuration",
    );

    // Copy necessary files for Prisma
    console.log("🗃️ Copying necessary files for Prisma...");
    for (const file of requiredFiles) {
      copyFileOrDirIfExists(file.src, file.dest, file.description);
    }

    // Final step: Replace config.php with the production version
    console.log(
      "🔄 Final step: Replacing config.php with production version...",
    );
    fs.copyFileSync(rootConfigFile, path.join(hostDir, "api", "config.php"));
    console.log("   ✅ Replaced host/api/config.php with production version");

    // Create a README for deployment instructions
    const readmeContent = `# Deployment Instructions

This folder contains the essential files for deploying the CRM_ERP_V4 application to a hosting server.

## Files Structure
- \`dist/\`: The built React application
- \`api/\`: PHP API backend
  - Note: The uploads directory has been excluded and will need to be created on the server
  - \`api/npm/\`: HTTP API endpoints for database operations
- \`.htaccess\`: Apache configuration for routing (if exists)
- \`package.json\`: Node.js dependencies
- \`prisma/schema.prisma\`: Database schema
- \`scripts/\`: Scripts for database operations

## Deployment Steps

1. Upload the entire \`host\` folder to your hosting server
2. Create an empty \`api/uploads\` directory on the server with appropriate permissions
3. Configure your web server (Apache/Nginx) to serve the \`dist\` folder as the web root
4. Ensure API requests to the \`api\` folder are properly routed
5. Replace \`api/config.php\` with your production configuration file
   - The script has already copied the config.php file from the project root to host/api/config.php
   - You should modify this file with your production database credentials
6. Install Node.js dependencies: \`npm install\`
7. Push the database schema: \`npm run db:push\`

## Additional Notes

- The application expects to connect to a MySQL database
- Make sure the database user has the necessary privileges
- For Apache, ensure .htaccess files are allowed (AllowOverride All)
- The uploads directory was excluded from this build to reduce file size and avoid unnecessary file transfers
- You may need to create additional subdirectories within uploads depending on your application needs
`;

    fs.writeFileSync(path.join(hostDir, "README.md"), readmeContent);

    console.log("✅ Host build completed successfully!");
    console.log(`📂 All files are ready in: ${hostDir}`);
    console.log(
      "📖 Check README.md in the host folder for deployment instructions",
    );
  } catch (error) {
    console.error(`❌ Host build failed: ${error.message}`);
    process.exit(1);
  }
}

// Run main function if this script is executed directly
main();
