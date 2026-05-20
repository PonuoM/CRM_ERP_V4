
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\AppServ\\www\\CRM_ERP_V4\\api\\Address_DB\\sub_districts.json';

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const subDistricts = JSON.parse(data);

    // Default Saen Suk variant
    const newEntry = {
        "id": 961304,
        "zip_code": "20000",
        "name_th": "แสนสุข",
        "name_en": "Saen Suk",
        "district_id": 2001,
        "lat": 13.274,
        "long": 100.928,
        "created_at": "2019-08-09T03:33:09.000+07:00",
        "updated_at": "2025-09-20T06:31:26.000+07:00",
        "deleted_at": null
    };

    // Check if already exists
    const exists = subDistricts.find(sd => sd.id === 961304);
    if (exists) {
        console.log('Entry 961304 already exists. Skipping.');
    } else {
        // Insert after the existing Saen Suk (200112) for tidiness, or just push
        const index = subDistricts.findIndex(sd => sd.id === 200112);
        if (index !== -1) {
            subDistricts.splice(index + 1, 0, newEntry);
            console.log('Inserted new Saen Suk variant after ID 200112.');
        } else {
            subDistricts.push(newEntry);
            console.log('Appended new Saen Suk variant.');
        }

        fs.writeFileSync(filePath, JSON.stringify(subDistricts, null, 2), 'utf8');
        console.log('File updated successfully.');
    }

} catch (e) {
    console.error(e);
}
