const fs = require('fs');

function fixCsvLineBreaks(inputFile, outputFile) {
    console.log(`Processing ${inputFile}...`);
    const content = fs.readFileSync(inputFile, 'utf8');

    let inQuote = false;
    let result = '';

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (char === '"') {
            inQuote = !inQuote;
            result += char;
        } else if ((char === '\n' || char === '\r') && inQuote) {
            // Replace newline inside quotes with space
            if (char === '\r' && content[i + 1] === '\n') {
                i++; // Skip \n after \r
            }
            result += ' ';
        } else {
            result += char;
        }
    }

    fs.writeFileSync(outputFile, result, 'utf8');

    // Count lines
    const originalLines = content.split('\n').length;
    const fixedLines = result.split('\n').length;
    console.log(`Original: ${originalLines} lines, Fixed: ${fixedLines} lines`);
    console.log(`Saved to ${outputFile}`);
}

// Fix both files
fixCsvLineBreaks(
    'sales_template (เชื้อเทเล)(1).csv',
    'sales_template_tele_fixed.csv'
);

fixCsvLineBreaks(
    'sales_template (เชื้อแอดมิน)(1).csv',
    'sales_template_admin_fixed.csv'
);

console.log('\nDone! Use these files for import:');
console.log('- sales_template_tele_fixed.csv');
console.log('- sales_template_admin_fixed.csv');
