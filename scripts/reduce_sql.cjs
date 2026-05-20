const fs = require('fs');
const readline = require('readline');

const IN_FILE = 'api/migrations/primacom_mini_erp (19).sql';
const OUT_FILE = 'api/migrations/primacom_mini_erp_test_reduced.sql';

async function processSql() {
  const fileStream = fs.createReadStream(IN_FILE, { encoding: 'latin1' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const outStream = fs.createWriteStream(OUT_FILE, { encoding: 'latin1' });

  // Limits for non-company 5 data
  let otherCustomersKept = 0;
  const MAX_OTHER_CUSTOMERS = 15000;

  // We will keep a set of allowed customer IDs and order IDs to try and keep some relational integrity
  // but since we process sequentially, we might miss some. 
  // We'll rely on `mysql -f` for foreign keys anyway.
  
  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount % 50000 === 0) {
      console.log(`Processed ${lineCount} lines...`);
    }

    if (!line.startsWith('INSERT INTO ')) {
      // Keep schema definition and other commands
      outStream.write(line + '\n');
      continue;
    }

    // It's an INSERT statement.
    // Format: INSERT INTO `table` (`col1`, ...) VALUES (v1, v2), (v3, v4);
    
    // Quick regex to find the VALUES part
    const valuesMatch = line.match(/^(INSERT INTO `[^`]+` \([^)]+\) VALUES\s*)(.*);$/);
    if (!valuesMatch) {
      // Maybe no columns specified or multiline? Just write it
      outStream.write(line + '\n');
      continue;
    }

    const prefix = valuesMatch[1];
    const tuplesStr = valuesMatch[2];

    const isCustomers = line.startsWith('INSERT INTO `customers`');
    const isOrders = line.startsWith('INSERT INTO `orders`');
    const isOrderItems = line.startsWith('INSERT INTO `order_items`');
    
    // If it's a huge table, filter it. Otherwise, write it.
    if (!isCustomers && !isOrders && !isOrderItems) {
      // Just keep 5% of rows for other large tables to save space, 
      // or keep all if we don't care (but we want a small file).
      // Actually, if it's not a main table, let's just keep 10% of tuples to shrink size.
      const tuples = parseTuples(tuplesStr);
      const filtered = tuples.filter(() => Math.random() < 0.10);
      if (filtered.length > 0) {
        outStream.write(prefix + filtered.join(',') + ';\n');
      }
      continue;
    }

    const tuples = parseTuples(tuplesStr);
    const filteredTuples = [];

    for (const tuple of tuples) {
      // Extract values inside parenthesis
      // This is a naive split by comma, ignoring commas inside strings
      // For a robust approach we should handle quotes, but since we are just looking for company_id, 
      // we can look for `,5,` or just randomly sample.
      
      if (isCustomers) {
        // Look for company_id = 5. In customers, company_id is around 10th column.
        // It's usually preceded by province, email, etc.
        if (tuple.includes(',5,') || tuple.includes(', 5,')) {
          filteredTuples.push(tuple);
        } else {
          if (otherCustomersKept < MAX_OTHER_CUSTOMERS) {
            filteredTuples.push(tuple);
            otherCustomersKept++;
          }
        }
      } else if (isOrders) {
        // Look for company_id = 5.
        if (tuple.includes(',5,') || tuple.includes(', 5,')) {
          filteredTuples.push(tuple);
        } else {
          // Keep a small random fraction of other orders
          if (Math.random() < 0.05) {
            filteredTuples.push(tuple);
          }
        }
      } else if (isOrderItems) {
        // Hard to link to order_id without full parse. Just keep 20%.
        if (Math.random() < 0.20) {
          filteredTuples.push(tuple);
        }
      }
    }

    if (filteredTuples.length > 0) {
      outStream.write(prefix + filteredTuples.join(',') + ';\n');
    }
  }

  outStream.end();
  console.log('Reduction complete!');
}

function parseTuples(str) {
  // A naive parser to split `(1, 'a'),(2, 'b')` into `["(1, 'a')", "(2, 'b')"]`
  const tuples = [];
  let currentTuple = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      currentTuple += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      currentTuple += char;
      continue;
    }

    if (char === "'") {
      inString = !inString;
      currentTuple += char;
      continue;
    }

    if (!inString && char === ')' && currentTuple.startsWith('(')) {
      currentTuple += char;
      tuples.push(currentTuple.trim());
      currentTuple = '';
      // skip comma
      if (i + 1 < str.length && str[i + 1] === ',') {
        i++;
      }
      continue;
    }

    if (currentTuple !== '' || char === '(') {
      currentTuple += char;
    }
  }

  return tuples;
}

processSql().catch(console.error);
