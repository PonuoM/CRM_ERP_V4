import fs from 'fs';
import path from 'path';

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
  const configPath = path.join(process.cwd(), 'api', 'config.php');

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Extract values using regex patterns
    const dbHost = configContent.match(/\$DB_HOST\s*=\s*getenv\('DB_HOST'\)\s*\?\s*:\s*['"]([^'"]+)['"]/);
    const dbPort = configContent.match(/\$DB_PORT\s*=\s*getenv\('DB_PORT'\)\s*\?\s*:\s*['"]([^'"]+)['"]/);
    const dbName = configContent.match(/\$DB_NAME\s*=\s*getenv\('DB_NAME'\)\s*\?\s*:\s*['"]([^'"]+)['"]/);
    const dbUser = configContent.match(/\$DB_USER\s*=\s*getenv\('DB_USER'\)\s*\?\s*:\s*['"]([^'"]+)['"]/);
    const dbPass = configContent.match(/\$DB_PASS\s*=\s*getenv\('DB_PASS'\)\s*\?\s*:\s*['"]([^'"]+)['"]/);

    if (!dbHost || !dbPort || !dbName || !dbUser || !dbPass) {
      throw new Error('Could not extract all required database configuration values from api/config.php');
    }

    return {
      host: dbHost[1],
      port: dbPort[1],
      name: dbName[1],
      user: dbUser[1],
      pass: dbPass[1]
    };
  } catch (error) {
    console.error('Error reading database configuration:', error);
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
 * Generate Prisma configuration object using database configuration from api/config.php
 */
function generatePrismaConfig() {
  const dbUrl = generateDatabaseUrl();

  return {
    schema: "prisma/schema.prisma",
    migrations: {
      path: "prisma/migrations",
    },
    engine: "classic",
    datasource: {
      url: dbUrl,
    },
  };
}

export { readDbConfig, generateDatabaseUrl, generatePrismaConfig };
