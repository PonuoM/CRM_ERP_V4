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
  is_ghost?: boolean;
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
  is_ghost?: boolean;
}

export type StockPlanRow = PendingStockPlanRow | StockPlanExpectation;

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
