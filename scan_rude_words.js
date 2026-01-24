
import fs from 'fs';
import readline from 'readline';

// const filePath = 'c:/AppServ/www/CRM_ERP_V4/กล๊อฟคำหยาบ.csv';
// Switch to test file for verification, or use the real file. 
// Let's make it configurable via argument, default to real file.
const args = process.argv.slice(2);
const filePath = args[0] || 'c:/AppServ/www/CRM_ERP_V4/กล๊อฟคำหยาบ.csv';

const rudePatterns = [
    // Direct matches (Simple)
    { pattern: /ห่า/, label: 'ห่า' },
    { pattern: /เหี้ย/, label: 'เหี้ย' },
    { pattern: /มึง/, label: 'มึง' },
    { pattern: /กู/, label: 'กู' },
    { pattern: /ส้นตีน/, label: 'ส้นตีน' },
    { pattern: /ปัญญาอ่อน/, label: 'ปัญญาอ่อน' },
    { pattern: /ขี้เกลียด/, label: 'ขี้เกลียด' },
    { pattern: /ขี้โม้/, label: 'ขี้โม้' },
    { pattern: /ปากอม/, label: 'ปากอม' },
    { pattern: /เลว/, label: 'เลว' },
    { pattern: /บ้า/, label: 'บ้า' },
    { pattern: /ปากหมา/, label: 'ปากหมา' },
    { pattern: /สันดาน/, label: 'สันดาน' },
    { pattern: /สัส/, label: 'สัส' },
    { pattern: /เย็ด/, label: 'เย็ด' },
    { pattern: /ควย/, label: 'ควย' },
    { pattern: /แม่ง/, label: 'แม่ง' },
    { pattern: /ชิบหาย/, label: 'ชิบหาย' },
    { pattern: /ตอแหล/, label: 'ตอแหล' },
    { pattern: /เสือก/, label: 'เสือก' },

    // Context-aware matches (Regex)
    // ดอก: Catch 'อีดอก', 'ไอ้ดอก', 'ดอกทอง' but IGNORE 'ดอก' alone (e.g. ออกดอก, ติดดอก)
    { pattern: /(อี|ไอ้)ดอก|ดอกทอง/, label: 'ดอก (Context)' },

    // สัตว์: Catch 'สัตว์' but IGNORE 'สัตว์เลี้ยง', 'สัตว์แพทย์', 'ปศุสัตว์'
    { pattern: /สัตว์(?!เลี้ยง|แพทย์|น้ำ|ปีก)/, label: 'สัตว์ (Context)' },

    // ควาย: Catch 'ควาย' but IGNORE 'ขี้ควาย', 'ปุ๋ยควาย' (Usually agriculture context) 
    // AND Ignore if preceded by 'ขี้' (e.g. ปุ๋ยขี้ควาย)
    { pattern: /(?<!ขี้|ปุ๋ย|เลี้ยง)ควาย/, label: 'ควาย (Context)' }
];

async function scanFile() {
    console.log(`Scanning file: ${filePath}`);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineNumber = 0;
    let foundCount = 0;

    console.log('Scanning file for rude words...');
    console.log('-----------------------------------');

    for await (const line of rl) {
        lineNumber++;
        let matched = false;

        for (const { pattern, label } of rudePatterns) {
            if (pattern.test(line)) {

                // Double check for specific 'ดอก' safety if regex didn't cover everything
                // (The regex above handles most, but ensuring manual safety if needed)

                // Extract ID (assuming first column before first comma)
                const idMatch = line.match(/^([^,]+),/);
                const id = idMatch ? idMatch[1] : 'Unknown';

                console.log(`[Line ${lineNumber}] ID: ${id} | Key: "${label}"`);
                console.log(line.trim()); // No truncation for full evidence
                console.log('-----------------------------------');
                foundCount++;
                matched = true;
                break; // One rude word is enough to flag the line
            }
        }
    }

    console.log(`Scan complete. Found ${foundCount} suspicious lines out of ${lineNumber} total lines.`);
}

scanFile().catch(err => console.error(err));
