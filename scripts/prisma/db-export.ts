#!/usr/bin/env node

/**
 * Export data from all Prisma models into a single SQL file.
 *
 * - Reads table / field definitions from prisma/schema.prisma
 * - Uses PrismaClient (DATABASE_URL) to query each table
 * - Writes INSERT statements to prisma/data.sql
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

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

      // Skip list fields (relation arrays)
      if (prismaType.endsWith("[]")) continue;

      // Handle optional marker
      prismaType = prismaType.replace("?", "");

      // Skip pure relation fields (those that only define @relation and no actual column)
      if (attributes.includes("@relation(")) continue;

      // Only keep scalar types
      if (!SCALAR_TYPES.has(prismaType)) continue;

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

function sqlEscapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

function formatDate(value: Date): string {
  // MySQL-compatible: YYYY-MM-DD HH:MM:SS
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function toSqlValue(field: Field, value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  switch (field.prismaType) {
    case "Int":
    case "BigInt":
    case "Float":
    case "Decimal":
      return String(value);
    case "Boolean":
      return value ? "1" : "0";
    case "DateTime": {
      const d = value instanceof Date ? value : new Date(String(value));
      return `'${formatDate(d)}'`;
    }
    case "Json": {
      const json =
        typeof value === "string" ? value : JSON.stringify(value ?? null);
      return `'${sqlEscapeString(json)}'`;
    }
    case "String":
    default: {
      const str = String(value);
      return `'${sqlEscapeString(str)}'`;
    }
  }
}

async function main() {
  const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma");
  const outputPath = path.resolve(__dirname, "../../prisma/data.sql");

  console.log(`[db:export] Reading Prisma schema from: ${schemaPath}`);
  const schema = await fs.readFile(schemaPath, "utf8");
  const models = parseModels(schema);

  if (!models.length) {
    throw new Error("No models found in schema.prisma");
  }

  const prisma = new PrismaClient();
  const outputLines: string[] = [];

  try {
    outputLines.push(
      "-- Data export generated from Prisma schema",
      "-- WARNING: This file may be large.",
      "",
    );

    for (const model of models) {
      const tableName = model.name;
      const columns = model.fields.map((f) => f.name);

      console.log(`[db:export] Exporting table: ${tableName}`);

      const rows = (await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM \`${tableName}\``,
      )) as any[];

      if (!rows.length) {
        outputLines.push(`-- Table ${tableName}: no rows`, "");
        continue;
      }

      outputLines.push(`-- Data for table ${tableName}`);

      for (const row of rows) {
        const values = columns.map((col) => {
          const field = model.fields.find((f) => f.name === col)!;
          const v = (row as any)[col];
          return toSqlValue(field, v);
        });

        const insert = `INSERT INTO \`${tableName}\` (${columns
          .map((c) => `\`${c}\``)
          .join(", ")}) VALUES (${values.join(", ")});`;

        outputLines.push(insert);
      }

      outputLines.push(""); // blank line between tables
    }

    await fs.writeFile(outputPath, outputLines.join("\n"), "utf8");
    console.log(`[db:export] Data export written to: ${outputPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[db:export] Failed to export data:", err);
  process.exit(1);
});

