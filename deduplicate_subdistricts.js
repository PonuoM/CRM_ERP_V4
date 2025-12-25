import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'api/Address_DB/sub_districts.json');

// Read existing data
const jsonCtx = fs.readFileSync(jsonPath, 'utf-8');
const jsonData = JSON.parse(jsonCtx);

console.log(`Original count: ${jsonData.length}`);

const seen = new Set();
const uniqueData = [];
let duplicatesCount = 0;

jsonData.forEach(item => {
    // defined uniqueness by: ID + ZipCode + NameTH + DistrictID
    // The user specifically mentioned: ID, ZipCode, DistrictID.
    // I'll add NameTH to be safe against "Khwaeng" vs "No Khwaeng" variants if they share IDs.
    // If they strictly want to dedup based on ID+Zip, I might accidentally merge "Phra Khanong" (Short) and "Khwaeng Phra Khanong" (Long) if they have same ID/Zip?
    // But usually consistent naming is preferred.
    // The image showed "Tha Raeng (10220)" appearing twice with exact same text.
    // So likely they are exact duplicates.

    const key = `${item.id}_${item.zip_code}_${item.district_id}_${item.name_th.trim()}`;

    if (seen.has(key)) {
        duplicatesCount++;
    } else {
        seen.add(key);
        uniqueData.push(item);
    }
});

if (duplicatesCount > 0) {
    fs.writeFileSync(jsonPath, JSON.stringify(uniqueData, null, 2));
    console.log(`Removed ${duplicatesCount} duplicates.`);
    console.log(`New count: ${uniqueData.length}`);
} else {
    console.log("No duplicates found.");
}
