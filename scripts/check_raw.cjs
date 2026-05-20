const fs = require('fs');

function checkFile(filename) {
  const fd = fs.openSync(filename, 'r');
  const buffer = Buffer.alloc(1024 * 1024); // read 1MB
  fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);

  const str = buffer.toString('utf8');
  const idx = str.indexOf('INSERT INTO `customers`');
  if (idx !== -1) {
    const chunk = str.substring(idx, idx + 500);
    console.log('--- UTF8 Decode of', filename, '---');
    console.log(chunk);
    
    // Check if it has replacement characters
    if (chunk.includes('\uFFFD')) {
      console.log('WARNING: Found U+FFFD (Replacement Character) meaning it is NOT valid UTF-8!');
      
      const iconv = require('iconv-lite');
      const decoded874 = iconv.decode(buffer.slice(idx, idx + 500), 'win874');
      console.log('--- WIN874 Decode ---');
      console.log(decoded874);
    }
  } else {
    console.log('INSERT INTO customers not found in first 1MB of', filename);
  }
}

try {
  checkFile('api/migrations/primacom_mini_erp (19).sql');
} catch (e) { console.error(e); }
