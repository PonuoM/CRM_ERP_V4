// ชนิดข้อมูลของเมนู "สั่งผลิต & ใบขน" (Factory Production)
// เทียบกับฝั่ง backend: api/inventory/production_permission.php + production_progress.php

export interface ProductionFactory {
  id: number;
  code: string;
  name: string;
  note?: string | null;
  sort_order: number;
  is_active: number;
}

/** สถานะที่เก็บใน DB (ผู้ใช้เปลี่ยนเอง) */
export type ProductionOrderStatus = 'open' | 'closed' | 'cancelled';

/** สถานะความคืบหน้า — คำนวณสดจากใบขน ไม่ได้เก็บใน DB */
export type ProductionProgress =
  | 'not_started'
  | 'producing'
  | 'waiting_pickup'
  | 'completed'
  | 'closed'
  | 'cancelled';

export type DeliveryNoteStatus = 'issued' | 'picked_up' | 'cancelled';

export interface ProductionBalance {
  ordered_qty: number;
  delivered_qty: number;
  /** ยังไม่ผลิต = ordered - delivered */
  pending_qty: number;
  /** ผลิตเสร็จ ออกใบขนแล้ว รอ Airport มารับ */
  waiting_qty: number;
  /** ขนเข้าคลังแล้ว (ยอดตามใบขน) */
  picked_qty: number;
  /** ยอดที่คลังรับจริง */
  received_qty: number;
  /** ของมาไม่ครบ = picked - received */
  shortage_qty: number;
}

export interface ProductionOrderItem extends ProductionBalance {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  product_name: string;
  format_code?: string | null;
  note?: string | null;
  /* ค่าตามใบต้นทางที่นำเข้าจาก PDF (migration 084) */
  doc_line_no?: number | null;
  doc_sku?: string | null;
  doc_name?: string | null;
  unit?: string | null;
  department?: string | null;
}

export interface ProductionOrder {
  id: number;
  so_number: string;
  company_id: number | null;
  company_name?: string | null;
  factory_id: number;
  factory_code: string;
  factory_name: string;
  so_date: string;
  period_start?: string | null;
  period_end?: string | null;
  due_date?: string | null;
  status: ProductionOrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  closed_at?: string | null;
  items: ProductionOrderItem[];
  totals: ProductionBalance;
  progress_status: ProductionProgress;
  delivery_notes?: DeliveryNoteSummary[];
  /* ข้อมูลจากใบ SO ต้นทางที่นำเข้าจาก PDF (migration 084) */
  customer_code?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  receive_date?: string | null;
  warehouse_name?: string | null;
  coordinator_name?: string | null;
  source_type?: string | null;
  source_file?: string | null;
  /** ที่อยู่ไฟล์ PDF ต้นทางบนเซิร์ฟเวอร์ (migration 085) */
  source_path?: string | null;
  source_size?: number | null;
  imported_at?: string | null;
}

export interface DeliveryNoteSummary {
  id: number;
  dn_number: string;
  issued_date: string;
  status: DeliveryNoteStatus;
  received_date?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  vehicle_note?: string | null;
  note?: string | null;
  qty: number;
  received_qty: number;
}

export interface DeliveryNoteItem {
  id: number;
  delivery_note_id: number;
  order_item_id: number;
  order_id: number;
  so_number: string;
  product_id: number;
  sku: string;
  product_name: string;
  ordered_qty: number;
  qty: number;
  received_qty: number | null;
  note?: string | null;
}

export interface DeliveryNote {
  id: number;
  dn_number: string;
  factory_id: number;
  factory_code: string;
  factory_name: string;
  issued_date: string;
  status: DeliveryNoteStatus;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  received_date?: string | null;
  picked_up_at?: string | null;
  vehicle_note?: string | null;
  note?: string | null;
  posted_to_stock: number;
  created_at: string;
  items: DeliveryNoteItem[];
  total_qty: number;
  total_received_qty: number;
  so_numbers: string[];
  /* ข้อมูลจากใบขนต้นทางที่นำเข้าจาก PDF (migration 084) */
  customer_code?: string | null;
  customer_name?: string | null;
  doc_receive_date?: string | null;
  doc_warehouse_name?: string | null;
  coordinator_name?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_id_card?: string | null;
  vehicle_plate?: string | null;
  source_type?: string | null;
  source_file?: string | null;
  source_path?: string | null;
  source_size?: number | null;
  imported_at?: string | null;
}

export interface ProductionAccess {
  can_manage: boolean;
  can_grant: boolean;
  is_super_admin: boolean;
  /** [] = เห็นทุกโรงงาน */
  factory_ids: number[];
  role?: string | null;
}

export interface ProductionSummary {
  totals: ProductionBalance;
  by_factory: (ProductionBalance & {
    factory_id: number;
    factory_code: string;
    factory_name: string;
    so_count: number;
  })[];
  by_product: (ProductionBalance & {
    product_id: number;
    sku: string;
    product_name: string;
  })[];
  pickup_queue: {
    factory_id: number;
    factory_code: string;
    factory_name: string;
    note_count: number;
    qty: number;
    oldest_issued_date: string;
  }[];
  order_count: number;
}

export interface ProductionManagerRow {
  id: number;
  username: string;
  name: string;
  role: string;
  company_id: number | null;
  status: string;
  can_manage: boolean;
  always_allowed: boolean;
  granted_at?: string | null;
  granted_by_name?: string | null;
  factory_ids: number[];
}

// role ที่มีสิทธิ์จัดการโดยอัตโนมัติ — ต้องตรงกับ PRODUCTION_ADMIN_ROLES ใน production_permission.php
export const PRODUCTION_ADMIN_ROLES = ['Super Admin', 'Admin Control', 'CEO'];

// สีอ้างอิง token ของหน้า (components/FactoryProduction/productionStyles.tsx) ไม่ฝังค่าสีตรง ๆ
// s1 = ยังไม่ผลิต (เทา) · s2 = รอขนย้าย (อำพัน) · s3 = เข้าคลังแล้ว (เขียว)
export const PROGRESS_META: Record<ProductionProgress, { label: string; color: string; bg: string }> = {
  not_started:    { label: 'ยังไม่เริ่มผลิต', color: 'var(--fp-ink-3)', bg: 'var(--fp-surface-2)' },
  producing:      { label: 'กำลังผลิต',      color: 'var(--fp-s1)',    bg: 'var(--fp-s1-soft)' },
  waiting_pickup: { label: 'รอขนย้าย',       color: 'var(--fp-s2)',    bg: 'var(--fp-s2-soft)' },
  completed:      { label: 'เข้าคลังครบ',    color: 'var(--fp-s3)',    bg: 'var(--fp-s3-soft)' },
  closed:         { label: 'ปิดยอดแล้ว',     color: 'var(--fp-ink-2)', bg: 'var(--fp-surface-2)' },
  cancelled:      { label: 'ยกเลิก',         color: 'var(--fp-danger)', bg: 'oklch(95.5% 0.03 26)' },
};

export const DN_STATUS_META: Record<DeliveryNoteStatus, { label: string; color: string; bg: string }> = {
  issued:    { label: 'รอขนย้าย',    color: 'var(--fp-s2)',     bg: 'var(--fp-s2-soft)' },
  picked_up: { label: 'เข้าคลังแล้ว', color: 'var(--fp-s3)',     bg: 'var(--fp-s3-soft)' },
  cancelled: { label: 'ยกเลิก',       color: 'var(--fp-danger)', bg: 'oklch(95.5% 0.03 26)' },
};

export const fmtQty = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('th-TH');

export const fmtDate = (d?: string | null): string => {
  if (!d) return '-';
  const [y, m, day] = d.slice(0, 10).split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

/** รอบครึ่งเดือนของวันที่ที่ให้มา (พี่ฝนให้เปิด SO ทุก 2 สัปดาห์) */
export const halfMonthPeriod = (dateStr: string): { start: string; end: string } => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d <= 15) {
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-15` };
  }
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${y}-${pad(m)}-16`, end: `${y}-${pad(m)}-${pad(lastDay)}` };
};
