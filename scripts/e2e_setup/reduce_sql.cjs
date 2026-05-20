const fs = require('fs');
const readline = require('readline');

const inputFile = 'api/migrations/primacom_mini_erp (19).sql';
const outputFile = 'api/migrations/primacom_mini_erp_test_reduced.sql';

if (!fs.existsSync(inputFile)) {
    console.error(`Error: ${inputFile} not found`);
    process.exit(1);
}

const rl = readline.createInterface({
    input: fs.createReadStream(inputFile, { encoding: 'utf8' }),
    output: fs.createWriteStream(outputFile, { encoding: 'utf8' }),
    terminal: false
});

let customerInsertCount = 0;
const MAX_CUSTOMER_INSERTS = 100;

console.log(`Reading ${inputFile} and filtering 'customers' inserts...`);

rl.on('line', (line) => {
    if (line.startsWith("INSERT INTO `customers`")) {
        if (customerInsertCount < MAX_CUSTOMER_INSERTS) {
            rl.output.write(line + '\n');
            customerInsertCount++;
        }
    } else {
        rl.output.write(line + '\n');
    }
});

rl.on('close', () => {
    console.log(`Done. Kept ${customerInsertCount} INSERT statements for 'customers'.`);
    console.log(`Output saved to ${outputFile}`);
});
