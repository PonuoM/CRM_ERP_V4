export interface StockPlanItemRef {
  id: number;
  product_id: number;
  planned_qty: number;
  sku?: string;
  product_name?: string;
}

export interface StockPlanRef {
  id: number;
  planned_date: string;
  notes: string | null;
  company_id: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
}

export interface PendingStockPlanRow {
  kind: 'pending';
  display_date: string;
  remaining_qty: number;
  item: StockPlanItemRef;
  plan: StockPlanRef;
}

export interface StockPlanExpectation {
  kind: 'expectation';
  id: number;
  display_date: string;
  expected_qty: number;
  expected_date: string;
  so_number: string | null;
  status: 'expected' | 'confirmed' | 'closed_short';
  actual_qty: number | null;
  actual_date: string | null;
  note: string | null;
  next_expectation_id: number | null;
  scheduled_by_name?: string | null;
  scheduled_at?: string | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  item: StockPlanItemRef;
  plan: StockPlanRef;
}

export type StockPlanRow = PendingStockPlanRow | StockPlanExpectation;

/** หมายเหตุ 1 บรรทัดในไทม์ไลน์ของแพลน (stock_arrival_plan_notes) */
export interface StockPlanNote {
  id: number;
  plan_id: number;
  note: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

/** สิทธิ์ของผู้ใช้ปัจจุบันในระบบแพลนรับสินค้า — มาจาก get_stock_plan_access.php */
export interface StockPlanAccess {
  can_manage: boolean;   // เพิ่ม/ลบแพลน + เพิ่มหมายเหตุ
  can_grant: boolean;    // ตั้งสิทธิ์ให้บัญชีอื่น (แท็บ "สิทธิ์การจัดการ")
  is_super_admin: boolean;
  role?: string | null;
}

/** บัญชีในตารางตั้งค่าสิทธิ์ — มาจาก list_stock_plan_managers.php */
export interface StockPlanManagerRow {
  id: number;
  username: string;
  name: string;
  role: string | null;
  company_id: number | null;
  status: string | null;
  can_manage: boolean;
  always_allowed: boolean;
  granted_at: string | null;
  granted_by_name: string | null;
}

export interface TonDivisorRow {
  product_id: number;
  sku?: string;
  product_name?: string;
  divisor: number | null;
  effective_from?: string | null;
}

export interface ProductSummary {
  product_id: number;
  sku?: string;
  product_name?: string;
  totalQty: number;
  receivedQty: number;
}

export const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  pending: { label: 'รอกำหนดวันที่คาดว่าจะเข้า', badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  expected: { label: 'คาดว่าจะเข้า', badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  confirmed: { label: 'ยืนยันรับเข้าแล้ว', badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  closed_short: { label: 'ปิด - ไม่ครบ', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export const rowStatus = (row: StockPlanRow) => (row.kind === 'pending' ? 'pending' : row.status);

export const formatTon = (qty: number, divisor: number | null | undefined) => {
  if (!divisor || divisor <= 0) return null;
  return (qty / divisor).toFixed(2);
};

export const shortStamp = (ts?: string | null) => (ts ? ts.slice(0, 16) : '');

/** "2026-07-27" -> "27/07/2569" */
export const thaiDate = (date?: string | null) => {
  if (!date) return '';
  const [y, m, d] = date.slice(0, 10).split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${Number(y) + 543}`;
};

/**
 * ป้ายบอกที่มาของรายการที่ไม่ได้อยู่วันเดียวกับแพลนตั้งต้น (null = ไม่ได้เลื่อน)
 *
 * แทนที่ระบบ "Ghost Plan" เดิมที่เรนเดอร์สำเนาจางๆ ไว้วันเก่า — ตอนนี้รายการจะอยู่ที่วันจริง
 * วันเดียว แล้วบอกที่มาไว้ในตัวรายการแทน เพื่อไม่ให้ปฏิทินมีของซ้ำสองวัน
 */
export const movedFromLabel = (row: StockPlanRow): string | null => {
  if (row.kind !== 'expectation') return null;
  const shown = row.display_date.slice(0, 10);
  const planned = row.plan.planned_date ? row.plan.planned_date.slice(0, 10) : null;
  const expected = row.expected_date ? row.expected_date.slice(0, 10) : null;

  // เข้าจริงคนละวันกับที่คาดไว้ — บอกวันที่คาดไว้เป็นหลัก
  if (expected && expected !== shown) return `คาดไว้ ${thaiDate(expected)}`;
  if (planned && planned !== shown) return `เลื่อนจากแพลน ${thaiDate(planned)}`;
  return null;
};

/** "2026-08-03 14:20:11" -> "03/08/2569 14:20" (ใช้ในไทม์ไลน์หมายเหตุ) */
export const noteStamp = (ts?: string | null) => {
  if (!ts) return '';
  const [datePart, timePart = ''] = ts.replace('T', ' ').split(' ');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return ts;
  return `${d}/${m}/${Number(y) + 543} ${timePart.slice(0, 5)}`.trim();
};
