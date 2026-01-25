
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const INPUT_FILE = path.join(__dirname, 'sales_import_ready_v2_fixed.csv'); // Start from the previously fixed file or original? User mentioned sales_import_ready_v2_fixed.csv in request.
const OUTPUT_FILE = path.join(__dirname, 'sales_import_ready_v2_smart.csv');

const PROVINCES_FILE = path.join(__dirname, 'api/Address_DB/provinces.json');
const DISTRICTS_FILE = path.join(__dirname, 'api/Address_DB/districts.json');
const SUBDISTRICTS_FILE = path.join(__dirname, 'api/Address_DB/sub_districts.json');

// Load Data
console.log('Loading address database...');
const provinces = JSON.parse(fs.readFileSync(PROVINCES_FILE, 'utf-8'));
const districts = JSON.parse(fs.readFileSync(DISTRICTS_FILE, 'utf-8'));
const subDistricts = JSON.parse(fs.readFileSync(SUBDISTRICTS_FILE, 'utf-8'));
console.log(`Loaded: ${provinces.length} provinces, ${districts.length} districts, ${subDistricts.length} sub-districts.`);

// Indexing for speed and lookup
// Map Name -> Object
// Problem: Names might be duplicated (e.g. Amphoe Mueang exists in every province).
// So we need: Name -> [List of Objects]

const provinceMap = {};
provinces.forEach(p => {
    const k = p.name_th.trim();
    provinceMap[k] = p; // Provinces are unique by name usually
});

const districtMap = {}; // Name -> [ {id, province_id, ...} ]
districts.forEach(d => {
    const k = d.name_th.replace(/^เขต/, '').trim(); // Remove 'เขต' prefix for Bangkok districts for easier matching
    if (!districtMap[k]) districtMap[k] = [];
    districtMap[k].push(d);

    // Also index with full name just in case
    const kFull = d.name_th.trim();
    if (kFull !== k) {
        if (!districtMap[kFull]) districtMap[kFull] = [];
        districtMap[kFull].push(d);
    }
});

const subDistrictMap = {}; // Name -> [ {id, district_id, zip_code...} ]
subDistricts.forEach(s => {
    const k = s.name_th.replace(/^แขวง/, '').trim(); // Remove 'แขวง'
    if (!subDistrictMap[k]) subDistrictMap[k] = [];
    subDistrictMap[k].push(s);

    // Also index with full name
    const kFull = s.name_th.trim();
    if (kFull !== k) {
        if (!subDistrictMap[kFull]) subDistrictMap[kFull] = [];
        subDistrictMap[kFull].push(s);
    }
});

// Helper: Normalize Address Text
function normalize(text) {
    if (!text) return '';
    // Replace common separators with spaces
    // Remove "ต." "อ." "จ." "ตำบล" "อำเภอ" "จังหวัด" "แขวง" "เขต" to get clean keywords
    // We want to keep space to tokenize
    let s = text.replace(/,|;|\.|\/|:/g, ' ');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

function solveAddress(addressLines, originalData) {
    // originalData contains: { tambon, amphoe, province, zip } existing values
    // We will use existing values as strong hints.

    // Tokenize
    const tokens = normalize(addressLines).split(' ');

    let candidates = {
        province: null,
        district: null,
        subDistrict: null
    };

    // 1. Search for Province
    // Heuristic: Check if existing province column is valid.
    if (originalData.province && provinceMap[originalData.province]) {
        candidates.province = provinceMap[originalData.province];
    } else {
        // Search in text
        for (const t of tokens) {
            // Try clean keyword
            let kw = t.replace(/^(จ\.|จังหวัด)/, '');
            if (provinceMap[kw]) {
                candidates.province = provinceMap[kw];
                break;
            }
        }
    }

    // 2. Search for District
    // If province is known, we limit search to valid districts.
    if (originalData.amphoe) {
        // Clean existing
        let kw = originalData.amphoe.replace(/^(อ\.|อำเภอ|เขต)/, '');
        if (districtMap[kw]) {
            // If province is known, check consistency
            if (candidates.province) {
                const match = districtMap[kw].find(d => d.province_id === candidates.province.id);
                if (match) candidates.district = match;
            } else {
                // If ambiguous (multiple provinces have this district name?), wait.
                // Actually districts besides 'Mueang' are mostly unique? Not always.
                // Pick first or wait?
                if (districtMap[kw].length === 1) {
                    candidates.district = districtMap[kw][0];
                    // Backfill province
                    if (!candidates.province) candidates.province = provinces.find(p => p.id === candidates.district.province_id);
                } else {
                    // Multiple matches. Keep list?
                }
            }
        }
    }

    if (!candidates.district) {
        // Search tokens
        for (const t of tokens) {
            let kw = t.replace(/^(อ\.|อำเภอ|เขต)/, '');
            // Skip common short words or numbers
            if (kw.length < 2 || !isNaN(kw)) continue;

            if (districtMap[kw]) {
                const possibleDistricts = districtMap[kw];
                if (candidates.province) {
                    const match = possibleDistricts.find(d => d.province_id === candidates.province.id);
                    if (match) {
                        candidates.district = match;
                        break;
                    }
                    // IMPORTANT: 'Muang' / 'Meuang' logic often fails if we don't have special handling, 
                    // but exact Thai name matching usually works: "เมือง" vs "เมืองเชียงใหม่"
                } else {
                    // If we find a unique district, we win
                    if (possibleDistricts.length === 1) {
                        candidates.district = possibleDistricts[0];
                        candidates.province = provinces.find(p => p.id === candidates.district.province_id);
                        break;
                    }
                }
            }
        }
    }

    // 3. Search for Subdistrict
    // Same logic
    // ... This can get complex with "matching score". 
    // Let's implement a simpler "Forward Scan" approach which is robust enough.

    // Better Approach: 
    // Iterate ALL tokens. Categorize them into [P_Candidates], [D_Candidates], [S_Candidates].
    // Then try to link them up.

    // We already tried simple token scan. Let's do a "Drill Down" approach.
    // If we have Province, we scan tokens for any District in that province.
    // If we have District, we scan tokens for any Subdistrict in that district.

    // Step 1: Province (Try harder)
    if (!candidates.province) {
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i].replace(/^(จ\.|จังหวัด)/, '');
            if (provinceMap[t]) { candidates.province = provinceMap[t]; break; }
        }
    }

    // Step 2: District
    if (candidates.province && !candidates.district) {
        // Look for any district belonging to this province in tokens
        const validDistricts = districts.filter(d => d.province_id === candidates.province.id);
        const validDistrictNames = new Set(validDistricts.map(d => d.name_th));
        const validDistrictNamesNoPrefix = new Set(validDistricts.map(d => d.name_th.replace(/^เขต|^อำเภอ/, '')));

        for (let t of tokens) {
            t = t.replace(/^(อ\.|อำเภอ|เขต)/, '');
            if (validDistrictNamesNoPrefix.has(t)) {
                // Found it
                candidates.district = validDistricts.find(d => d.name_th.includes(t) || d.name_th.replace(/^เขต|^อำเภอ/, '') === t);
                break;
            }
        }
    }

    // Step 3: Subdistrict
    if (candidates.district && !candidates.subDistrict) {
        const validSubs = subDistricts.filter(s => s.district_id === candidates.district.id);
        const validSubNamesNoPrefix = new Set(validSubs.map(s => s.name_th.replace(/^แขวง|^ตำบล/, '')));

        for (let t of tokens) {
            t = t.replace(/^(ต\.|ตำบล|แขวง)/, '');
            if (validSubNamesNoPrefix.has(t)) {
                candidates.subDistrict = validSubs.find(s => s.name_th.replace(/^แขวง|^ตำบล/, '') === t);
                break;
            }
        }
    }

    // Emergency Reverse Lookup: If we found Subdistrict but no Province/District (rare but possible if unique name)
    if (!candidates.subDistrict && !candidates.province && !candidates.district) {
        // Try identifying subdistrict purely by name
        for (let t of tokens) {
            t = t.replace(/^(ต\.|ตำบล|แขวง)/, '');
            if (t.length > 2 && subDistrictMap[t] && subDistrictMap[t].length === 1) {
                const s = subDistrictMap[t][0];
                candidates.subDistrict = s;
                // Backfill
                candidates.district = districts.find(d => d.id === s.district_id);
                candidates.province = provinces.find(p => p.id === candidates.district.province_id);
                break; // Found unique anchor
            }
        }
    }

    return candidates;
}


// PROCESS
const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = fileContent.split(/\r?\n/);
const header = lines[0];
const newLines = [header];

let fixedCount = 0;
let filledHoles = 0;

console.log('Processing rows...');

for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(',');

    // Columns: 6=Tambon, 7=Amphoe, 8=Province, 9=Zip, 10=Address
    let tambon = (cols[6] || '').trim().replace(/^['"]|['"]$/g, '');
    let amphoe = (cols[7] || '').trim().replace(/^['"]|['"]$/g, '');
    let province = (cols[8] || '').trim().replace(/^['"]|['"]$/g, '');
    let zip = (cols[9] || '').trim().replace(/^['"]|['"]$/g, '');
    let address = cols.slice(10).join(',').replace(/^['"]|['"]$/g, ''); // Address

    // Only attempt fix if something is missing
    if (!tambon || !amphoe || !province || !zip || zip === '0') {
        const originalData = { tambon, amphoe, province, zip };
        const solved = solveAddress(address + ' ' + tambon + ' ' + amphoe + ' ' + province, originalData);

        let changed = false;

        if (solved.province) {
            // Update Province
            if (!province) { cols[8] = solved.province.name_th; province = solved.province.name_th; changed = true; }
        }

        if (solved.district) {
            if (!amphoe) { cols[7] = solved.district.name_th; amphoe = solved.district.name_th; changed = true; }
        }

        if (solved.subDistrict) {
            if (!tambon) { cols[6] = solved.subDistrict.name_th; tambon = solved.subDistrict.name_th; changed = true; }
            if (!zip || zip === '0') { cols[9] = solved.subDistrict.zip_code; zip = solved.subDistrict.zip_code; changed = true; }
        }

        if (changed) filledHoles++;
    }

    newLines.push(cols.join(','));
}

fs.writeFileSync(OUTPUT_FILE, newLines.join('\n'));
console.log(`Done. enriched ${filledHoles} rows.`);
console.log(`Saved to ${OUTPUT_FILE}`);
