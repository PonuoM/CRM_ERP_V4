
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, 'sales_import_ready_v2_smart.csv');
const OUTPUT_FILE = path.join(__dirname, 'sales_import_ready_v2_final.csv');

const PROVINCES_FILE = path.join(__dirname, 'api/Address_DB/provinces.json');
const DISTRICTS_FILE = path.join(__dirname, 'api/Address_DB/districts.json');
const SUBDISTRICTS_FILE = path.join(__dirname, 'api/Address_DB/sub_districts.json');

console.log('Loading address database...');
const provinces = JSON.parse(fs.readFileSync(PROVINCES_FILE, 'utf-8'));
const districts = JSON.parse(fs.readFileSync(DISTRICTS_FILE, 'utf-8'));
const subDistricts = JSON.parse(fs.readFileSync(SUBDISTRICTS_FILE, 'utf-8'));
console.log(`Loaded: ${provinces.length} provinces, ${districts.length} districts, ${subDistricts.length} sub-districts.`);

// Build lookup maps
const provinceByName = {};
provinces.forEach(p => { provinceByName[p.name_th] = p; });

const districtById = {};
districts.forEach(d => { districtById[d.id] = d; });

const districtsByProvinceId = {};
districts.forEach(d => {
    if (!districtsByProvinceId[d.province_id]) districtsByProvinceId[d.province_id] = [];
    districtsByProvinceId[d.province_id].push(d);
});

const subDistrictByDistrictId = {};
subDistricts.forEach(s => {
    if (!subDistrictByDistrictId[s.district_id]) subDistrictByDistrictId[s.district_id] = [];
    subDistrictByDistrictId[s.district_id].push(s);
});

// Build name sets for fuzzy matching
const allProvinceNames = new Set(provinces.map(p => p.name_th));
const allDistrictNames = {};
districts.forEach(d => {
    const cleanName = d.name_th.replace(/^เขต|^อำเภอ|^เมือง/, '');
    allDistrictNames[cleanName] = d;
    allDistrictNames[d.name_th] = d;
});

const allSubDistrictNames = {};
subDistricts.forEach(s => {
    const cleanName = s.name_th.replace(/^แขวง|^ตำบล/, '');
    if (!allSubDistrictNames[cleanName]) allSubDistrictNames[cleanName] = [];
    allSubDistrictNames[cleanName].push(s);
    if (!allSubDistrictNames[s.name_th]) allSubDistrictNames[s.name_th] = [];
    allSubDistrictNames[s.name_th].push(s);
});

// Extract address parts using multiple regex patterns
function extractAddressParts(address) {
    const result = { tambon: null, amphoe: null, province: null };

    // Normalize Thai characters (ำ vs ํา)
    let addr = address.replace(/ํา/g, 'ำ');

    // Multiple patterns for tambon
    const tambonPatterns = [
        /(?:ตำบล|ตําบล)\s*([ก-๙]+)/,
        /ต\.\s*([ก-๙]+)/,
        /ต\s+([ก-๙]+)/,
        /ต([ก-๙]+)\s/
    ];
    for (const pat of tambonPatterns) {
        const m = addr.match(pat);
        if (m) { result.tambon = m[1]; break; }
    }

    // Multiple patterns for amphoe
    const amphoePatterns = [
        /(?:อำเภอ|อําเภอ)\s*([ก-๙]+)/,
        /อ\.\s*([ก-๙]+)/,
        /อ\s+([ก-๙]+)/,
        /อ([ก-๙]+)\s/
    ];
    for (const pat of amphoePatterns) {
        const m = addr.match(pat);
        if (m) { result.amphoe = m[1]; break; }
    }

    // Multiple patterns for province
    const provincePatterns = [
        /(?:จังหวัด)\s*([ก-๙]+)/,
        /จ\.\s*([ก-๙]+)/,
        /จ\s+([ก-๙]+)/,
        /จ([ก-๙]+)$/
    ];
    for (const pat of provincePatterns) {
        const m = addr.match(pat);
        if (m) { result.province = m[1]; break; }
    }

    return result;
}

// Fuzzy find province
function findProvince(name) {
    if (!name) return null;
    if (provinceByName[name]) return provinceByName[name];
    for (const pName in provinceByName) {
        if (pName.includes(name) || name.includes(pName)) {
            return provinceByName[pName];
        }
    }
    return null;
}

// Fuzzy find district within province
function findDistrict(name, provinceId) {
    if (!name) return null;
    const provDistricts = districtsByProvinceId[provinceId] || [];
    for (const d of provDistricts) {
        const dClean = d.name_th.replace(/^เขต|^อำเภอ|^เมือง/, '');
        if (dClean === name || d.name_th === name || dClean.includes(name) || name.includes(dClean)) {
            return d;
        }
    }
    return null;
}

// Fuzzy find sub-district and zip
function findSubDistrict(name, districtId) {
    if (!name) return null;
    const subs = subDistrictByDistrictId[districtId] || [];
    for (const s of subs) {
        const sClean = s.name_th.replace(/^แขวง|^ตำบล/, '');
        if (sClean === name || s.name_th === name || sClean.includes(name) || name.includes(sClean)) {
            return s;
        }
    }
    return null;
}

// Process
const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = fileContent.split(/\r?\n/);
const header = lines[0];
const newLines = [header];

let fixedRows = 0;

console.log('Processing rows...');

for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(',');

    let tambon = (cols[6] || '').trim();
    let amphoe = (cols[7] || '').trim();
    let province = (cols[8] || '').trim();
    let zip = (cols[9] || '').trim();
    let address = cols.slice(10).join(',');

    // Only fix if something is missing
    if (!tambon || !amphoe || !zip || zip === '0') {
        const extracted = extractAddressParts(address);

        // Determine values to use
        let useTambon = tambon || extracted.tambon;
        let useAmphoe = amphoe || extracted.amphoe;
        let useProvince = province || extracted.province;

        // Find province object
        const prov = findProvince(useProvince);
        if (prov) {
            const dist = findDistrict(useAmphoe, prov.id);
            if (dist) {
                const sub = findSubDistrict(useTambon, dist.id);
                if (!tambon && useTambon) cols[6] = useTambon;
                if (!amphoe && useAmphoe) cols[7] = useAmphoe;
                if (sub) {
                    if (!tambon) cols[6] = sub.name_th;
                    if (!zip || zip === '0') cols[9] = String(sub.zip_code);
                }
                if (!amphoe) cols[7] = dist.name_th;
                fixedRows++;
            } else if (useTambon || useAmphoe) {
                // At least update what we have
                if (!tambon && useTambon) cols[6] = useTambon;
                if (!amphoe && useAmphoe) cols[7] = useAmphoe;
                fixedRows++;
            }
        } else if (useTambon || useAmphoe) {
            if (!tambon && useTambon) cols[6] = useTambon;
            if (!amphoe && useAmphoe) cols[7] = useAmphoe;
            fixedRows++;
        }
    }

    newLines.push(cols.join(','));
}

fs.writeFileSync(OUTPUT_FILE, newLines.join('\n'));
console.log(`Done. Fixed ${fixedRows} rows.`);
console.log(`Saved to ${OUTPUT_FILE}`);

// Count remaining issues
const remaining = newLines.filter(l => l.includes(',,,,') && !l.startsWith('วันที่')).length;
console.log(`Remaining rows with missing fields: ${remaining}`);
