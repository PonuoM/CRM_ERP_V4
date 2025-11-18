import fs from "fs";
import path from "path";

interface DbConfig {
  host: string;
  port: string;
  name: string;
  user: string;
  pass: string;
}

/**
 * Read database configuration from api/config.php file
 * Extracts DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASS values
 */
function readDbConfig(): DbConfig {
  const configPath = path.join(process.cwd(), "api", "config.php");

  try {
    const configContent = fs.readFileSync(configPath, "utf8");

    // Extract values using regex patterns
    const dbHost = configContent.match(
      /\$DB_HOST\s*=\s*getenv\("DB_HOST"\)\s*\?\s*:\s*["']([^"']+)["']/,
    );
    const dbPort = configContent.match(
      /\$DB_PORT\s*=\s*getenv\("DB_PORT"\)\s*\?\s*:\s*["']([^"']+)["']/,
    );
    const dbName = configContent.match(
      /\$DB_NAME\s*=\s*getenv\("DB_NAME"\)\s*\?\s*:\s*["']([^"']+)["']/,
    );
    const dbUser = configContent.match(
      /\$DB_USER\s*=\s*getenv\("DB_USER"\)\s*\?\s*:\s*["']([^"']+)["']/,
    );
    const dbPass = configContent.match(
      /\$DB_PASS\s*=\s*getenv\("DB_PASS"\)\s*\?\s*:\s*["']([^"']+)["']/,
    );

    if (!dbHost || !dbPort || !dbName || !dbUser || !dbPass) {
      // Try an alternative pattern if the first one doesn't match
      const dbHostAlt = configContent.match(/\$DB_HOST\s*=\s*["']([^"']+)["']/);
      const dbPortAlt = configContent.match(/\$DB_PORT\s*=\s*["']([^"']+)["']/);
      const dbNameAlt = configContent.match(/\$DB_NAME\s*=\s*["']([^"']+)["']/);
      const dbUserAlt = configContent.match(/\$DB_USER\s*=\s*["']([^"']+)["']/);
      const dbPassAlt = configContent.match(/\$DB_PASS\s*=\s*["']([^"']+)["']/);

      if (!dbHostAlt || !dbPortAlt || !dbNameAlt || !dbUserAlt || !dbPassAlt) {
        throw new Error(
          "Could not extract all required database configuration values from api/config.php",
        );
      }

      return {
        host: dbHostAlt[1],
        port: dbPortAlt[1],
        name: dbNameAlt[1],
        user: dbUserAlt[1],
        pass: dbPassAlt[1],
      };
    }

    return {
      host: dbHost[1],
      port: dbPort[1],
      name: dbName[1],
      user: dbUser[1],
      pass: dbPass[1],
    };
  } catch (error) {
    console.error("Error reading database configuration:", error);
    throw error;
  }
}

/**
 * Generate MySQL connection URL from database configuration
 */
function generateDatabaseUrl(): string {
  const config = readDbConfig();
  return `mysql://${config.user}:${config.pass}@${config.host}:${config.port}/${config.name}`;
}

/**
 * Update Prisma schema with the database URL from api/config.php
 */
function updatePrismaSchema(): void {
  const dbUrl = generateDatabaseUrl();
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

  try {
    let schemaContent = fs.readFileSync(schemaPath, "utf8");

    // Replace the datasource URL line
    schemaContent = schemaContent.replace(
      /url\s*=\s*["'][^"']+["']/,
      `url = "${dbUrl}"`,
    );

    fs.writeFileSync(schemaPath, schemaContent, "utf8");
    console.log(
      "✅ Updated Prisma schema with database URL from api/config.php",
    );
    console.log(`   Database URL: ${dbUrl}`);
  } catch (error) {
    console.error("Error updating Prisma schema:", error);
    throw error;
  }
}

/**
 * Update .env file with the database URL from api/config.php
 */
function updateEnvFile(): void {
  const dbUrl = generateDatabaseUrl();
  const envPath = path.join(process.cwd(), ".env");

  try {
    let envContent = "";

    // Create .env file if it doesn't exist
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    } else {
      envContent = "";
    }

    // Update or add DATABASE_URL
    if (envContent.includes("DATABASE_URL=")) {
      envContent = envContent.replace(
        /^DATABASE_URL=.*$/m,
        `DATABASE_URL="${dbUrl}"`,
      );
    } else {
      envContent += `\nDATABASE_URL="${dbUrl}"\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("✅ Updated .env file with database URL from api/config.php");
  } catch (error) {
    console.error("Error updating .env file:", error);
    throw error;
  }
}

/**
 * Main function to synchronize database URL between api/config.php and Prisma files
 */
function main(): void {
  console.log("🔄 Syncing database URL from api/config.php to Prisma files...");

  try {
    updatePrismaSchema();
    updateEnvFile();
    console.log("✅ Database URL synchronization completed successfully!");
  } catch (error) {
    console.error("❌ Error during synchronization:", error);
    process.exit(1);
  }
}

// Run main function if this script is executed directly
main();

export { readDbConfig, generateDatabaseUrl, updatePrismaSchema, updateEnvFile };
