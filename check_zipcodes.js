import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'api/Address_DB/sub_districts.json');
const jsonCtx = fs.readFileSync(jsonPath, 'utf-8');
const jsonData = JSON.parse(jsonCtx);

const invalid = [];

jsonData.forEach(item => {
    const zipStr = String(item.zip_code);
    if (zipStr.length !== 5 || item.zip_code === 0) {
        invalid.push({
            id: item.id,
            name_th: item.name_th,
            zip_code: item.zip_code
        });
    }
});

console.log(`checked ${jsonData.length} items.`);
console.log(`Found ${invalid.length} invalid items.`);
if (invalid.length > 0) {
    console.log(JSON.stringify(invalid, null, 2));
}
