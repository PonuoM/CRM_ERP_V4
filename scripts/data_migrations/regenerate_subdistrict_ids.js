import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const path = './api/Address_DB/sub_districts.json';

try {
    const rawData = fs.readFileSync(path, 'utf8');
    let subDistricts = JSON.parse(rawData);

    console.log(`Original Records: ${subDistricts.length}`);

    // Sort by district_id, then by name_th to ensure consistent ordering
    subDistricts.sort((a, b) => {
        if (a.district_id !== b.district_id) {
            return a.district_id - b.district_id;
        }
        return a.name_th.localeCompare(b.name_th, 'th');
    });

    const districtCounters = {};
    let changedCount = 0;

    const updatedSubDistricts = subDistricts.map(sd => {
        const distId = sd.district_id;

        if (!districtCounters[distId]) {
            districtCounters[distId] = 1;
        } else {
            districtCounters[distId]++;
        }

        // Format: DDDDNN (District 4 digits + Sequence 2 digits)
        // Ensure sequence fits in 2 digits (or more if needed)
        const sequence = String(districtCounters[distId]).padStart(2, '0');
        const newId = parseInt(`${distId}${sequence}`);

        if (sd.id !== newId) {
            changedCount++;
        }

        return {
            ...sd,
            id: newId
        };
    });

    console.log(`Updated IDs for ${changedCount} records.`);

    fs.writeFileSync(path, JSON.stringify(updatedSubDistricts, null, 2), 'utf8');
    console.log(`Successfully saved to ${path}`);

} catch (error) {
    console.error('Error:', error);
}
