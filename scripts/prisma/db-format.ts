#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Field = {
  name: string;
  prismaType: string;
  nativeType?: string;
  nativeArgs?: string;
  isId: boolean;
  isAutoIncrement: boolean;
};

type Model = {
  name: string;
  fields: Field[];
};

const SCALAR_TYPES = new Set([
  "Int",
  "BigInt",
  "String",
  "DateTime",
  "Decimal",
  "Boolean",
  "Json",
  "Float",
]);

function parseModels(schema: string): Model[] {
  const models: Model[] = [];
  const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schema)) !== null) {
    const [, name, body] = match;
    const lines = body.split("\n");
    const fields: Field[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;

      const fieldName = parts[0];
      let prismaType = parts[1];
      const attributeTokens = parts.slice(2);
      const attributes = attributeTokens.join(" ");

      // Skip list fields (relations arrays)
      if (prismaType.endsWith("[]")) continue;

      // Handle optional marker
      prismaType = prismaType.replace("?", "");

      // Skip pure relation fields (those that only define @relation and no actual column)
      if (attributes.includes("@relation(")) continue;

      const isId = attributes.includes("@id");
      const isAutoIncrement = attributes.includes("autoincrement()");

      const nativeMatch =
        attributes.match(/@db\.(\w+)(\(([^)]*)\))?/) || undefined;
      const nativeType = nativeMatch ? nativeMatch[1] : undefined;
      const nativeArgs = nativeMatch ? nativeMatch[3] : undefined;

      fields.push({
        name: fieldName,
        prismaType,
        nativeType,
        nativeArgs,
        isId,
        isAutoIncrement,
      });
    }

    if (fields.length) {
      models.push({ name, fields });
    }
  }

  return models;
}

function mapColumnType(field: Field): string {
  const { prismaType, nativeType, nativeArgs } = field;

  if (nativeType) {
    switch (nativeType) {
      case "VarChar":
        return `VARCHAR(${nativeArgs ?? "255"})`;
      case "Text":
        return "TEXT";
      case "DateTime":
        return "DATETIME";
      case "Timestamp":
        return "TIMESTAMP";
      case "Date":
        return "DATE";
      case "Decimal":
        return `DECIMAL(${nativeArgs ?? "10,2"})`;
      case "BigInt":
        return "BIGINT";
      case "Int":
        return "INT";
      case "Bool":
      case "Boolean":
        return "BOOLEAN";
      default:
        break;
    }
  }

  switch (prismaType) {
    case "Int":
      return "INT";
    case "BigInt":
      return "BIGINT";
    case "String":
      return "VARCHAR(255)";
    case "DateTime":
      return "DATETIME";
    case "Decimal":
      return "DECIMAL(10,2)";
    case "Boolean":
      return "BOOLEAN";
    case "Json":
      return "JSON";
    case "Float":
      return "FLOAT";
    default:
      return "TEXT";
  }
}

type SqlOutput = {
  ddl: string;
  checks: string;
};

function generateSql(models: Model[]): SqlOutput {
  const ddlStatements: string[] = [];
  const checkStatements: string[] = [];
  const tableNames: string[] = [];
  const tableColumns: string[] = [];

  for (const model of models) {
    const tableName = model.name;
    tableNames.push(tableName);
    const pkField = model.fields.find((f) => f.isId);

    const columnDefs: string[] = [];
    for (const field of model.fields) {
      tableColumns.push(`${tableName}.${field.name}`);
      const colType = mapColumnType(field);
      const isPk = pkField && pkField.name === field.name;
      const nullability = isPk ? "NOT NULL" : "NULL";
      const autoInc =
        isPk && field.isAutoIncrement && (field.prismaType === "Int" || field.prismaType === "BigInt")
          ? "AUTO_INCREMENT"
          : "";

      columnDefs.push(
        `  \`${field.name}\` ${colType} ${autoInc} ${nullability}`.trim().replace(/\s+/g, " "),
      );
    }

    if (pkField) {
      columnDefs.push(`  PRIMARY KEY (\`${pkField.name}\`)`);
    }

    const createTable = [
      `CREATE TABLE IF NOT EXISTS \`${tableName}\` (`,
      columnDefs.join(",\n"),
      ");",
    ].join("\n");

    ddlStatements.push(createTable);

    // Generate ALTER TABLE ADD COLUMN for non-PK columns,
    // wrapped in a dynamic check so it only runs if the column
    // does not already exist (works even without IF NOT EXISTS).
    for (const field of model.fields) {
      if (pkField && field.name === pkField.name) continue;
      const colType = mapColumnType(field);
      const ddl = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${field.name}\` ${colType} NULL`;
      const alterWithCheck = [
        "SET @sql := IF((",
        "  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS",
        `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${field.name}'`,
        ") = 0,",
        `  '${ddl.replace(/'/g, "''")}',`,
        "  'SELECT 1'",
        ");",
        "PREPARE stmt FROM @sql;",
        "EXECUTE stmt;",
        "DEALLOCATE PREPARE stmt;",
      ].join("\n");
      ddlStatements.push(alterWithCheck);
    }

    ddlStatements.push(""); // blank line between tables
  }

  if (tableNames.length && tableColumns.length) {
    const tableList = tableNames.map((t) => `'${t}'`).join(", ");
    const columnList = tableColumns.map((c) => `'${c}'`).join(", ");

    checkStatements.push(
      "-- Schema check helper (generated from Prisma schema)",
      "-- Set target database to check against",
      "-- By default this uses the currently selected database.",
      "-- To force a specific database, replace DATABASE() with your DB name, e.g. 'test_mini_erp'.",
      "SET @target_db := DATABASE();",
      "",
      "-- 1) Tables that exist in the target database but are NOT defined in the Prisma schema",
      "-- Tables that exist in the current database but are NOT defined in the Prisma schema",
      "SELECT TABLE_NAME",
      "FROM INFORMATION_SCHEMA.TABLES",
      "WHERE TABLE_SCHEMA = @target_db",
      `  AND TABLE_NAME NOT IN (${tableList});`,
      "",
      "-- 2) Columns that exist in the target database but are NOT defined in the Prisma schema",
      "-- Columns that exist in the current database but are NOT defined in the Prisma schema",
      "SELECT TABLE_NAME, COLUMN_NAME",
      "FROM INFORMATION_SCHEMA.COLUMNS",
      "WHERE TABLE_SCHEMA = @target_db",
      `  AND CONCAT(TABLE_NAME, '.', COLUMN_NAME) NOT IN (${columnList});`,
      "",
    );
  }

  return {
    ddl: ddlStatements.join("\n"),
    checks: checkStatements.join("\n"),
  };
}

async function main() {
  const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma");
  const outputPath = path.resolve(__dirname, "../../prisma/schema.sql");

  console.log(`Reading Prisma schema from: ${schemaPath}`);
  const schema = await fs.readFile(schemaPath, "utf8");

  const models = parseModels(schema);
  if (!models.length) {
    throw new Error("No models found in schema.prisma");
  }

  const { ddl, checks } = generateSql(models);
  await fs.writeFile(outputPath, ddl, "utf8");

  const checkPath = path.resolve(__dirname, "../../prisma/schema-check.sql");
  await fs.writeFile(checkPath, checks, "utf8");

  console.log(`SQL schema generated at: ${outputPath}`);
  console.log(`Schema check SQL generated at: ${checkPath}`);
}

main().catch((err) => {
  console.error("Failed to generate SQL from Prisma schema:", err);
  process.exit(1);
});
