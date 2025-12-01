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
  isUnique: boolean;
};

type Index = {
  columns: string[];
  name?: string;
  type: "INDEX" | "UNIQUE";
};

type ForeignKey = {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  name?: string;
  onDelete?: string;
  onUpdate?: string;
};

type Model = {
  name: string;
  fields: Field[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
  // If true, model is marked @@ignore in Prisma and should be excluded from checks/DDL
  ignored: boolean;
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
    const indexes: Index[] = [];
    const foreignKeys: ForeignKey[] = [];
    let ignored = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;

      // Skip ignored models from Prisma (@@ignore)
      if (line.startsWith("@@ignore")) {
        ignored = true;
        continue;
      }

      // Handle Block Attributes (@@index, @@unique)
      if (line.startsWith("@@")) {
        const indexMatch = line.match(/@@(index|unique)\(\[([^\]]+)\](.*)\)/);
        if (indexMatch) {
          const [, type, colsStr, args] = indexMatch;
          const columns = colsStr.split(",").map((c) => c.trim());
          const mapMatch = args.match(/map:\s*"([^"]+)"/);
          const indexName = mapMatch ? mapMatch[1] : undefined;

          indexes.push({
            columns,
            name: indexName,
            type: type === "unique" ? "UNIQUE" : "INDEX",
          });
        }
        continue;
      }

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

      // Check for @relation (Foreign Key)
      if (attributes.includes("@relation(")) {
        // Extract relation details
        const relationMatch = line.match(
          /@relation\((.*)\)/
        );
        if (relationMatch) {
          const args = relationMatch[1];
          const fieldsMatch = args.match(/fields:\s*\[([^\]]+)\]/);
          const referencesMatch = args.match(/references:\s*\[([^\]]+)\]/);
          const mapMatch = args.match(/map:\s*"([^"]+)"/);
          const onDeleteMatch = args.match(/onDelete:\s*(\w+)/);
          const onUpdateMatch = args.match(/onUpdate:\s*(\w+)/);

          if (fieldsMatch && referencesMatch) {
            foreignKeys.push({
              columns: fieldsMatch[1].split(",").map((c) => c.trim()),
              referencedTable: prismaType, // The type of the field is the referenced model
              referencedColumns: referencesMatch[1].split(",").map((c) => c.trim()),
              name: mapMatch ? mapMatch[1] : undefined,
              onDelete: onDeleteMatch ? onDeleteMatch[1] : undefined,
              onUpdate: onUpdateMatch ? onUpdateMatch[1] : undefined,
            });
          }
        }
        // Continue because relation fields are not actual columns in SQL
        // (The columns are defined separately, e.g. userId Int)
        continue;
      }

      const isId = attributes.includes("@id");
      const isAutoIncrement = attributes.includes("autoincrement()");
      const isUnique = attributes.includes("@unique");

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
        isUnique,
      });
    }

    if (fields.length) {
      models.push({ name, fields, indexes, foreignKeys, ignored });
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
      // Default to VARCHAR(255) for Enums and other unknown types to avoid
      // "BLOB/TEXT column used in key specification without a key length" error
      return "VARCHAR(255)";
  }
}

function mapReferentialAction(action?: string): string {
  switch (action) {
    case "Cascade":
      return "CASCADE";
    case "SetNull":
      return "SET NULL";
    case "NoAction":
      return "NO ACTION";
    case "Restrict":
      return "RESTRICT";
    default:
      return "NO ACTION"; // Default for MySQL/Prisma usually
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
    // Skip models that Prisma marks as @@ignore (not handled by Prisma Client)
    if (model.ignored) continue;

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
        isPk &&
          field.isAutoIncrement &&
          (field.prismaType === "Int" || field.prismaType === "BigInt")
          ? "AUTO_INCREMENT"
          : "";

      columnDefs.push(
        `  \`${field.name}\` ${colType} ${autoInc} ${nullability}`
          .trim()
          .replace(/\s+/g, " ")
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

    // Generate ALTER TABLE ADD COLUMN for non-PK columns
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

      // Special handling for Enums (which we map to VARCHAR(255))
      // If the column exists but is TEXT (from previous default), we need to modify it to VARCHAR(255)
      // so that indexes can be created on it.
      const isEnum = !SCALAR_TYPES.has(field.prismaType) && !field.nativeType;
      if (isEnum) {
        const modifyDdl = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${field.name}\` VARCHAR(255) NULL`;
        const modifyWithCheck = [
          "SET @sql := IF((",
          "  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS",
          `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${field.name}' AND DATA_TYPE = 'text'`,
          ") > 0,",
          `  '${modifyDdl.replace(/'/g, "''")}',`,
          "  'SELECT 1'",
          ");",
          "PREPARE stmt FROM @sql;",
          "EXECUTE stmt;",
          "DEALLOCATE PREPARE stmt;",
        ].join("\n");
        ddlStatements.push(modifyWithCheck);
      }
    }

    // Generate Indexes (@@index)
    for (const index of model.indexes) {
      if (index.type === "INDEX") {
        const indexName =
          index.name || `idx_${tableName}_${index.columns.join("_")}`;
        const cols = index.columns.map((c) => `\`${c}\``).join(", ");
        const ddl = `CREATE INDEX \`${indexName}\` ON \`${tableName}\`(${cols})`;

        const createIndexWithCheck = [
          "SET @sql := IF((",
          "  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS",
          `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`,
          ") = 0,",
          `  '${ddl.replace(/'/g, "''")}',`,
          "  'SELECT 1'",
          ");",
          "PREPARE stmt FROM @sql;",
          "EXECUTE stmt;",
          "DEALLOCATE PREPARE stmt;",
        ].join("\n");
        ddlStatements.push(createIndexWithCheck);
      }
    }

    // Generate Unique Constraints (@@unique and @unique)
    // 1. Block level @@unique
    for (const index of model.indexes) {
      if (index.type === "UNIQUE") {
        const indexName =
          index.name || `uniq_${tableName}_${index.columns.join("_")}`;
        const cols = index.columns.map((c) => `\`${c}\``).join(", ");
        const ddl = `CREATE UNIQUE INDEX \`${indexName}\` ON \`${tableName}\`(${cols})`;

        const createUniqueWithCheck = [
          "SET @sql := IF((",
          "  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS",
          `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`,
          ") = 0,",
          `  '${ddl.replace(/'/g, "''")}',`,
          "  'SELECT 1'",
          ");",
          "PREPARE stmt FROM @sql;",
          "EXECUTE stmt;",
          "DEALLOCATE PREPARE stmt;",
        ].join("\n");
        ddlStatements.push(createUniqueWithCheck);
      }
    }

    // 2. Field level @unique
    for (const field of model.fields) {
      if (field.isUnique) {
        // Prisma default naming for single field unique is usually just the field name or unique_table_field
        // We'll use a consistent naming convention here if not specified (Prisma doesn't allow map on @unique field attribute easily in schema without block)
        // Actually @unique on field DOES NOT support map directly in the attribute syntax usually shown, but let's assume standard naming.
        // We'll use `uniq_table_field` to be safe.
        const indexName = `uniq_${tableName}_${field.name}`;
        const ddl = `CREATE UNIQUE INDEX \`${indexName}\` ON \`${tableName}\`(\`${field.name}\`)`;

        const createUniqueWithCheck = [
          "SET @sql := IF((",
          "  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS",
          `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`,
          ") = 0,",
          `  '${ddl.replace(/'/g, "''")}',`,
          "  'SELECT 1'",
          ");",
          "PREPARE stmt FROM @sql;",
          "EXECUTE stmt;",
          "DEALLOCATE PREPARE stmt;",
        ].join("\n");
        ddlStatements.push(createUniqueWithCheck);
      }
    }

    // Generate Foreign Keys
    for (const fk of model.foreignKeys) {
      const fkName =
        fk.name ||
        `fk_${tableName}_${fk.columns.join("_")}_${fk.referencedTable}`;
      const cols = fk.columns.map((c) => `\`${c}\``).join(", ");
      const refCols = fk.referencedColumns.map((c) => `\`${c}\``).join(", ");
      const onDelete = fk.onDelete ? `ON DELETE ${mapReferentialAction(fk.onDelete)}` : "";
      const onUpdate = fk.onUpdate ? `ON UPDATE ${mapReferentialAction(fk.onUpdate)}` : "";

      const ddl = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (${cols}) REFERENCES \`${fk.referencedTable}\`(${refCols}) ${onDelete} ${onUpdate}`;

      const createFkWithCheck = [
        "SET @sql := IF((",
        "  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS",
        `  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND CONSTRAINT_NAME = '${fkName}' AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
        ") = 0,",
        `  '${ddl.replace(/'/g, "''")}',`,
        "  'SELECT 1'",
        ");",
        "PREPARE stmt FROM @sql;",
        "EXECUTE stmt;",
        "DEALLOCATE PREPARE stmt;",
      ].join("\n");
      ddlStatements.push(createFkWithCheck);
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
      // Only consider columns for tables that are part of the Prisma schema
      `  AND TABLE_NAME IN (${tableList})`,
      `  AND CONCAT(TABLE_NAME, '.', COLUMN_NAME) NOT IN (${columnList});`,
      "",
    );
  }

  return {
    ddl: ddlStatements.join("\n"),
    checks: checkStatements.join("\n"),
  };
}

function sortModelsByDependency(models: Model[]): Model[] {
  const modelMap = new Map<string, Model>();
  const dependencies = new Map<string, Set<string>>();
  const modelNames = new Set<string>();

  // Initialize maps
  for (const model of models) {
    modelMap.set(model.name, model);
    modelNames.add(model.name);
    dependencies.set(model.name, new Set());
  }

  // Build dependency graph
  for (const model of models) {
    for (const fk of model.foreignKeys) {
      if (modelNames.has(fk.referencedTable) && fk.referencedTable !== model.name) {
        dependencies.get(model.name)?.add(fk.referencedTable);
      }
    }
  }

  // Topological Sort (Kahn's Algorithm-ish / DFS)
  const visited = new Set<string>();
  const sorted: Model[] = [];
  const visiting = new Set<string>(); // To detect cycles

  function visit(modelName: string) {
    if (visited.has(modelName)) return;
    if (visiting.has(modelName)) {
      console.warn(`Circular dependency detected involving ${modelName}. Breaking cycle.`);
      return;
    }

    visiting.add(modelName);

    const deps = dependencies.get(modelName);
    if (deps) {
      for (const dep of deps) {
        visit(dep);
      }
    }

    visiting.delete(modelName);
    visited.add(modelName);
    sorted.push(modelMap.get(modelName)!);
  }

  for (const model of models) {
    visit(model.name);
  }

  return sorted;
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

  // Sort models by dependency (Topological Sort)
  const sortedModels = sortModelsByDependency(models);

  const { ddl, checks } = generateSql(sortedModels);
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
