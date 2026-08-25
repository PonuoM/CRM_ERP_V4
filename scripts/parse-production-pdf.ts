/**
 * ดูว่าระบบอ่านอะไรได้บ้างจากใบจองสินค้า/ใบสั่งขาย (PDF จาก e-acc)
 *
 *   npx tsx scripts/parse-production-pdf.ts "SO สั่งผลิต.PDF"
 *
 * ใช้ตอนเอกสารต้นทางเปลี่ยนหน้าตาแล้วนำเข้าไม่ขึ้น จะได้เห็นว่า parser มองเห็นอะไร
 */
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseProductionDoc, buildLines, type RawTextItem } from '../components/FactoryProduction/pdfImport';

const file = process.argv[2];
/** --raw = พิมพ์บรรทัด+ช่องดิบที่อ่านได้ ใช้ตอนเอกสารเปลี่ยนหน้าตาแล้วต้องออกแบบ parser ใหม่ */
const showRaw = process.argv.includes('--raw');
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;

const items: RawTextItem[] = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  for (const raw of tc.items as any[]) {
    if (typeof raw?.str !== 'string') continue;
    items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], width: raw.width ?? 0, page: p });
  }
}

if (showRaw) {
  for (const line of buildLines(items)) {
    console.log(
      String(Math.round(line.y)).padStart(5),
      '|',
      line.cells.map(c => `${Math.round(c.x)}:${c.text}`).join('  ')
    );
  }
  process.exit(0);
}

const parsed = parseProductionDoc(items);
console.log('=== ', file, ' ===');
console.log('ชนิดเอกสาร   :', parsed.kind);
console.log('อ้างถึง SO   :', parsed.soReference || '-');
console.log('เลขที่เอกสาร :', parsed.docNumber);
console.log('วันที่สั่ง    :', parsed.docDate);
console.log('วันที่รับ     :', parsed.receiveDate);
console.log('ลูกค้า        :', parsed.customerCode, '|', parsed.customerName);
console.log('ที่อยู่        :', parsed.customerAddress);
console.log('คลัง          :', parsed.warehouseName);
console.log('ผู้ประสานงาน  :', parsed.coordinator);
console.log('ยอดรวมในใบ    :', parsed.totalQty);
console.log('รายการ        :');
for (const it of parsed.items) {
  console.log(`   ${it.lineNo}. ${it.sku.padEnd(12)} ${String(it.qty).padStart(9)} ${it.unit.padEnd(8)} ${it.department.padEnd(8)} ${it.name}`);
}
console.log('warnings      :', parsed.warnings);
