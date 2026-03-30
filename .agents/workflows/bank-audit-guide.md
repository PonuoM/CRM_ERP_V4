---
description: คู่มือหน้าตรวจสอบบัญชีธนาคาร (Bank Account Audit) — สำหรับ agent
---

# Bank Account Audit — Agent Reference

## ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|------|--------|
| `pages/Accounting/BankAccountAuditPage.tsx` | หน้าตรวจสอบ/จับคู่ statement กับออเดอร์ |
| `pages/Accounting/BankAuditDashboardPage.tsx` | แดชบอร์ดสรุปสถิติ + กราฟแท่งผู้ใช้ |
| `components/OrderDetailModal.tsx` | Modal ออเดอร์ (รับ prop `statementContext`) |
| `components/SlipOrderSearchModal.tsx` | Modal ค้นหาออเดอร์เพื่อจับคู่ |

## API Endpoints (`api/Statement_DB/`)

| Endpoint | Method | สำคัญ |
|----------|--------|-------|
| `get_bank_statement_audit.php` | POST | `{ company_id, bank_account_id, start_date, end_date, matchStatement }` — `bank_account_id=0` = ทุกบัญชี, response มี `reconcile_items[].created_by_name / confirmed_by_name` |
| `reconcile_save.php` | POST | จับคู่ — stamp `created_by` |
| `reconcile_add.php` | POST | เพิ่มออเดอร์ (multi-order) — stamp `created_by` |
| `reconcile_cancel.php` | POST | ยกเลิกจับคู่ (`{ id, company_id }`) |
| `confirm_reconcile.php` | POST | ยืนยัน — stamp `confirmed_by` |
| `confirm_cod_document.php` | POST | ยืนยัน COD — stamp `confirmed_by` |
| `cod_unmatch.php` | POST | ยกเลิก COD match |
| `search_order_reconcile.php` | GET | ค้นหา order/COD ที่ผูกกับ statement |

## Status ที่เป็นไปได้

`Unmatched` → `Exact` / `Short` / `Over` → `Confirmed` (locked)
`Unmatched` → `Suspense` / `Deposit` (ยกเลิกได้ → กลับ Unmatched)

## กฎสำคัญ (ต้องระวังตอนแก้โค้ด)

- `company_id` → ใช้ `currentUser.companyId || (currentUser as any).company_id` เสมอ
- **Confirmed = Locked** — ห้ามแก้ไข/ยกเลิก
- **COD ห้ามยกเลิกแบบปกติ** → ต้องใช้ `cod_unmatch.php` เท่านั้น
- ทุก action ใช้ **optimistic update** → อัปเดต state ก่อน API ตอบ
- หลังยกเลิก → เรียก `fetchAuditLogs(true)` (silent refresh เพื่อ recalculate auto-match)
- API ส่ง `statement_amount`, `order_amount` เป็น **string** → ใช้ `parseFloat()` หรือ helper `num()`
- Migration: `api/Database/migrate_reconcile_audit.sql` (หรือ auto ผ่าน `ensure_reconcile_tables()`)

## Dashboard (`BankAuditDashboardPage.tsx`)

- เมนู Sidebar: "แดชบอร์ดตรวจสอบบัญชี" | Permission: `accounting.audit.bank_dashboard`
- ใช้ API เดียวกัน (`get_bank_statement_audit.php`) แต่ส่ง `matchStatement: false`
- `bank_account_id: 0` = ดึงทุกบัญชีของ company
- Aggregate stats ฝั่ง client จาก `reconcile_items` → deduplicate ตาม `reconcile_id`
- กราฟแท่ง: indigo = จับคู่, emerald = ยืนยัน
