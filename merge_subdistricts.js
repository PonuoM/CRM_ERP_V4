import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, 'api/Address_DB/Sub.districts.csv');
const jsonPath = path.join(__dirname, 'api/Address_DB/sub_districts.json');

const csvCtx = fs.readFileSync(csvPath, 'utf-8');
const jsonCtx = fs.readFileSync(jsonPath, 'utf-8');

const jsonData = JSON.parse(jsonCtx);
const jsonMap = new Set();

// Populate existing map
jsonData.forEach(item => {
    // Some existing items might have trailing spaces
    const key = `${item.district_id}_${item.name_th ? item.name_th.trim() : ''}`;
    jsonMap.add(key);
});

const lines = csvCtx.split(/\r?\n/);
const newEntries = [];

// Default values requested by user
const defaults = {
    lat: null,
    long: null,
    created_at: "2019-08-09T03:33:09.000+07:00",
    updated_at: "2025-09-20T06:31:26.000+07:00",
    deleted_at: null
};

// Skip header
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV parser (simple split)
    const cols = line.split(',');
    if (cols.length < 19) continue; // Ensure we have enough columns for ZipCode (index 18)

    // Column indices based on inspection:
    // 0: id
    // 1: TambonThai (Full)
    // 2: TambonEng (Full)
    // 3: TambonThaiShort
    // 4: TambonEngShort
    // 5: DistrictID
    // 18: PostCodeMain

    const tambonShort = cols[3].trim();
    const districtId = cols[5].trim();

    if (!tambonShort || !districtId) continue;

    const key = `${districtId}_${tambonShort}`;

    if (!jsonMap.has(key)) {

        let zipCode = 0;
        if (cols[18]) {
            const rawZip = cols[18].trim();
            // Handle if zip code has remarks or multiple checks
            const parsedZip = parseInt(rawZip);
            if (!isNaN(parsedZip)) {
                zipCode = parsedZip;
            }
        }

        // Correct variable naming and ensure full object is used
        const newItem = {
            id: parseInt(cols[0]),
            zip_code: zipCode,
            name_th: cols[3].trim(), // Using Short Name (e.g., "พระบรมมหาราชวัง") to match existing style
            name_en: cols[4].trim(), // Using Short English Name
            district_id: parseInt(cols[5]),

            ...defaults
        };

        newEntries.push(newItem);
        jsonMap.add(key); // Prevent dups
    }
}

// Write back
// We append the new entries to the original data (which might already have duplicates if run multiple times? 
// No, the set `jsonMap` is built from `jsonData` so if I run this AFTER the bad run, it might skip them if naming matches?
// BUT the bad run had `zip_code: 0` and missing names.
// So `jsonMap` key `${item.district_id}_${item.name_th}` might be `${id}_undefined` for the bad entries!
// So they WON'T match.
// I should probably CLEAN existing bad entries first or just advise user to revert?
// Or I can filter out "bad" entries from `jsonData` before processing?
// Bad entries have `zip_code: 0` AND missing `name_th`.
// So I will filter `jsonData`.

const cleanData = jsonData.filter(item => item.name_th !== undefined && item.name_th !== null);
const finalData = [...cleanData, ...newEntries];

fs.writeFileSync(jsonPath, JSON.stringify(finalData, null, 2));

console.log(`Cleaned ${jsonData.length - cleanData.length} bad items.`);
console.log(`Added ${newEntries.length} new items.`);
