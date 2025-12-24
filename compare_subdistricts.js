import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvCtx = fs.readFileSync(path.join(__dirname, 'api/Address_DB/Sub.districts.csv'), 'utf-8');
const jsonCtx = fs.readFileSync(path.join(__dirname, 'api/Address_DB/sub_districts.json'), 'utf-8');

const jsonData = JSON.parse(jsonCtx);
const jsonMap = new Set();

jsonData.forEach(item => {
    // Key by district_id + name_th reduced to simple string
    // Removing spaces helps with loose matching
    const key = `${item.district_id}_${item.name_th.trim()}`;
    jsonMap.add(key);
});

const lines = csvCtx.split(/\r?\n/);
const missing = [];

// Skip header (line 0)
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV parser (simple split by comma, considering potential quotes if complex, but this file looks simple)
    const cols = line.split(',');

    // index 3: TambonThaiShort
    // index 5: DistrictID

    if (cols.length < 6) continue;

    const tambonShort = cols[3].trim();
    const districtId = cols[5].trim();

    if (!tambonShort || !districtId) continue;

    const key = `${districtId}_${tambonShort}`;

    if (!jsonMap.has(key)) {
        missing.push({
            csv_id: cols[0],
            district_id: districtId,
            district_name: cols[6],
            tambon_name: tambonShort,
            tambon_full: cols[1]
        });
    }
}

console.log(JSON.stringify(missing, null, 2));
console.warn(`Total Missing: ${missing.length}`);
