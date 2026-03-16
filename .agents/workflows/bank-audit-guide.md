---
description: คู่มืออธิบายการทำงานหน้าตรวจสอบบัญชีธนาคาร (Bank Account Audit Page)
---

# ตรวจสอบบัญชีธนาคาร (Bank Account Audit)

## ภาพรวม

หน้าตรวจสอบบัญชีธนาคาร ใช้สำหรับเทียบรายการเงินเข้า (Bank Statement) กับยอดออเดอร์ในระบบ เพื่อให้ทีมบัญชีสามารถ reconcile ข้อมูลการเงินได้

**คุณสมบัติหลัก:**
- เลือกบัญชีธนาคาร + ช่วงวันที่ แล้วดึงรายการ statement มาเทียบกับออเดอร์
- ระบบ **Auto-match** แนะนำการจับคู่จากยอดเงินที่ตรงกัน
- จับคู่ **หลายออเดอร์ต่อ 1 statement** ได้ (multi-order matching)
- รองรับ **COD Document** — จับคู่ statement กับเอกสาร COD ที่รวมหลายออเดอร์
- ตั้งสถานะ **พักรับ (Suspense)** หรือ **มัดจำรับ (Deposit)** สำหรับรายการที่ยังจับคู่ไม่ได้
- **Batch confirm** — เลือกหลายรายการแล้วยืนยันพร้อมกัน
- **Export CSV** — ส่งออกข้อมูลเป็นไฟล์ CSV

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|-------|
| `pages/Accounting/BankAccountAuditPage.tsx` | หน้า UI หลัก |
| `components/OrderDetailModal.tsx` | Modal ดูรายละเอียดออเดอร์ (รับ `statementContext` เพิ่ม) |
| `components/SlipOrderSearchModal.tsx` | Modal ค้นหาและเลือกออเดอร์เพื่อจับคู่ |
| `api/Statement_DB/get_bank_statement_audit.php` | ดึงรายการ statement + auto-match suggestions |
| `api/Statement_DB/reconcile_save.php` | บันทึกการจับคู่ (match order / Suspense / Deposit) |
| `api/Statement_DB/reconcile_add.php` | เพิ่มออเดอร์เข้า statement ที่จับคู่แล้ว (multi-order) |
| `api/Statement_DB/reconcile_cancel.php` | ยกเลิกการจับคู่ |
| `api/Statement_DB/confirm_reconcile.php` | ยืนยัน reconcile (lock) — stamp `confirmed_by` |
| `api/Statement_DB/confirm_cod_document.php` | ยืนยัน COD document — stamp `confirmed_by` |
| `api/Statement_DB/cod_unmatch.php` | ยกเลิกการผูก COD document กับ statement |
| `api/Database/migrate_reconcile_audit.sql` | SQL migration เพิ่ม `created_by` + `confirmed_by` |
| `api/bank_accounts` | ดึงรายการบัญชีธนาคารตาม company |

---

## Data Types

### `AuditLog` — แถวใน statement

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `id` | number | PK (statement_id) |
| `reconcile_id` | number? | FK → reconcile_logs.id |
| `transfer_at` | string | วัน/เวลาที่โอนเงิน |
| `statement_amount` | number | ยอดเงินจาก statement |
| `channel` | string | ช่องทาง (เช่น SCB, KBANK) |
| `description` | string | รายละเอียดจาก statement |
| `order_id` | string? | เลขที่ออเดอร์ที่จับคู่แล้ว (หลายตัวคั่นด้วย `,`) |
| `order_display` | string? | ข้อความแสดงผล order_id |
| `order_amount` | number? | ยอดรวมจากออเดอร์ที่จับคู่ |
| `payment_method` | string? | วิธีชำระเงิน |
| `status` | enum | `Unmatched` / `Short` / `Exact` / `Over` / `Suspense` / `Deposit` |
| `diff` | number | ส่วนต่าง = statement_amount - order_amount |
| `confirmed_at` | string? | เวลาที่ยืนยัน (lock) |
| `confirmed_action` | string? | `'Confirmed'` เมื่อยืนยันแล้ว |
| `note` | string? | หมายเหตุ |
| `is_cod_document` | boolean | เป็นเอกสาร COD หรือไม่ |
| `cod_document_id` | number? | FK → cod_documents.id |
| `cod_document_number` | string? | เลขที่เอกสาร COD |
| `cod_total_amount` | number? | ยอดรวม COD |
| `matched_orders` | array? | ออเดอร์ที่จับคู่แล้ว `[{ reconcile_id, order_id, confirmed_amount, confirmed_at }]` |

### `BankAccount`

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `id` | number | PK |
| `bank` | string | ชื่อธนาคาร |
| `bank_number` | string | เลขบัญชี |
| `account_name` | string | ชื่อบัญชี |

---

## Status Flow

```
  ┌──────────────┐
  │  Unmatched   │ ← เริ่มต้น
  └──────┬───────┘
         │
    ┌────┴────────────────────┐
    │                         │
    ▼                         ▼
┌────────┐     ┌─────────────────────┐
│Suspense│     │ จับคู่ออเดอร์        │
│Deposit │     │ (match order)       │
└────┬───┘     └──────┬──────────────┘
     │                │
     │  ยกเลิก        ▼
     │         ┌──────────────┐
     └─────────► สถานะตามยอด  │
       (cancel) │ Exact/Short/│
               │ Over        │
               └──────┬──────┘
                      │ ยืนยัน (confirm)
                      ▼
               ┌──────────────┐
               │  Confirmed   │ ← lock ไม่ให้แก้ไข
               └──────────────┘
```

### สถานะ Match:

| สถานะ | เงื่อนไข | สี |
|-------|----------|-----|
| **Exact** | `|statement - order| < 0.01` | 🟢 เขียว |
| **Over** | `statement > order` (โอนเกิน) | 🔵 น้ำเงิน |
| **Short** | `statement < order` (โอนขาด) | 🔴 แดง |
| **Suspense** | Admin เลือกพักรับ | 🟠 ส้ม |
| **Deposit** | Admin เลือกมัดจำรับ | 🟣 ม่วง |
| **Unmatched** | ยังไม่จับคู่ | ⚪ เทา |

---

## ฟีเจอร์หลัก

### 1. ค้นหา Statement

- เลือก **บัญชีธนาคาร** จาก dropdown
- กำหนด **วันเริ่มต้น** (default: วันที่ 1 ของเดือนปัจจุบัน) และ **วันสิ้นสุด** (default: วันนี้)
- กด **ค้นหา** → เรียก `get_bank_statement_audit.php` (POST) พร้อม `matchStatement: true`
- Backend จะส่ง auto-match suggestions กลับมาใน field `suggested_order_id`, `suggested_order_amount`

### 2. จับคู่ออเดอร์ (Reconcile)

**Auto-match suggestion:**
- ถ้า backend แนะนำ → แสดง `แนะนำ: {orderId}` ใต้ Unmatched
- กดแนะนำ → เปิด OrderDetailModal ดูรายละเอียด
- กดปุ่ม **"ยืนยันจับคู่"** → เรียก `reconcile_save.php`

**Manual match (ค้นหาเอง):**
- กดปุ่ม **"ค้นหา"** ในแถว Unmatched → เปิด `SlipOrderSearchModal`
- ค้นหาด้วยวันที่โอน + ยอดเงิน + ช่องทาง
- เลือกออเดอร์ → ยืนยัน → เรียก `reconcile_save.php`

**Multi-order match (ผูกหลายออเดอร์):**
- เมื่อจับคู่แล้ว ถ้ายอดไม่ตรง สามารถกด **"+ ผูกเพิ่ม"** เพื่อเพิ่มออเดอร์อีก
- เรียก `reconcile_add.php` → เพิ่มเข้า `matched_orders[]`
- ระบบจะคำนวณ status ใหม่จากผลรวมยอดทุกออเดอร์

### 3. Suspense / Deposit

- สำหรับรายการ Unmatched ที่ยังหาออเดอร์ไม่เจอ
- เลือก **"พักรับ"** หรือ **"มัดจำรับ"** จาก dropdown ในคอลัมน์สถานะ
- ระบบจะ prompt ให้กรอก **หมายเหตุ** → เรียก `reconcile_save.php` (type = Suspense/Deposit)
- สามารถ **ยกเลิก** ได้ → เรียก `reconcile_cancel.php` → กลับเป็น Unmatched

### 4. COD Document

- Statement บางรายการมาจาก COD → แสดง **เลขเอกสาร COD** แทนเลขออเดอร์
- กดเลข COD → เปิด **COD Detail Modal** แสดง:
  - เลขที่เอกสาร, ยอด Statement, ยอด COD, วิธีชำระ
  - ตาราง: tracking number, order_id, ยอด COD, สถานะ (จับคู่แล้ว/รอจับคู่)
  - กด order_id → เปิด OrderDetailModal
- ⚠️ **ห้ามยกเลิกการจับคู่** ถ้าผูกกับ COD document (แจ้ง alert)
- ใช้ปุ่ม **"✕"** ในแถว COD → เรียก `cod_unmatch.php` เพื่อยกเลิกเฉพาะ COD

### 5. Batch Confirm

- คอลัมน์สุดท้าย = **checkbox**
  - แสดงเฉพาะรายการที่จับคู่แล้วแต่ยังไม่ confirm (`order_id && !confirmed_at`)
  - **Select-all** checkbox ที่ header
- เมื่อเลือกแล้ว → แสดงปุ่ม **"ยืนยัน (N) รายการ"**
- กดยืนยัน → แยก COD / Regular → เรียก API พร้อมกัน:
  - **Regular:** `confirm_reconcile.php` (ทุก reconcile_id ใน matched_orders)
  - **COD:** `confirm_cod_document.php` (ตาม cod_document_id)
- รายการที่ confirm แล้ว → แสดง ✅ icon (lock ไม่ให้แก้ไข)

### 6. Export CSV

- กดปุ่ม **Export CSV** → สร้างไฟล์จาก logs ปัจจุบัน
- คอลัมน์: ID, Bank Account, วัน/เวลา, ยอด Statement, Channel, รายละเอียด, Order ID, ยอดออเดอร์, วิธีชำระ, สถานะ, ยืนยันเมื่อ, หมายเหตุ
- ชื่อไฟล์: `bank_audit_{startDate}_{endDate}.csv` (UTF-8 BOM)

---

## API Endpoints

### GET

| Endpoint | Parameters | คำอธิบาย |
|----------|-----------|----------|
| `bank_accounts` | `companyId` | ดึงบัญชีธนาคาร |

### POST

| Endpoint | Body | คำอธิบาย |
|----------|------|----------|
| `Statement_DB/get_bank_statement_audit.php` | `company_id, bank_account_id, start_date, end_date, matchStatement` | ดึง statement + auto-match |
| `Statement_DB/reconcile_save.php` | `company_id, user_id, bank_account_id, start_date, end_date, items[]` | บันทึกจับคู่ — stamp `created_by` |
| `Statement_DB/reconcile_add.php` | `company_id, user_id, bank_account_id, statement_id, order_id, confirmed_amount, start_date, end_date` | เพิ่มออเดอร์ — stamp `created_by` |
| `Statement_DB/reconcile_cancel.php` | `id, company_id` | ยกเลิกจับคู่ |
| `Statement_DB/confirm_reconcile.php` | `id, user_id, order_amount, payment_method` | ยืนยัน reconcile — stamp `confirmed_by` |
| `Statement_DB/confirm_cod_document.php` | `cod_document_id, company_id, user_id` | ยืนยัน COD — stamp `confirmed_by` |
| `Statement_DB/cod_unmatch.php` | `statement_log_id, cod_document_id, company_id` | ยกเลิก COD match |

### Response format (reconcile_save):
```json
{
  "ok": true,
  "reconcile_log_ids": { "<statement_id>": <reconcile_id> }
}
```

### Response format (reconcile_add):
```json
{
  "ok": true,
  "reconcile_log_id": 123
}
```

---

## Optimistic Updates

ทุก action ใช้ optimistic update — อัปเดต `logs` state ทันทีก่อน API ตอบกลับ:

| Action | Optimistic Update |
|--------|-------------------|
| **จับคู่ออเดอร์** | เซ็ต order_id, คำนวณ status จาก diff, สร้าง matched_orders |
| **เพิ่มออเดอร์** | push เข้า matched_orders, คำนวณ totalConfirmed + status ใหม่ |
| **ยกเลิกจับคู่** | ลบจาก matched_orders, ถ้าหมด → reset เป็น Unmatched |
| **Suspense/Deposit** | เซ็ต status, ล้าง order_id |
| **ยืนยัน** | เซ็ต confirmed_at + confirmed_action |
| **ยกเลิก COD** | reset ทุก field กลับ Unmatched |

⚠️ หลังยกเลิกจับคู่/COD → เรียก `fetchAuditLogs(true)` (silent refresh) เพื่อให้ backend คำนวณ auto-match ใหม่

---

## Modals

### 1. OrderDetailModal
- เปิดเมื่อกดเลขออเดอร์
- ส่ง `statementContext` (ยอด statement, วันที่โอน, channel) ให้ modal แสดงเปรียบเทียบ
- `onSlipUpdated` callback → silent refresh audit logs

### 2. SlipOrderSearchModal
- เปิดเมื่อกดปุ่ม "ค้นหา" ในแถว Unmatched
- Pre-fill: วันที่โอน, ยอดเงิน, companyId, channel
- เลือกออเดอร์ → callback `handleOrderSelected`:
  - ถ้า **addModeForLog** มีค่า → เรียก `reconcile_add.php` (เพิ่มออเดอร์)
  - ถ้าไม่มี → เรียก `reconcile_save.php` (จับคู่ครั้งแรก)

### 3. COD Detail Modal (inline)
- แสดงภายใน component (ไม่ใช่ component แยก)
- เปิดเมื่อกดเลขเอกสาร COD
- แสดง: เลขเอกสาร, ยอดต่างๆ, ตาราง records (tracking + order + ยอด + สถานะ)
- กด order_id ในตาราง → ปิด COD modal + เปิด OrderDetailModal

---

## ข้อควรระวัง

| หัวข้อ | รายละเอียด |
|--------|-----------|
| **company_id** | ใช้ `currentUser.companyId \|\| (currentUser as any).company_id` ทุกที่ (รองรับทั้ง camelCase และ snake_case) |
| **Confirmed = Locked** | รายการที่ confirm แล้วไม่สามารถแก้ไขได้อีก |
| **COD ห้ามยกเลิกแบบปกติ** | ถ้า log มี `is_cod_document` หรือ `cod_document_id` → ปุ่ม "ยกเลิก" ของ order จะโดนบล็อก ต้องใช้ `cod_unmatch.php` แทน |
| **Silent refresh** | `fetchAuditLogs(true)` ไม่แสดง loading แต่แสดง `recalculating` indicator ในแถว Unmatched |
| **Default date** | startDate ค่าเริ่มต้น = วันที่ 1 ของเดือนปัจจุบัน (มี timezone adjust) |
| **created_by** | stamp `users.id` ตอน INSERT ใน `reconcile_save.php` + `reconcile_add.php` |
| **confirmed_by** | stamp `users.id` ตอน confirm ใน `confirm_reconcile.php` + `confirm_cod_document.php` |

---

## Migration Guide

| สถานการณ์ | ไฟล์ที่ต้องรัน |
|----------|----------------|
| **Production มี DB อยู่แล้ว** | `migrate_reconcile_audit.sql` (หรือรอ auto-migration ใน `ensure_reconcile_tables()`) |
| **Fresh install** | ไม่ต้องทำอะไร — `ensure_reconcile_tables()` สร้างคอลัมน์ให้อัตโนมัติ |
