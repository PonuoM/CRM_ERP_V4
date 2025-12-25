const fs = require('fs');
const path = require('path');

const districtsPath = path.join(__dirname, 'districts.json');
const subDistrictsPath = path.join(__dirname, 'sub_districts.json');

// Helper to clean name
const cleanName = (name, prefix) => {
    if (name && name.startsWith(prefix)) {
        return name.replace(prefix, '');
    }
    return name;
};

// Process Districts
try {
    if (fs.existsSync(districtsPath)) {
        console.log(`Processing ${districtsPath}...`);
        const districtsRaw = fs.readFileSync(districtsPath, 'utf8');
        const districts = JSON.parse(districtsRaw);

        let districtCount = 0;
        const cleanedDistricts = districts.map(d => {
            const originalName = d.name_th;
            const newName = cleanName(d.name_th, 'เขต');
            if (originalName !== newName) {
                districtCount++;
            }
            return { ...d, name_th: newName };
        });

        fs.writeFileSync(districtsPath, JSON.stringify(cleanedDistricts, null, 2), 'utf8');
        console.log(`✅ Cleaned ${districtCount} districts (removed 'เขต').`);
    } else {
        console.log(`⚠️ File not found: ${districtsPath}`);
    }
} catch (error) {
    console.error(`❌ Error processing districts: ${error.message}`);
}

// Process Sub-districts
try {
    if (fs.existsSync(subDistrictsPath)) {
        console.log(`Processing ${subDistrictsPath}...`);
        const subDistrictsRaw = fs.readFileSync(subDistrictsPath, 'utf8');
        const subDistricts = JSON.parse(subDistrictsRaw);

        let subDistrictCount = 0;
        const cleanedSubDistricts = subDistricts.map(sd => {
            const originalName = sd.name_th;
            const newName = cleanName(sd.name_th, 'แขวง');
            if (originalName !== newName) {
                subDistrictCount++;
            }
            return { ...sd, name_th: newName };
        });

        fs.writeFileSync(subDistrictsPath, JSON.stringify(cleanedSubDistricts, null, 2), 'utf8');
        console.log(`✅ Cleaned ${subDistrictCount} sub-districts (removed 'แขวง').`);
    } else {
        console.log(`⚠️ File not found: ${subDistrictsPath}`);
    }
} catch (error) {
    console.error(`❌ Error processing sub-districts: ${error.message}`);
}
