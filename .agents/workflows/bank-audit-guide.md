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
| `transfer_statement.php` | POST | โอนสิทธิ์ statement ข้ามบริษัท — `{ action: 'transfer'\|'cancel', statement_log_id, company_id, user_id, target_company_id?, note? }` |
| `get_transferred_bank_accounts.php` | GET | `?company_id=X` — บัญชี (ของบริษัทอื่น) ที่มี statement โอนมาให้เรา ใช้เติม dropdown ธนาคาร |

## Status ที่เป็นไปได้

`Unmatched` → `Exact` / `Short` / `Over` → `Confirmed` (locked)
`Unmatched` → `Suspense` / `Deposit` (ยกเลิกได้ → กลับ Unmatched)

## กฎสำคัญ (ต้องระวังตอนแก้โค้ด)

- `company_id` → ใช้ `currentUser.companyId || (currentUser as any).company_id` เสมอ
- **Confirmed = Locked** — ห้ามแก้ไข/ยกเลิก
- **COD ห้ามยกเลิกแบบปกติ** → ต้องใช้ `cod_unmatch.php` เท่านั้น
- **Mismatch Reason (เหตุผลยอดเงินไม่ตรงกัน)** — หากจับคู่ออเดอร์แล้วยอดเงินไม่ตรงกัน (Short / Over) ระบบจะบังคับให้ต้องกรอก `mismatch_reason` เสมอ (ห้ามใช้ Note แทน)
- ทุก action ใช้ **optimistic update** → อัปเดต state ก่อน API ตอบ
- หลังยกเลิก → เรียก `fetchAuditLogs(true)` (silent refresh เพื่อ recalculate auto-match)
- API ส่ง `statement_amount`, `order_amount` เป็น **string** → ใช้ `parseFloat()` หรือ helper `num()`
- Migration: 
  - `api/Database/migrate_reconcile_audit.sql` (หรือ auto ผ่าน `ensure_reconcile_tables()`)
  - `api/migrations/013_add_mismatch_reason_to_reconcile_logs.sql` สำหรับรองรับ `mismatch_reason`

## Dashboard (`BankAuditDashboardPage.tsx`)

- เมนู Sidebar: "แดชบอร์ดตรวจสอบบัญชี" | Permission: `accounting.audit.bank_dashboard`
- ใช้ API เดียวกัน (`get_bank_statement_audit.php`) แต่ส่ง `matchStatement: false`
- `bank_account_id: 0` = ดึงทุกบัญชีของ company
- Aggregate stats ฝั่ง client จาก `reconcile_items` → deduplicate ตาม `reconcile_id`
- กราฟแท่ง: indigo = จับคู่, emerald = ยืนยัน


## 🔒 ระบบ Reconcile Logic (อัปเดตใหม่) [NEW]

ระบบตรวจสอบยอดเงินและอัปเดตสถานะออเดอร์หลังจับคู่ Statement มีความรัดกุมมากขึ้น:
1. **การหักลบ Coupon Discount:** ระบบจะคำนวณ Payable Amount (ยอดที่ต้องจ่ายจริงหลังหักคูปอง) ก่อนตรวจสอบยอดเงินเสมอ
2. **การโอนเงินหลายงวด (Split Payments):** 
   - ระบบจะเช็คว่าลูกค้ามีส่งสลิปมามากกว่า 1 ใบและยังไม่ได้ตรวจครบหรือไม่
   - หากตรวจสลิปผ่านแค่ใบเดียว ระบบจะไม่ Approve ออเดอร์ แต่จะเปลี่ยนสถานะเป็น **Verified** (เพื่อป้องกันโกดังส่งของก่อนได้เงินครบ)
3. **การยอมรับยอดโอนขาด (Mismatch Reason):**
   - หากยอดเงินไม่ครบ (เช่น มัดจำ) แต่ตอนตรวจสลิปพนักงานได้ระบุ **เหตุผล (mismatch_reason)** ไว้ ระบบจะถือว่า 'บัญชียอมรับให้ส่งของได้' และจะอัปเดตสถานะเป็น **Approved** เสมอ
4. **การยกเลิกการผูกสลิป (Undo/Rollback):**
   - หากกดยกเลิกการจับคู่ ระบบจะเช็คยอดเงินที่เหลือ (รวมการหักคูปอง) และจะถอยสถานะกลับไปเป็น **Verified** อย่างถูกต้อง (ไม่ใช่ PreApproved เหมือนระบบเก่า)

## 🔀 การโอน Statement ข้ามบริษัท (Cross-Company Transfer) [NEW 2026-07]

เคส: เงินของบริษัท B โอนเข้าบัญชีธนาคารของบริษัท A → A โอนสิทธิ์ statement ให้ B ไปผูกกับออเดอร์ตัวเอง

- **Ownership model**: `statement_logs.assigned_company_id` (NULL = ของบริษัทที่อัพโหลด batch) — effective owner = `COALESCE(assigned_company_id, statement_batchs.company_id)`
- Migration: `api/migrations/042_add_statement_transfer_columns.sql` (+ auto-migrate ใน `transfer_statement.php` ผ่าน `ensure_statement_transfer_columns()`)
- **โอนได้เฉพาะแถว Unmatched** (ไม่มี reconcile log + ไม่ match COD) — เช็คฝั่ง server ใน transaction + FOR UPDATE
- ฝั่งต้นทาง: เห็นแถว read-only + badge "โอนแล้ว" (ม่วง) + ปุ่ม "ยกเลิกโอน"
- ฝั่งปลายทาง: เห็นแถวเสมอไม่ว่าเลือกธนาคารไหน + badge "⇄ โอนมาจาก X" + ปุ่ม "↩ ส่งคืน" — ผูก/พักรับ/ยืนยันได้ตาม flow ปกติ
- dropdown ธนาคารฝั่งปลายทาง: รวมบัญชีต่างบริษัทที่มี statement โอนมา (label ต่อท้าย "โอนมาจาก X") ผ่าน `get_transferred_bank_accounts.php`; `reconcile_save.php` มี fallback ยอมรับ bank ต่างบริษัทเฉพาะเมื่อมี statement assigned มาให้ company นั้นจริง
- auto-match ฝั่งปลายทาง: relax bank check (เพราะ statement อยู่บนธนาคารของต้นทาง)
- `reconcile_save.php` / `reconcile_add.php` มี **ownership guard**: statement ต้อง effective-owned โดย company ที่ยิงมา ไม่งั้น reject
- ห้ามโอนต่อเป็นทอด (UI ซ่อนตัวเลือก Transfer สำหรับแถวที่โอนเข้ามา) — ให้ส่งคืนแทน
- ทุกไฟล์ PHP รองรับ DB ที่ยังไม่มีคอลัมน์ (degrade เป็นพฤติกรรมเดิม)
