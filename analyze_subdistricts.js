const fs = require('fs');
const path = './api/Address_DB/sub_districts.json';

const rawData = fs.readFileSync(path);
const subDistricts = JSON.parse(rawData);

const idMap = new Map();
const duplicates = [];

console.log(`Total records: ${subDistricts.length}`);

subDistricts.forEach((sd, index) => {
    if (idMap.has(sd.id)) {
        duplicates.push({
            existing: idMap.get(sd.id),
            current: { index, ...sd }
        });
    } else {
        idMap.set(sd.id, { index, ...sd });
    }
});

console.log(`Found ${duplicates.length} Duplicate IDs.`);

if (duplicates.length > 0) {
    console.log("Samples:");
    duplicates.slice(0, 5).forEach(d => {
        console.log(`ID: ${d.current.id}`);
        console.log(`  Existing: Name=${d.existing.name_th}, Zip=${d.existing.zip_code}, Dist=${d.existing.district_id}`);
        console.log(`  Current:  Name=${d.current.name_th}, Zip=${d.current.zip_code}, Dist=${d.current.district_id}`);
        console.log("-------------------");
    });
}
