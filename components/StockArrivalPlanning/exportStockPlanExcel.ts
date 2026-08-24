import ExcelJS from 'exceljs';
import { StockPlanRow, ProductSummary, STATUS_META, rowStatus, movedFromLabel } from './types';
import {
  buildMonthWeeks,
  weekLabelOf,
  calendarItemLabel,
  WEEKDAY_NAMES_TH,
  MONTH_NAMES_TH,
} from './calendarGrid';

/** สีพื้น/สีตัวอักษรของแต่ละสถานะ — ล้อกับ badge บนหน้าจอ (STATUS_META) */
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'FFF3F4F6', text: 'FF4B5563' },      // เทา — รอกำหนดวันที่คาดว่าจะเข้า
  expected: { bg: 'FFFFEDD5', text: 'FF9A3412' },     // ส้ม — คาดว่าจะเข้า
  confirmed: { bg: 'FFDCFCE7', text: 'FF15803D' },    // เขียว — ยืนยันรับเข้าแล้ว
  closed_short: { bg: 'FFFEE2E2', text: 'FFB91C1C' }, // แดง — ปิด-ไม่ครบ
};

const GRID_LINE = 'FFD1D5DB';
const BLOCK_LINE = 'FF9CA3AF';
const HOLIDAY_BG = 'FFFEF2F2';
const OUTSIDE_BG = 'FFF9FAFB';

const DAY_COL_START = 2; // A = คอลัมน์สัปดาห์, B..H = จ..อา
const LAST_COL = DAY_COL_START + 6;

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const rowQty = (row: StockPlanRow) =>
  row.kind === 'pending' ? row.remaining_qty : (row.actual_qty ?? row.expected_qty);

/** ข้อความในช่องรายการ: "ชื่อสินค้า · จำนวน" (+ ที่มา ถ้าถูกเลื่อนวัน) */
const itemText = (row: StockPlanRow) => {
  const name = row.item.product_name ?? row.item.sku ?? row.item.product_id;
  const base = calendarItemLabel(name, rowQty(row));
  const moved = movedFromLabel(row);
  return moved ? `${base}  (${moved})` : base;
};

interface ExportArgs {
  year: number;
  month: number;
  itemsByDay: Record<string, StockPlanRow[]>;
  rows: StockPlanRow[];
  productSummaries: ProductSummary[];
  holidays: string[];
}

/**
 * Export แพลนรับสินค้าเป็น Excel 3 ชีต
 *  1) "ปฏิทิน"       — ตารางปฏิทินหน้าตาเหมือนบนหน้าจอ แต่แสดง "ทุกรายการ" ของแต่ละวัน
 *                       (หน้าจอตัดที่ 5 รายการแล้วขึ้น "+N เพิ่มเติม" — ในไฟล์ไม่ตัด)
 *  2) "สรุปรายสินค้า" — ยอดวางแผน/รับเข้า/คงค้าง ต่อ SKU
 *  3) "ข้อมูลดิบ"     — ทุกแถวแบบ flat ไว้ pivot ต่อ
 */
export const buildStockPlanWorkbook = ({
  year, month, itemsByDay, rows, productSummaries, holidays,
}: ExportArgs): ExcelJS.Workbook => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Prima CRM/ERP';

  buildCalendarSheet(wb, { year, month, itemsByDay, holidays });
  buildSummarySheet(wb, productSummaries);
  buildRawSheet(wb, rows);

  return wb;
};

/** สร้างไฟล์แล้วสั่งดาวน์โหลดในเบราว์เซอร์ */
export const exportStockPlanExcel = async (args: ExportArgs): Promise<void> => {
  const { year, month } = args;
  const wb = buildStockPlanWorkbook(args);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Stock_Arrival_Plan_${year}_${String(month).padStart(2, '0')}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const buildCalendarSheet = (
  wb: ExcelJS.Workbook,
  { year, month, itemsByDay, holidays }: Pick<ExportArgs, 'year' | 'month' | 'itemsByDay' | 'holidays'>,
) => {
  const ws = wb.addWorksheet('ปฏิทิน', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  ws.getColumn(1).width = 9;
  for (let c = DAY_COL_START; c <= LAST_COL; c++) ws.getColumn(c).width = 30;

  const holidaySet = new Set(holidays);
  const todayStr = new Date().toISOString().slice(0, 10);

  // หัวเรื่อง + คำอธิบายสี
  ws.mergeCells(1, 1, 1, LAST_COL);
  const title = ws.getCell(1, 1);
  title.value = `แพลนรับสินค้า — ${MONTH_NAMES_TH[month - 1]} ${year + 543}`;
  title.font = { bold: true, size: 16, color: { argb: 'FF111827' } };
  title.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, LAST_COL);
  const legend = ws.getCell(2, 1);
  legend.value =
    'สถานะ: เทา = รอกำหนดวันที่คาดว่าจะเข้า | ส้ม = คาดว่าจะเข้า | เขียว = ยืนยันรับเข้าแล้ว | แดง = ปิด-ไม่ครบ   ·   ช่องพื้นชมพู = วันหยุดโรงงาน   ·   รูปแบบรายการ: ชื่อสินค้า · จำนวน';
  legend.font = { size: 9, color: { argb: 'FF6B7280' } };
  ws.getRow(2).height = 15;
  ws.getRow(3).height = 6;

  // หัวตาราง: Week / จ อ พ พฤ ศ ส อา
  const headRowIdx = 4;
  ws.getRow(headRowIdx).height = 20;
  const headCell = (col: number, text: string, sunday = false) => {
    const cell = ws.getCell(headRowIdx, col);
    cell.value = text;
    cell.fill = solid('FF374151');
    cell.font = { bold: true, size: 10, color: { argb: sunday ? 'FFFCA5A5' : 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: BLOCK_LINE } },
      bottom: { style: 'thin', color: { argb: BLOCK_LINE } },
      left: { style: 'thin', color: { argb: BLOCK_LINE } },
      right: { style: 'thin', color: { argb: BLOCK_LINE } },
    };
  };
  headCell(1, 'Week');
  WEEKDAY_NAMES_TH.forEach((w, i) => headCell(DAY_COL_START + i, w, i === 6));

  // ตัวปฏิทิน: 1 สัปดาห์ = 1 บล็อก (แถวหัววัน + แถวรายการเท่าจำนวนรายการมากสุดของสัปดาห์นั้น)
  const weeks = buildMonthWeeks(year, month);
  let cursor = headRowIdx + 1;

  weeks.forEach(week => {
    const dayItems = week.map(cell => itemsByDay[cell.dateStr] ?? []);
    const itemRowCount = Math.max(1, ...dayItems.map(list => list.length));
    const dayRowIdx = cursor;
    const lastRowIdx = dayRowIdx + itemRowCount;

    const blockBorder = (r: number, c: number) => {
      ws.getCell(r, c).border = {
        top: r === dayRowIdx
          ? { style: 'medium', color: { argb: BLOCK_LINE } }
          : { style: 'hair', color: { argb: GRID_LINE } },
        bottom: r === lastRowIdx
          ? { style: 'medium', color: { argb: BLOCK_LINE } }
          : { style: 'hair', color: { argb: GRID_LINE } },
        left: { style: 'thin', color: { argb: BLOCK_LINE } },
        right: { style: 'thin', color: { argb: BLOCK_LINE } },
      };
    };

    // คอลัมน์สัปดาห์ (M8 / W2) — ผสานทั้งบล็อก
    const { monthNo, weekNo } = weekLabelOf(week[0].dateStr);
    ws.mergeCells(dayRowIdx, 1, lastRowIdx, 1);
    const weekCell = ws.getCell(dayRowIdx, 1);
    weekCell.value = `M${monthNo}\nW${weekNo}`;
    weekCell.fill = solid('FFF3F4F6');
    weekCell.font = { bold: true, size: 10, color: { argb: 'FF6B7280' } };
    weekCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    for (let r = dayRowIdx; r <= lastRowIdx; r++) blockBorder(r, 1);

    // แถวหัววัน
    ws.getRow(dayRowIdx).height = 18;
    week.forEach((cellDef, i) => {
      const col = DAY_COL_START + i;
      const isHoliday = holidaySet.has(cellDef.dateStr);
      const isToday = cellDef.dateStr === todayStr;
      const dayNum = Number(cellDef.dateStr.slice(8, 10));
      const cell = ws.getCell(dayRowIdx, col);

      cell.value = isHoliday ? `${dayNum}    หยุด` : `${dayNum}`;
      cell.fill = solid(isHoliday ? 'FFFEE2E2' : (cellDef.isCurrentMonth ? 'FFF3F4F6' : OUTSIDE_BG));
      cell.font = {
        bold: true,
        size: 10,
        color: {
          argb: isHoliday
            ? 'FFB91C1C'
            : (cellDef.isCurrentMonth ? (isToday ? 'FF1D4ED8' : 'FF374151') : 'FF9CA3AF'),
        },
      };
      cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      blockBorder(dayRowIdx, col);
    });

    // แถวรายการ — ไม่ตัดจำนวน แสดงครบทุกรายการของวันนั้น
    for (let i = 0; i < itemRowCount; i++) {
      const r = dayRowIdx + 1 + i;
      week.forEach((cellDef, d) => {
        const col = DAY_COL_START + d;
        const row = dayItems[d][i];
        const cell = ws.getCell(r, col);
        const isHoliday = holidaySet.has(cellDef.dateStr);

        if (row) {
          const style = STATUS_STYLE[rowStatus(row)] ?? STATUS_STYLE.pending;
          cell.value = itemText(row);
          cell.fill = solid(style.bg);
          cell.font = { size: 9, color: { argb: style.text } };
        } else {
          cell.fill = solid(isHoliday ? HOLIDAY_BG : (cellDef.isCurrentMonth ? 'FFFFFFFF' : OUTSIDE_BG));
        }
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
        blockBorder(r, col);
      });
    }

    cursor = lastRowIdx + 1;
  });

  return ws;
};

const buildSummarySheet = (wb: ExcelJS.Workbook, productSummaries: ProductSummary[]) => {
  const ws = wb.addWorksheet('สรุปรายสินค้า', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'รหัสสินค้า (SKU)', key: 'sku', width: 18 },
    { header: 'ชื่อสินค้า (Product Name)', key: 'name', width: 40 },
    { header: 'จำนวนที่วางแผนทั้งหมด (Total Planned)', key: 'total', width: 30 },
    { header: 'จำนวนที่รับเข้าแล้ว (Received)', key: 'received', width: 26 },
    { header: 'จำนวนคงค้าง (Outstanding)', key: 'outstanding', width: 26 },
  ];

  productSummaries.forEach(p => {
    ws.addRow({
      sku: p.sku ?? '',
      name: p.product_name ?? '',
      total: p.totalQty,
      received: p.receivedQty,
      outstanding: Math.max(p.totalQty - p.receivedQty, 0),
    });
  });

  styleHeaderRow(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  return ws;
};

const buildRawSheet = (wb: ExcelJS.Workbook, rows: StockPlanRow[]) => {
  const ws = wb.addWorksheet('ข้อมูลดิบ', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'รหัสแพลน (Plan ID)', key: 'planId', width: 16 },
    { header: 'วันที่แพลนรับเข้า (Planned Date)', key: 'planned', width: 26 },
    { header: 'วันที่เลื่อนแพลน/คาดว่าจะเข้า (Expected Date)', key: 'expected', width: 32 },
    { header: 'วันที่ได้รับเข้าจริง (Actual Date)', key: 'actual', width: 26 },
    { header: 'รหัสสินค้า (SKU)', key: 'sku', width: 18 },
    { header: 'ชื่อสินค้า (Product Name)', key: 'name', width: 40 },
    { header: 'สถานะ (Status)', key: 'status', width: 24 },
    { header: 'จำนวนที่คาดว่าจะเข้า (Expected Qty)', key: 'expectedQty', width: 28 },
    { header: 'จำนวนที่รับจริง (Actual Qty)', key: 'actualQty', width: 24 },
    { header: 'หมายเหตุ (Remarks)', key: 'note', width: 34 },
    { header: 'ผู้สร้างแพลน (Created By)', key: 'createdBy', width: 22 },
  ];

  rows.forEach(r => {
    ws.addRow({
      planId: r.plan.id,
      planned: r.plan.planned_date ? r.plan.planned_date.slice(0, 10) : '',
      expected: r.kind === 'expectation' && r.expected_date ? r.expected_date.slice(0, 10) : '',
      actual: r.kind === 'expectation' && r.actual_date ? r.actual_date.slice(0, 10) : '',
      sku: r.item.sku ?? '',
      name: r.item.product_name ?? '',
      status: STATUS_META[rowStatus(r)]?.label ?? rowStatus(r),
      expectedQty: r.kind === 'pending' ? r.item.planned_qty : r.expected_qty,
      actualQty: r.kind === 'expectation' ? (r.actual_qty ?? '') : '',
      note: r.kind === 'expectation' ? (r.note || '') : '',
      createdBy: r.plan.created_by_name || '',
    });
  });

  styleHeaderRow(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  return ws;
};

const styleHeaderRow = (ws: ExcelJS.Worksheet) => {
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell(cell => {
    cell.fill = solid('FF374151');
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
};
