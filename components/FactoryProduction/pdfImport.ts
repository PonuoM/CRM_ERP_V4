/**
 * อ่าน "ใบจองสินค้า/ใบสั่งขาย" จาก e-acc (ไฟล์ PDF ที่ print จากหน้าเว็บด้วย Chrome)
 * แล้วแปลงเป็นข้อมูลที่เอาไปเปิด SO / คีย์ใบขน ได้เลย
 *
 * ส่วนนี้ตั้งใจให้ "บริสุทธิ์" — รับแค่ text item + พิกัด ไม่ยุ่งกับ pdf.js หรือ DOM
 * เพื่อให้เทสต์กับไฟล์จริงได้ (ดู pdfExtract.ts สำหรับฝั่งที่ดึง item ออกจาก PDF)
 *
 * ข้อสังเกตจากไฟล์จริง (SO-PN2608016 / SO-PN2608022):
 *  - ฟอนต์เป็น Identity-H + มี ToUnicode ครบ ข้อความจึงดึงออกมาได้ ไม่ต้อง OCR
 *  - ภาษาไทยถูกซอยเป็นชิ้นตามตำแหน่งสระ/วรรณยุกต์ ต้องต่อกลับด้วยพิกัด x
 *  - วรรณยุกต์ที่ซ้อนบนสระบน (เช่น "ที่" "สั่ง") ฟอนต์ใช้ glyph รูปยกที่ไม่มีใน ToUnicode
 *    จึงหลุดออกมาเป็น U+0000 — กู้กลับเป๊ะ ๆ ไม่ได้ ใช้วิธีเดาเป็นไม้เอกซึ่งพบบ่อยสุด
 *    ค่าที่ต้องแม่นจริง ๆ (เลขเอกสาร/รหัสสินค้า/จำนวน/วันที่) เป็น ASCII หมด จึงไม่โดนปัญหานี้
 */

export interface RawTextItem {
  str: string;
  /** พิกัดจาก transform[4] / transform[5] ของ pdf.js */
  x: number;
  y: number;
  width: number;
  page: number;
}

export interface ParsedDocItem {
  lineNo: number;
  sku: string;
  name: string;
  qty: number;
  unit: string;
  /** ฝ่ายผลิตตามใบ เช่น ปุ๋ยน้ำ / ไบโอ */
  department: string;
}

export interface ParsedDoc {
  docNumber: string;
  /** วันที่สั่ง (ISO yyyy-mm-dd) */
  docDate: string | null;
  /** วันที่รับสินค้า (ISO yyyy-mm-dd) */
  receiveDate: string | null;
  customerCode: string;
  customerName: string;
  customerAddress: string;
  warehouseName: string;
  coordinator: string;
  items: ParsedDocItem[];
  /** ยอดรวมตามบรรทัด "รวม" ของเอกสาร — ใช้ทานกับผลรวมของ items */
  totalQty: number | null;
  warnings: string[];
  /** บรรทัดที่อ่านได้ (normalize แล้ว) — ไว้ให้ดูตอนเอกสารหน้าตาเปลี่ยน */
  lines: string[];
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** สระ/วรรณยุกต์ที่ลอยอยู่บน-ล่าง ไม่กินความกว้าง */
const THAI_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;

const NIKHAHIT = '\u0E4D';   // ํ
const SARA_AA = '\u0E32';    // า
const SARA_AM = '\u0E33';    // ำ
const MAI_EK = '\u0E48';     // ่
const MAI_THO = '\u0E49';    // ้

/**
 * ซ่อมข้อความไทยที่หลุดออกมาจาก PDF
 *  - นิคหิต + สระอา => สระอำ                        เช่น "จํา" => "จำ"
 *  - นิคหิต + NUL + สระอา => ไม้โท + สระอำ          เช่น "นํ\0า" => "น้ำ"
 *  - NUL ที่เหลือ = วรรณยุกต์ที่ ToUnicode ไม่มี เดาเป็นไม้เอก (พบบ่อยสุด) เช่น "ที\0" => "ที่"
 */
export const normalizeThai = (s: string): string =>
  s
    .replace(new RegExp(NIKHAHIT + '\u0000' + SARA_AA, 'g'), MAI_THO + SARA_AM)
    .replace(new RegExp(NIKHAHIT + SARA_AA, 'g'), SARA_AM)
    .replace(new RegExp(NIKHAHIT + '\u0000', 'g'), MAI_THO)
    .replace(/\u0000/g, MAI_EK)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

/** ตัดสระ/วรรณยุกต์/ช่องว่างทิ้ง เพื่อเทียบ label แบบไม่แคร์ว่าวรรณยุกต์จะเพี้ยนไหม */
const thaiKey = (s: string): string =>
  normalizeThai(s).replace(THAI_MARKS, '').replace(/[\s.:]/g, '');

export interface DocCell { text: string; x: number; }
export interface DocLine { page: number; y: number; cells: DocCell[]; text: string; }

/**
 * รวม text item เป็นบรรทัด แล้วซอยบรรทัดเป็น "ช่อง" ตามระยะห่าง
 * ช่องว่างกว้าง = คนละคอลัมน์ในตาราง / คนละ label-value
 */
export const buildLines = (items: RawTextItem[], gap = 8): DocLine[] => {
  const rows: { page: number; y: number; items: RawTextItem[] }[] = [];
  items
    .filter(i => i.str && i.str.trim() !== '')
    .forEach(it => {
      const row = rows.find(r => r.page === it.page && Math.abs(r.y - it.y) <= 3);
      if (row) row.items.push(it);
      else rows.push({ page: it.page, y: it.y, items: [it] });
    });

  rows.sort((a, b) => (a.page - b.page) || (b.y - a.y));

  return rows.map(row => {
    row.items.sort((a, b) => a.x - b.x);
    const cells: DocCell[] = [];
    let end = -Infinity;
    row.items.forEach(it => {
      if (cells.length === 0 || it.x - end > gap) {
        cells.push({ text: it.str, x: it.x });
      } else {
        cells[cells.length - 1].text += it.str;
      }
      end = it.x + it.width;
    });
    const clean = cells
      .map(c => ({ text: normalizeThai(c.text), x: c.x }))
      .filter(c => c.text !== '');
    return {
      page: row.page,
      y: row.y,
      cells: clean,
      text: clean.map(c => c.text).join(' '),
    };
  });
};

/** "14 ส.ค. 2569" -> "2026-08-14" (พ.ศ. -> ค.ศ.) */
export const parseThaiDate = (raw: string): string | null => {
  const s = normalizeThai(raw);
  const m = s.match(/(\d{1,2})\s*([\u0E00-\u0E7F.]+)\s*(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const monthText = m[2].replace(/\s/g, '');
  const year = Number(m[3]);
  const idx = THAI_MONTHS.findIndex(mn => monthText.startsWith(mn) || mn.startsWith(monthText));
  if (idx < 0 || !day || !year) return null;
  const ce = year > 2400 ? year - 543 : year;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ce}-${pad(idx + 1)}-${pad(day)}`;
};

const toQty = (raw: string): number => Number(raw.replace(/,/g, '')) || 0;

const findLine = (lines: DocLine[], label: string): DocLine | undefined => {
  const key = thaiKey(label);
  return lines.find(l => l.cells.length > 0 && thaiKey(l.cells[0].text).startsWith(key));
};

/** ค่าที่อยู่หลัง label ในบรรทัดเดียวกัน */
const valueAfterLabel = (line: DocLine | undefined): string[] =>
  (line ? line.cells.slice(1).map(c => c.text).filter(t => t !== ':' && t !== '') : []);

const SKU_RE = /^[A-Z]{2,5}[A-Z0-9]{4,}$/;
const QTY_RE = /^\d{1,3}(,\d{3})*(\.\d{1,2})?$/;

/** อ่านเอกสาร 1 ใบจาก text item ที่ดึงมาจาก PDF */
export const parseProductionDoc = (items: RawTextItem[]): ParsedDoc => {
  const lines = buildLines(items);
  const warnings: string[] = [];

  const docLine = findLine(lines, 'เลขที่เอกสาร');
  const docNumber = valueAfterLabel(docLine).pop() ?? '';
  if (!docNumber) warnings.push('อ่าน "เลขที่เอกสาร" ไม่เจอ');

  /* บางใบ label ชิดกับค่าจนถูกรวมเป็นช่องเดียว จึงอ่านวันที่จากทั้งบรรทัด */
  const dateOfLine = (line: DocLine | undefined) => (line ? parseThaiDate(line.text) : null);
  const docDate = dateOfLine(findLine(lines, 'วันที่สั่ง'));
  if (!docDate) warnings.push('อ่าน "วันที่สั่ง" ไม่เจอ');
  const receiveDate = dateOfLine(findLine(lines, 'วันที่รับสินค้า'));

  const customerCells = valueAfterLabel(findLine(lines, 'นามลูกค้า'))
    .filter(t => thaiKey(t) !== thaiKey('โทร'));
  const customerCode = customerCells[0] ?? '';
  const customerName = customerCells.slice(1).join(' ').replace(/\s*:\s*$/, '').trim();

  const addressCells = valueAfterLabel(findLine(lines, 'ที่อยู่'));
  const customerAddress = addressCells.join(' ');

  const warehouseLine = lines.find(l => l.cells.some(c => thaiKey(c.text).startsWith(thaiKey('คลังสินค้า'))));
  const warehouseName = warehouseLine
    ? (warehouseLine.cells[warehouseLine.cells.length - 1]?.text ?? '')
    : '';

  /* ผู้ประสานงานเซ็นอยู่บรรทัดเหนือ label "ผู้ประสานงาน" */
  let coordinator = '';
  const coordLabelIdx = lines.findIndex(l => l.cells.some(c => thaiKey(c.text).startsWith(thaiKey('ผู้ประสานงาน'))));
  if (coordLabelIdx > 0) {
    coordinator = lines[coordLabelIdx - 1].cells[0]?.text ?? '';
  }

  /* บรรทัดสินค้า: ลำดับ + รหัส ASCII + ... + จำนวน + หน่วย + ฝ่ายผลิต */
  const docItems: ParsedDocItem[] = [];
  lines.forEach(line => {
    const c = line.cells;
    if (c.length < 4) return;
    if (!/^\d{1,3}$/.test(c[0].text)) return;
    if (!SKU_RE.test(c[1].text.replace(/\s/g, ''))) return;

    const qtyIdx = c.map(x => x.text).reduce((found, text, i) =>
      (i >= 2 && QTY_RE.test(text.replace(/\s/g, '')) ? i : found), -1);
    if (qtyIdx < 0) {
      warnings.push(`บรรทัด "${c[1].text}" อ่านจำนวนไม่ออก`);
      return;
    }
    docItems.push({
      lineNo: Number(c[0].text),
      sku: c[1].text.replace(/\s/g, ''),
      name: c.slice(2, qtyIdx).map(x => x.text).join(' ').trim(),
      qty: toQty(c[qtyIdx].text),
      unit: c[qtyIdx + 1]?.text ?? '',
      department: c[qtyIdx + 2]?.text ?? c[c.length - 1]?.text ?? '',
    });
  });
  if (docItems.length === 0) warnings.push('อ่านรายการสินค้าไม่เจอสักบรรทัด');

  const totalLine = lines.find(l => l.cells.length >= 2 && thaiKey(l.cells[0].text) === thaiKey('รวม'));
  const totalRaw = totalLine?.cells[totalLine.cells.length - 1]?.text ?? '';
  const totalQty = QTY_RE.test(totalRaw.replace(/\s/g, '')) ? toQty(totalRaw) : null;

  const sum = docItems.reduce((s, i) => s + i.qty, 0);
  if (totalQty !== null && Math.abs(sum - totalQty) > 0.01) {
    warnings.push(`ยอดรวมในเอกสาร ${totalQty.toLocaleString()} ไม่ตรงกับผลรวมรายการ ${sum.toLocaleString()}`);
  }

  return {
    docNumber,
    docDate,
    receiveDate,
    customerCode,
    customerName,
    customerAddress,
    warehouseName,
    coordinator,
    items: docItems,
    totalQty,
    warnings,
    lines: lines.map(l => l.text),
  };
};
