const fs = require('fs');
const readline = require('readline');

async function checkValues(filename) {
  const fileStream = fs.createReadStream(filename);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO `customers`')) {
      const match = line.match(/VALUES\s*(.+)/);
      if (match) {
        console.log('---', filename, '---');
        console.log(match[1].substring(0, 300));
        break;
      }
    }
  }
}

async function run() {
  await checkValues('api/migrations/primacom_mini_erp (19).sql');
  await checkValues('api/migrations/primacom_mini_erp_test_reduced.sql');
}
run();
