const XLSX = require('xlsx');

const file = 'AllLiteDetailOrder20260515122631514.xlsx';
try {
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length > 0) {
        console.log("Headers:");
        data[0].forEach((col, i) => console.log(`[${i}] ${col}`));
        
        if (data.length > 1) {
            console.log("\nFirst Data Row:");
            data[1].forEach((val, i) => console.log(`[${i}] ${val}`));
        }
    } else {
        console.log("File is empty.");
    }
} catch (e) {
    console.error("Error reading file:", e);
}
