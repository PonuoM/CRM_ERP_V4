import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvCopyPath = path.join(__dirname, 'api/Address_DB/Sub.districts - Copy.csv');
const csvMainPath = path.join(__dirname, 'api/Address_DB/Sub.districts.csv');

function analyzeCSV(filePath, name) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${name}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const map = new Map(); // id -> Set(zip_codes)

    let duplicates = 0;

    // Detect column indices based on file
    // Copy.csv: id(0), Zip_code(1)
    // Sub.districts.csv: id(0), ..., PostCodeMain(18) (based on previous findings)

    // We'll simplisticly check header or filename
    const isCopy = filePath.includes('Copy');
    const colZip = isCopy ? 1 : 18;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');

        if (cols.length <= colZip) continue;

        const id = cols[0].trim();
        const zip = cols[colZip].trim();

        if (!id || !zip) continue;

        if (!map.has(id)) {
            map.set(id, new Set());
        }
        map.get(id).add(zip);
    }

    const multi = [];
    for (const [id, zips] of map) {
        if (zips.size > 1) {
            multi.push({ id, zips: [...zips] });
        }
    }

    console.log(`\nAnalysis of ${name}:`);
    console.log(`Total unique IDs: ${map.size}`);
    console.log(`IDs with multiple Zip Codes: ${multi.length}`);
    if (multi.length > 0) {
        console.log('Examples:', JSON.stringify(multi.slice(0, 5), null, 2));
    }
    return multi;
}

const multiCopy = analyzeCSV(csvCopyPath, 'Sub.districts - Copy.csv');
// const multiMain = analyzeCSV(csvMainPath, 'Sub.districts.csv'); 
// Commented out main for now to focus on user's specific request about the "Copy" file, 
// but actually I should check if MAIN has this issue too.
console.log('---');
analyzeCSV(csvMainPath, 'Sub.districts.csv');
