#!/usr/bin/env node

/**
 * Thai Address Database Seeding Script
 * This script seeds the database with Thai address data (provinces, districts, sub-districts, etc.)
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Read and parse JSON file
function readJsonFile(filename: string): any[] {
  const filePath = path.join(process.cwd(), "api", "Address_DB", filename);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContent);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error reading or parsing ${filename}:`, error);
    process.exit(1);
  }
}

async function main() {
  console.log("Start seeding Thai address data...");

  try {
    // Import geographies
    console.log("Seeding geographies...");
    const geographies = readJsonFile("geographies.json");

    for (const geo of geographies) {
      await prisma.address_geographies.upsert({
        where: { id: geo.id },
        update: {
          name: geo.name || null,
          created_at: geo.created_at ? new Date(geo.created_at) : null,
          updated_at: geo.updated_at ? new Date(geo.updated_at) : null,
          deleted_at: geo.deleted_at ? new Date(geo.deleted_at) : null,
        },
        create: {
          id: geo.id,
          name: geo.name || null,
          created_at: geo.created_at ? new Date(geo.created_at) : null,
          updated_at: geo.updated_at ? new Date(geo.updated_at) : null,
          deleted_at: geo.deleted_at ? new Date(geo.deleted_at) : null,
        },
      });
    }
    console.log(`Seeded ${geographies.length} geographies`);

    // Import provinces
    console.log("Seeding provinces...");
    const provinces = readJsonFile("provinces.json");

    for (const province of provinces) {
      await prisma.address_provinces.upsert({
        where: { id: province.id },
        update: {
          name_th: province.name_th || null,
          name_en: province.name_en || null,
          geography_id: province.geography_id || null,
          created_at: province.created_at
            ? new Date(province.created_at)
            : null,
          updated_at: province.updated_at
            ? new Date(province.updated_at)
            : null,
          deleted_at: province.deleted_at
            ? new Date(province.deleted_at)
            : null,
        },
        create: {
          id: province.id,
          name_th: province.name_th || null,
          name_en: province.name_en || null,
          geography_id: province.geography_id || null,
          created_at: province.created_at
            ? new Date(province.created_at)
            : null,
          updated_at: province.updated_at
            ? new Date(province.updated_at)
            : null,
          deleted_at: province.deleted_at
            ? new Date(province.deleted_at)
            : null,
        },
      });
    }
    console.log(`Seeded ${provinces.length} provinces`);

    // Import districts
    console.log("Seeding districts...");
    const districts = readJsonFile("districts.json");

    for (const district of districts) {
      await prisma.address_districts.upsert({
        where: { id: district.id },
        update: {
          name_th: district.name_th || null,
          name_en: district.name_en || null,
          province_id: district.province_id || null,
          created_at: district.created_at
            ? new Date(district.created_at)
            : null,
          updated_at: district.updated_at
            ? new Date(district.updated_at)
            : null,
          deleted_at: district.deleted_at
            ? new Date(district.deleted_at)
            : null,
        },
        create: {
          id: district.id,
          name_th: district.name_th || null,
          name_en: district.name_en || null,
          province_id: district.province_id || null,
          created_at: district.created_at
            ? new Date(district.created_at)
            : null,
          updated_at: district.updated_at
            ? new Date(district.updated_at)
            : null,
          deleted_at: district.deleted_at
            ? new Date(district.deleted_at)
            : null,
        },
      });
    }
    console.log(`Seeded ${districts.length} districts`);

    // Import sub-districts
    console.log("Seeding sub-districts...");
    const subDistricts = readJsonFile("sub_districts.json");

    for (const subDistrict of subDistricts) {
      await prisma.address_sub_districts.upsert({
        where: { id: subDistrict.id },
        update: {
          name_th: subDistrict.name_th || null,
          name_en: subDistrict.name_en || null,
          district_id: subDistrict.district_id || null,
          zip_code: String(subDistrict.zip_code || subDistrict.postcode || ""),
          created_at: subDistrict.created_at
            ? new Date(subDistrict.created_at)
            : null,
          updated_at: subDistrict.updated_at
            ? new Date(subDistrict.updated_at)
            : null,
          deleted_at: subDistrict.deleted_at
            ? new Date(subDistrict.deleted_at)
            : null,
        },
        create: {
          id: subDistrict.id,
          name_th: subDistrict.name_th || null,
          name_en: subDistrict.name_en || null,
          district_id: subDistrict.district_id || null,
          zip_code: String(subDistrict.zip_code || subDistrict.postcode || ""),
          created_at: subDistrict.created_at
            ? new Date(subDistrict.created_at)
            : null,
          updated_at: subDistrict.updated_at
            ? new Date(subDistrict.updated_at)
            : null,
          deleted_at: subDistrict.deleted_at
            ? new Date(subDistrict.deleted_at)
            : null,
        },
      });
    }
    console.log(`Seeded ${subDistricts.length} sub-districts`);

    console.log("Thai address data seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding address data:", error);
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
