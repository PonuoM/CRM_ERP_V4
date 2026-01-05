
const fs = require('fs');
const path = require('path');

const districtsPath = 'c:\\AppServ\\www\\CRM_ERP_V4\\api\\Address_DB\\districts.json';
const subDistrictsPath = 'c:\\AppServ\\www\\CRM_ERP_V4\\api\\Address_DB\\sub_districts.json';

try {
    const districts = JSON.parse(fs.readFileSync(districtsPath, 'utf8'));
    const subDistricts = JSON.parse(fs.readFileSync(subDistrictsPath, 'utf8'));

    const chonburiDistrict = districts.find(d => d.name_th === 'เมืองชลบุรี');

    if (!chonburiDistrict) {
        console.log('District "เมืองชลบุรี" not found');
        process.exit(1);
    }

    console.log(`Found District: ${chonburiDistrict.name_th} (ID: ${chonburiDistrict.id})`);

    const subDistrictsInChonburi = subDistricts.filter(sd => sd.district_id === chonburiDistrict.id);

    console.log(`Found ${subDistrictsInChonburi.length} sub-districts in ${chonburiDistrict.name_th}`);

    const saenSuk = subDistrictsInChonburi.find(sd => sd.name_th === 'แสนสุข');

    if (saenSuk) {
        console.log(`Found "แสนสุข":`, saenSuk);
    } else {
        console.log(`"แสนสุข" NOT found in district ${chonburiDistrict.id}`);
        // List what IS there
        console.log('Available sub-districts:', subDistrictsInChonburi.map(sd => sd.name_th).join(', '));
    }

} catch (e) {
    console.error(e);
}
