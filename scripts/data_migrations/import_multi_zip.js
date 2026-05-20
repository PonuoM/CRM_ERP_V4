import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target file locations
const jsonPath = path.join(__dirname, 'api/Address_DB/sub_districts.json');
const csvPath = path.join(__dirname, 'api/Address_DB/Sub.districts - Copy.csv');

// Load existing JSON
const jsonCtx = fs.readFileSync(jsonPath, 'utf-8');
const jsonData = JSON.parse(jsonCtx);

// Create a Set of existing "ID + Zip" combinations to avoid exact duplicates
const existingSet = new Set();
jsonData.forEach(item => {
    // Key: ID_ZipCode
    existingSet.add(`${item.id}_${item.zip_code}`);
});

console.log(`Current JSON items: ${jsonData.length}`);

// Read CSV
if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
}

const csvCtx = fs.readFileSync(csvPath, 'utf-8');
const lines = csvCtx.split(/\r?\n/);

const newEntries = [];

// Default fields as requested previously
const defaults = {
    lat: null,
    long: null,
    created_at: "2019-08-09T03:33:09.000+07:00",
    updated_at: "2025-09-20T06:31:26.000+07:00",
    deleted_at: null
};

// Skip header (Line 0)
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    // Expect columns based on inspection of Sub.districts - Copy.csv:
    // 0: id
    // 1: Zip_code
    // 2: name_th
    // 3: name_en
    // 4: district_id

    if (cols.length < 5) continue;

    const id = parseInt(cols[0].trim());
    const zip = parseInt(cols[1].trim());
    const name_th = cols[2].trim();
    const name_en = cols[3].trim();
    const district_id = parseInt(cols[4].trim());

    if (!id || !zip) continue;

    const key = `${id}_${zip}`;

    // If this specific combination of ID + Zip does NOT exist, add it.
    // This allows multiple entries with the same ID as long as Zip is different.
    if (!existingSet.has(key)) {

        const newItem = {
            id: id,
            zip_code: zip,
            name_th: name_th,
            name_en: name_en,
            district_id: district_id,
            ...defaults
        };

        newEntries.push(newItem);
        existingSet.add(key); // Mark as added to prevent exact duplicates within CSV
    }
}

// Append and Save
if (newEntries.length > 0) {
    const finalData = [...jsonData, ...newEntries];
    // Sort by ID for tidiness? User didn't ask, but it helps.
    finalData.sort((a, b) => a.id - b.id);

    fs.writeFileSync(jsonPath, JSON.stringify(finalData, null, 2));
    console.log(`Successfully added ${newEntries.length} new entries (Multi-Zip).`);
    console.log(`Total items now: ${finalData.length}`);
} else {
    console.log("No new multi-zip entries found.");
}
