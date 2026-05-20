const fs = require('fs');
const readline = require('readline');

async function peek() {
  const fileStream = fs.createReadStream('api/migrations/primacom_mini_erp (19).sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lines = [];
  for await (const line of rl) {
    if (line.startsWith('INSERT INTO `customers`') || line.startsWith('INSERT INTO `orders`')) {
      console.log(line.substring(0, 500));
      lines.push(line);
      if (lines.length >= 2) {
        break;
      }
    }
  }
}

peek();
