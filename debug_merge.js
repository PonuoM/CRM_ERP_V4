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

jsonData.forEach(item => {
    const key = `${item.district_id}_${item.name_th ? item.name_th.trim() : ''}`;
    jsonMap.add(key);
});

console.log(`Initial JSON Map size: ${jsonMap.size}`);

const lines = csvCtx.split(/\r?\n/);
let skippedCols = 0;
let skippedKey = 0;
let added = 0;

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple split
    const cols = line.split(',');

    // Debug CSV structure issues
    if (cols.length < 19) {
        skippedCols++;
        if (skippedCols <= 5) {
            console.log(`Skipping line ${i}: Only ${cols.length} cols. Content: ${line.substring(0, 50)}...`);
        }
        continue;
    }

    const tambonShort = cols[3].trim();
    const districtId = cols[5].trim();

    if (!tambonShort || !districtId) continue;

    const key = `${districtId}_${tambonShort}`;

    if (jsonMap.has(key)) {
        skippedKey++;
        continue;
    }

    // Found missing item
    added++;
    if (added <= 5) {
        console.log(`Found missing: ${key} (CSV Line ${i})`);
    }

    // Logic to add would follow here... 
}

console.log(`Summary:`);
console.log(`Total CSV Lines: ${lines.length}`);
console.log(`Skipped due to col count < 19: ${skippedCols}`);
console.log(`Skipped due to existing key: ${skippedKey}`);
console.log(`Potential new items: ${added}`);
