---
description: คู่มืออธิบายการทำงานระบบสินค้าโควตา (Product Quota System)
---

# ระบบสินค้าโควตา (Product Quota System)

## ภาพรวม

ระบบสินค้าโควตาเป็นระบบที่ให้พนักงานสามารถขายสินค้าบางรายการได้ โดยจำกัดจำนวนตามโควตาที่ตนเองมี โควตาจะถูกคำนวณจากยอดขายของพนักงาน + โควตาที่ Admin แจกเพิ่ม

**คุณสมบัติหลัก:**
- กำหนดว่ายอดขายเท่าไหร่ = 1 โควตา (เช่น ฿5,000 = 1 โควตา)
- ตั้งอัตราล่วงหน้าตามวันที่  
- 3 โหมด: **รีเซ็ตตามรอบ** (reset), **สะสม** (cumulative) และ **กำหนดเอง** (confirm)
- Reset 2 แบบ: **ทุกวันที่ X ของเดือน** (monthly) หรือ **ทุก N วัน** (interval)
- **Cumulative segmented:** เปลี่ยน rate ได้โดยไม่สูญเสียโควตาสะสม แต่ละช่วงใช้ rate ของตัวเอง
- **ป้องกัน conflict:** ยืนยันก่อนสร้าง rate แบบ reset (แจ้งเตือนว่าสะสมจะหายไป)
- ไม่นับออเดอร์ที่ยกเลิก (Cancelled) ในการคำนวณ
- Admin สามารถเพิ่มโควตาให้พนักงานเอง
- ติดตามประวัติโควตาทั้งหมด
- **สร้างสินค้าโควตาได้ 2 โหมด:** อ้างอิงจากสินค้าที่มีอยู่ หรือ สร้างสินค้า+โควตาใหม่พร้อมกัน
- **Tab สินค้าโควตา:** แสดงใน ProductSelectorModal ตอนสร้างคำสั่งซื้อ พร้อม badge โควตาคงเหลือ
- **🌐 Global Quota:** สร้าง rate ที่โควตาใช้ได้กับทุกสินค้า (`quota_product_id = NULL`)
- **📌 Multi-Product Scope:** สร้าง rate ที่โควตาใช้ได้เฉพาะบางสินค้า (ผ่าน `quota_rate_scope` junction table)

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|-------|
| `api/Database/create_quota_tables.sql` | SQL migration สร้าง 5 ตาราง (รวม `quota_rate_scope`) |
| `api/Database/migrate_confirm_mode.sql` | SQL migration โหมดกำหนดเอง (ALTER TABLE) |
| `api/Database/migrate_soft_delete.sql` | SQL migration soft delete + ลบ UNIQUE constraint |
| `api/Database/migrate_global_quota.sql` | SQL migration global/scope (nullable quota_product_id + สร้าง quota_rate_scope) |
| `api/Quota/quota.php` | Backend API ทั้งหมด (12 endpoints + global/scope support) |
| `types.ts` | TypeScript interfaces (4 ตัว: QuotaProduct, QuotaRateSchedule, QuotaAllocation, QuotaSummary) |
| `services/quotaApi.ts` | Service layer — frontend → API (13 functions รวม confirmQuota) |
| `pages/QuotaSettingsPage.tsx` | หน้า Admin ตั้งค่าโควตา (3 tabs) |
| `pages/CreateOrderPage.tsx` | ส่ง `companyId` + `currentUserId` ให้ ProductSelectorModal |
| `pages/ManageOrdersPage.tsx` | Export integration (`item.quotaCsvLabel`) |
| `components/ProductSelectorModal.tsx` | Tab สินค้าโควตา + badge โควตาคงเหลือ (self-loading) |
| `components/OrderManagementModal.tsx` | ส่ง `companyId` + `currentUserId` ให้ ProductSelectorModal |
| `components/Sidebar.tsx` | เมนู "ตั้งค่าโควตา" (key: `data.quota_settings`) |
| `App.tsx` | Route `'Quota Settings'` |
| `services/api.ts` | เพิ่ม `Quota/` ใน direct-access path |

---

## Database Schema

### 1. `quota_products` — สินค้าที่มีระบบโควตา

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `id` | INT AUTO_INCREMENT | PK |
| `product_id` | INT | FK → products.id |
| `company_id` | INT | FK → companies.id |
| `display_name` | VARCHAR(255) | ชื่อที่แสดงในระบบโควตา |
| `csv_label` | VARCHAR(255) | ชื่อสำหรับ CSV Export (ถ้า NULL ใช้ชื่อจาก products) |
| `is_active` | TINYINT(1) DEFAULT 1 | เปิด/ปิดการใช้งาน |
| `deleted_at` | TIMESTAMP NULL | soft delete (ถ้ามีค่า = ถูกลบ) |

**Indexes:** `UNIQUE(product_id, company_id)`, `INDEX(company_id)`

### 2. `quota_rate_schedules` — อัตราโควตา (ยอดขาย/โควตา)

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `id` | INT AUTO_INCREMENT | PK |
| `quota_product_id` | INT DEFAULT NULL | FK → quota_products.id (**NULL = global/scoped**) |
| `sales_per_quota` | DECIMAL(12,2) | ยอดขาย (บาท) ต่อ 1 โควตา |
| `effective_date` | DATE | มีผลตั้งแต่วันที่ |
| `order_date_field` | ENUM('order_date','delivery_date') | คำนวณจากฟิลด์ไหน |
| `quota_mode` | ENUM('reset','cumulative','confirm') | โหมดโควตา |
| `reset_interval_days` | INT DEFAULT 30 | จำนวนวันต่อรอบ (reset + interval) |
| `reset_day_of_month` | TINYINT DEFAULT NULL | วันที่รีเซ็ตของเดือน 1-28 (reset + monthly) |
| `reset_anchor_date` | DATE | วันเริ่มนับรอบ (reset + interval) |
| `calc_period_start` | DATE DEFAULT NULL | ช่วงออเดอร์เริ่มต้น (confirm mode) |
| `calc_period_end` | DATE DEFAULT NULL | ช่วงออเดอร์สิ้นสุด (confirm mode) |
| `usage_start_date` | DATE DEFAULT NULL | โควตาเริ่มใช้ได้เมื่อไหร่ (confirm mode) |
| `usage_end_date` | DATE DEFAULT NULL | วันหมดอายุโควตา (confirm mode) |
| `require_confirm` | TINYINT DEFAULT 1 | 1=รอ admin ยืนยัน 0=ไม่ต้อง (confirm mode) |
| `created_by` | INT | ผู้สร้าง |
| `deleted_at` | TIMESTAMP NULL | soft delete |

**quota_product_id Logic:**
| quota_product_id | scope rows | ความหมาย |
|---|---|---|
| `123` (specific) | — | เฉพาะ product 123 (พฤติกรรมเดิม) |
| `NULL` | ไม่มีแถวใน scope | 🌐 Global (ใช้ได้ทุกสินค้า) |
| `NULL` | มี product 1, 2 | 📌 Scoped (ใช้ได้เฉพาะ 1 กับ 2) |

**Indexes:** `INDEX(quota_product_id, effective_date)` — ⚠️ ไม่มี UNIQUE constraint (ลบออกเพื่อรองรับ soft delete)

**Reset 2 แบบ:**
- `reset_day_of_month` มีค่า → รีเซ็ตทุกวันที่ X ของเดือน (ไม่ใช้ interval/anchor)
- `reset_day_of_month` = NULL → รีเซ็ตทุก N วันจาก anchor (แบบเดิม)

**Confirm mode (กำหนดเอง):** คำนวณโควตาจากออเดอร์ในช่วง `calc_period_start` → `calc_period_end`
- `require_confirm=1` → ต้องรอ Admin ยืนยัน (โควตาจะถูก freeze ตอนยืนยัน)
- `require_confirm=0` → คำนวณอัตโนมัติตลอดเวลา
- `usage_end_date` → โควตาหมดอายุ (คงเหลือ=0) หลังวันนั้น

### 3. `quota_allocations` — ประวัติการแจกโควตา

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `id` | INT AUTO_INCREMENT | PK |
| `quota_product_id` | INT | FK → quota_products.id |
| `user_id` | INT | FK → users.id |
| `company_id` | INT | FK → companies.id |
| `quantity` | DECIMAL(10,2) | จำนวนโควตา |
| `source` | VARCHAR(50) | แหล่งที่มา (auto / admin / auto_confirmed) |
| `source_detail` | TEXT | รายละเอียดเพิ่มเติม |
| `allocated_by` | INT | ผู้แจก (admin) |
| `period_start` / `period_end` | DATE | ช่วงรอบ |
| `deleted_at` | TIMESTAMP NULL | soft delete |

**Indexes:** `INDEX(quota_product_id, user_id)`, `INDEX(company_id, period_start, period_end)`

### 4. `quota_usage` — ประวัติการใช้โควตา

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `id` | INT AUTO_INCREMENT | PK |
| `quota_product_id` | INT | FK → quota_products.id |
| `user_id` | INT | FK → users.id |
| `company_id` | INT | FK → companies.id |
| `order_id` | VARCHAR(50) | FK → orders.id |
| `quantity_used` | DECIMAL(10,2) | จำนวนที่ใช้ |
| `period_start` / `period_end` | DATE | ช่วงรอบ |
| `deleted_at` | TIMESTAMP NULL | soft delete |

**Indexes:** `INDEX(quota_product_id, user_id)`, `UNIQUE(order_id, quota_product_id)`

### 5. `quota_rate_scope` — Scope: rate ใช้ได้กับ product ไหนบ้าง

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `rate_schedule_id` | INT | FK → quota_rate_schedules.id |
| `quota_product_id` | INT | FK → quota_products.id |

**PK:** `(rate_schedule_id, quota_product_id)` — composite  
**Index:** `INDEX(quota_product_id)`

**เมื่อ rate มี `quota_product_id = NULL`:**
- ไม่มีแถวในตารางนี้ → Global (ทุกสินค้า)
- มีแถว → ใช้ได้เฉพาะ product ที่ระบุ (Scoped)

### Soft Delete

ทุกตารางใช้ **soft delete** — ไม่ลบจริง แต่ `SET deleted_at = NOW()`  
ทุก SELECT query ต้องมี `WHERE deleted_at IS NULL`

### Migration Guide

| สถานการณ์ | ไฟล์ที่ต้องรัน |
|----------|----------------|
| **Production มี DB อยู่แล้ว** | `migrate_confirm_mode.sql` → `migrate_soft_delete.sql` → `migrate_global_quota.sql` (3 ไฟล์ ตามลำดับ) |
| **Fresh install** | `create_quota_tables.sql` อย่างเดียว (1 ไฟล์) |

---

## Backend API (quota.php)

**Base path:** `api/Quota/quota.php`

### GET Endpoints (via query parameter `action`)

| Action | Parameters | คำอธิบาย |
|--------|-----------|---------| 
| `list_products` | `companyId` | ดึงรายการสินค้าโควตาทั้งหมด (JOIN products) |
| `get_rate` | `quotaProductId` (รับ `'global'` หรือ `0` ได้) | ดึง rate ที่ active ณ ปัจจุบัน |
| `list_rates` | `quotaProductId` (รับ `'global'` หรือ `0` ได้) | ดึง rate ทั้งหมด + แนบ `scope_product_ids[]` |
| `list_allocations` | `quotaProductId?, userId?, companyId?` | ดึงประวัติ allocation (JOIN users) |
| `calculate` | `quotaProductId, userId` | **คำนวณโควตาคงเหลือ** (รวม global/scoped) |
| `summary` | `companyId, quotaProductId` | สรุปโควตาพนักงานทุกคนใน company |

### POST Endpoints (via JSON body `action`)

| Action | Body | คำอธิบาย |
|--------|------|---------| 
| `create_product` | `productId, companyId, displayName, csvLabel?` | สร้างโควตาจากสินค้าที่มีอยู่ (**duplicate** product row + สร้าง quota_product) |
| `create_product_with_quota` | `companyId, displayName, csvLabel?, sku, productName?, price?, category?, shop?, description?` | **สร้างสินค้าใหม่ + โควตาพร้อมกัน** (atomic transaction) |
| `update_product` | `id, displayName?, csvLabel?, isActive?` | แก้ไข/ปิดใช้งาน |
| `create_rate` | `quotaProductId, salesPerQuota, effectiveDate, orderDateField, quotaMode, resetIntervalDays, resetDayOfMonth?, resetAnchorDate?, calcPeriodStart?, calcPeriodEnd?, usageStartDate?, usageEndDate?, requireConfirm?, createdBy?, scopeProductIds?[]` | สร้าง rate schedule ใหม่ (quotaProductId=0 → global, scopeProductIds → multi-product) |
| `update_rate` | `id, salesPerQuota?, effectiveDate?, orderDateField?, quotaMode?, resetIntervalDays?, resetDayOfMonth?, resetAnchorDate?, calcPeriodStart?, calcPeriodEnd?, usageStartDate?, usageEndDate?, requireConfirm?` | แก้ไข rate (ส่งเฉพาะ field ที่เปลี่ยน) |
| `delete_rate` | `id` | ลบ rate schedule |
| `allocate` | `quotaProductId, userId, companyId, quantity, source?, sourceDetail?, allocatedBy?, periodStart?, periodEnd?` | แจกโควตา |
| `use_quota` | `quotaProductId, userId, companyId, orderId, quantityUsed, periodStart?, periodEnd?` | บันทึกการใช้โควตา |
| `confirm_quota` | `quotaProductId, userId, rateScheduleId, confirmedBy?` | ยืนยันโควตา (กำหนดเอง + require_confirm=1) → สร้าง allocation source='auto_confirmed' |

### สำคัญ: Response ใช้ camelCase

API `summary` คืนค่า field เป็น **camelCase** เสมอ:
```json
{
  "userId": 1654,
  "userName": "Suda Supervisor",
  "remaining": 5,
  "totalQuota": 5,
  "totalAutoQuota": 0,
  "totalAdminQuota": 5,
  "totalUsed": 0,
  "totalSales": 0,
  "quotaMode": "confirm",
  "pendingAutoQuota": 100,
  "isConfirmed": false,
  "isExpired": false,
  "usageEndDate": "2026-04-30",
  "requireConfirm": 1,
  "rateScheduleId": 5
}
```
⚠️ ห้ามใช้ `user_id` (snake_case) ในการ match — ต้องใช้ `userId`

---

## Core Calculation Logic (`calculateQuota`)

### Helper: `_calcSalesInPeriod()`
SQL query แยกเป็นฟังก์ชัน reusable สำหรับคำนวณยอดขายในช่วงเวลา

### ขั้นตอน:

1. **ดึง latest rate** → `quota_rate_schedules` WHERE `effective_date ≤ NOW()` ORDER DESC LIMIT 1
2. **คำนวณ period** ตาม mode:
   - **Reset + monthly:** `reset_day_of_month` → คำนวณ period จากวันที่ X ของเดือนปัจจุบัน
   - **Reset + interval:** anchor + N × interval → หา period ปัจจุบัน
   - **Cumulative (segmented):** ดึง ALL rates → สร้าง segment แต่ละช่วง → แต่ละ segment ใช้ rate ของตัวเอง
3. **คำนวณยอดขาย** → `SUM(oi.quantity × oi.price_per_unit)` จาก `order_items` JOIN `orders`:
   - **JOIN:** `orders o ON o.id = oi.parent_order_id` ⚠️ **ไม่ใช่ `oi.order_id`** (เพราะ order_items.order_id มี suffix `-1`)
   - WHERE `oi.creator_id = :userId` ⚠️ **ไม่ใช่ `o.creator_id`** (เพื่อรวม upsell items ที่พนักงานเป็นคนเพิ่ม)
   - WHERE `o.order_status != 'Cancelled'`
   - WHERE date field (order_date/delivery_date) อยู่ใน period
   - **นับทุกสินค้า** — ไม่ filter product_id (โควตาได้จากยอดขายรวม ไม่ใช่จากสินค้าโควตาอย่างเดียว)
4. **Auto Quota** = `FLOOR(totalSales / salesPerQuota)`
5. **Admin Quota** = `SUM(quantity)` จาก `quota_allocations` WHERE source = 'admin' AND period ตรง
6. **Total Used** = `SUM(quantity_used)` จาก `quota_usage` WHERE period ตรง
7. **Remaining** = `autoQuota + adminQuota - totalUsed`

### Global/Scoped Quota (เพิ่มเติม)

หลังคำนวณ product-specific แล้ว ระบบจะ:
1. **ค้นหา global/scoped rate** → `WHERE quota_product_id IS NULL` + เช็ค scope:
   - `NOT EXISTS(scope)` → global (ใช้ได้ทุก product)
   - `EXISTS(scope WHERE product = current)` → scoped (ใช้ได้กับ product นี้)
2. คำนวณ `globalAutoQuota` จาก global rate
3. ดึง `globalAdminQuota` (allocations WHERE `quota_product_id IS NULL`)
4. ดึง `globalUsed` (usage WHERE `quota_product_id IS NULL`)
5. **Total** = `(autoQuota + adminQuota) + (globalAutoQuota + globalAdminQuota)`
6. **Remaining** = `totalQuota - totalUsed - globalUsed`

**Response เพิ่ม:** `globalAutoQuota`, `globalAdminQuota`, `globalUsed`, `globalRemaining`

### Confirm mode (กำหนดเอง)

1. ดึง `calc_period_start`, `calc_period_end` จาก rate schedule
2. คำนวณยอดขายในช่วงนั้น → `pendingAutoQuota = FLOOR(totalSales / salesPerQuota)`
3. เช็ค `require_confirm`:
   - **require_confirm=1:** ดู allocation `source='auto_confirmed'` → ถ้ามี → `autoQuota = confirmedAmount` (ถูก freeze) / ถ้าไม่มี → `autoQuota = 0`
   - **require_confirm=0:** `autoQuota = pendingAutoQuota` (คำนวณอัตโนมัติตลอด)
4. เช็คหมดอายุ: ถ้า `usage_end_date` มีค่า และ `today > usage_end_date` → `isExpired = true`, คงเหลือ = 0
5. เช็คยังไม่ถึงวันเริ่มใช้: ถ้า `usage_start_date` มีค่า และ `today < usage_start_date` → `isBeforeUsageStart = true`, `autoQuota = 0`

### ⚠️ Important: SQL Gotchas

| สิ่งที่ต้องระวัง | ค่าถูกต้อง | ❌ ค่าผิด | เหตุผล |
|---|---|---|---|
| JOIN key | `o.id = oi.parent_order_id` | `o.id = oi.order_id` | `order_items.order_id` มี suffix `-1` |
| Creator filter | `oi.creator_id` | `o.creator_id` | รวม upsell items ด้วย |
| Product filter | ไม่ filter | `oi.product_id = :pid` | โควตาได้จากยอดขายทุกสินค้า |

### ตัวอย่าง:

```
Rate: ฿5,000 / 1 โควตา
Mode: reset 30 วัน
ยอดขาย: ฿23,000

→ Auto Quota = FLOOR(23000 / 5000) = 4
→ Admin เพิ่ม: 1
→ Total Quota: 5
→ ใช้ไปแล้ว: 2
→ คงเหลือ: 3
```

### ตัวอย่าง: Cumulative + เปลี่ยน Rate (Segmented)

```
Rate A: effective 1 ม.ค., cumulative, ฿3,000/โควตา
Rate B: effective 1 ก.พ., cumulative, ฿5,000/โควตา

ระบบแบ่ง 2 ช่วง:
  ช่วง A (1 ม.ค. → 31 ม.ค.): ยอดขาย ฿15,000 → FLOOR(15000/3000) = 5
  ช่วง B (1 ก.พ. → วันนี้):  ยอดขาย ฿20,000 → FLOOR(20000/5000) = 4

→ Auto Quota = 5 + 4 = 9 (สะสมข้ามรอบ แต่ใช้ rate คนละตัว)
```

### ตัวอย่าง: Reset ตัดสะสม

```
Rate A: 1 ม.ค., cumulative, ฿3,000 → 5 โควตา
Rate B: 1 ก.พ., cumulative, ฿5,000 → 4 โควตา
Rate C: 1 มี.ค., RESET 30 วัน, ฿5,000

→ Rate C เป็น reset → ตัด A+B ทิ้ง
→ Auto Quota = คำนวณจากยอดขาย มี.ค. อย่างเดียว
```

### พฤติกรรม Reset ที่ต้องเข้าใจ

| คำถาม | คำตอบ |
|-------|-------|
| สะสมหายตอนไหน? | ทันทีที่ `effective_date` ของ rate แบบ reset ถึง |
| `reset_day_of_month` คืออะไร? | กำหนดขอบเขตรอบ (period) ไม่ใช่กำหนดวันรีเซ็ต |
| ติดลบจะเป็น 0 ไหม? | ใช่ — ระบบคำนวณใหม่จาก period ใหม่ (auto/admin/used เริ่มจาก 0 หมด) |
| แก้ rate ทำให้โควตาติดลบ? | ได้ — เช่น rate 1000→5000 ทำให้ used มากกว่า auto → remaining ติดลบ |

---

## Frontend UI — QuotaSettingsPage

### 3 Tabs:

#### Tab 1: สินค้าโควตา
- ตาราง: สินค้า, ชื่อในระบบ, ชื่อ CSV, สถานะ, แก้ไข
- **Dual-mode สร้างสินค้าโควตา:** (ทั้ง 2 mode สร้าง 2 ตาราง: `products` + `quota_products`)
  - **Mode 1 — อ้างอิงจากสินค้าที่มีอยู่:** เลือก product จาก dropdown → **duplicate** product row (SKU: `QT-ของเดิม`) → สร้าง quota_product อ้างอิงตัวใหม่
  - **Mode 2 — สร้างสินค้าใหม่:** กรอก SKU, ชื่อ, ราคา, หมวดหมู่ → เรียก `create_product_with_quota` (สร้าง products row + quota_products row ใน transaction เดียว)
- Toggle Active/Inactive

#### Tab 2: อัตราโควตา
- เลือกสินค้าโควตาจาก dropdown
- **🌐 ทั้งหมด (Global):** option แรกใน dropdown สำหรับสร้าง rate ที่ใช้ได้กับทุกสินค้า/เฉพาะบางสินค้า
- **📌 Scope Checkboxes:** เมื่อเลือก "ทั้งหมด" → form แสดง checkboxes สินค้าทั้งหมด
  - ไม่เลือก = Global (ทุกสินค้า)
  - เลือกบางอัน = Scoped (เฉพาะที่ติ๊ก)
- **Rate card scope label:** แสดง "🌐 ทุกสินค้า" หรือ "📌 สินค้า A, สินค้า B" ใน rate card
- **Badge สถานะ:**
  - `reset/cumulative`: "ใช้งานอยู่" เฉพาะ idx=0 + effectiveDate≤today (แสดงได้แค่ 1 ตัว)
  - `confirm`: แสดงได้ **หลายตัวพร้อมกัน** ตามช่วงใช้งาน:
    - 🟣 "ใช้งานอยู่" → `usage_start_date ≤ today ≤ usage_end_date` (ไม่มี end = ใช้ตลอด)
    - 🟡 "ยังไม่เริ่มใช้" → `today < usage_start_date`
    - 🔴 "หมดอายุ" → `today > usage_end_date`
- **Mode display:** reset monthly → "รีเซ็ตทุกวันที่ X" / reset interval → "รีเซ็ตทุก N วัน" / cumulative → "สะสม" / confirm → "กำหนดเอง"
- **ปุ่มแก้ไข (✏️):** เปิด modal เดิม pre-fill ข้อมูล → `updateRateSchedule` → reload
- **ปุ่มลบ (🗑️):** confirm dialog → `deleteRateSchedule` → reload
- Modal สร้าง/แก้ rate:
  - Title: เปลี่ยนตาม mode ("สร้างอัตราโควตาใหม่" / "แก้ไขอัตราโควตา")
  - **Reset type:** เลือก "ทุกวันที่ X ของเดือน" (dropdown 1-28) หรือ "ทุก N วัน" (interval + anchor)
  - **⚠️ Confirmation dialog:** เมื่อสร้างใหม่ mode = reset → แจ้งเตือนว่าโควตาสะสมจะหายไป
  - **Confirm mode fields:** เมื่อเลือก "กำหนดเอง" → ซ่อน "มีผลตั้งแต่วันที่" (auto-set = `calc_period_start`) + แสดงช่องออเดอร์คำนวณ (start/end) + วันเริ่ม/หมดอายุ + checkbox รอ Admin ยืนยัน
  - **ล็อคโหมด:** เมื่อแก้ไข rate เดิม → radio buttons โหมดจะถูก disabled ("ไม่สามารถเปลี่ยนโหมดได้ กรุณาสร้างอัตราใหม่แทน")
  - **Date validation:** confirm mode เช็ควันที่: calc_period_start < end, usage_start ต้องกรอก, usage_start < usage_end

#### Tab 3: สรุปโควตาพนักงาน
- เลือกสินค้าโควตาจาก dropdown
- แสดงรอบปัจจุบัน (เช่น 2026-03-13 — 2026-04-12)
- ตาราง 8+ คอลัมน์: พนักงาน, ยอดขาย, โควตา(Auto), โควตา(Admin), รวม, ใช้แล้ว, คงเหลือ, การดำเนินการ
- Modal: เพิ่มโควตาให้พนักงาน (จำนวน + หมายเหตุ) — จะบันทึก period_start/period_end ของรอบปัจจุบันอัตโนมัติ
- Modal: ดูประวัติ allocation ทั้งหมด
- **Confirm mode:** แสดงปุ่ม ✅ ยืนยัน เฉพาะเมื่อ `require_confirm=1` และ `isBeforeUsageStart=false` — ซ่อนเมื่อยังไม่ถึงวันเริ่มใช้
- **คงเหลือ:** แสดง `0 (หมดอายุ)` / `0 (ยังไม่เริ่มใช้)` ตามสถานะ

---

## ProductSelectorModal — Tab สินค้าโควตา

### คุณสมบัติ

- **Tab ที่ 3** ใน modal เลือกสินค้า: "⊕ สินค้าโควตา"
- **แสดงเฉพาะเมื่อ** `companyId` ถูกส่งผ่าน prop
- **🆕 Filter สินค้าโควตาออกจาก tab ปกติ:** สินค้าที่อยู่ใน `quota_products` จะไม่แสดงใน tab "สินค้า" (ปกติ) เพื่อป้องกันความสับสน
- **Eager loading quotaProducts:** โหลด `listQuotaProducts` ทันทีที่เปิด modal (ทุก tab) เพื่อสร้าง `quotaProductIds` Set สำหรับ filter
- **Lazy loading quota summary:** โหลด quota summary เฉพาะเมื่อ tab quota ถูกเลือก
- **Self-loading quota badge:** modal โหลด quota summary ของ user ปัจจุบันเองผ่าน `getQuotaSummary(companyId, quotaProductId)` แล้ว match ด้วย `currentUserId`
- **Reset on close:** ล้าง state เมื่อ modal ปิด (เปิดใหม่จะ fetch ข้อมูลล่าสุด)

### Props ใหม่ที่ต้องส่ง

```tsx
interface ProductSelectorModalProps {
  // ... existing props ...
  companyId?: number;        // ส่งจาก currentUser.companyId
  currentUserId?: number;    // ส่งจาก currentUser.id — ใช้ match quota summary
}
```

### Badge โควตาคงเหลือ

ระบบจะแสดง badge สีตามจำนวนคงเหลือ:

| สถานะ | Badge | เงื่อนไข |
|-------|-------|---------|
| มีเหลือเยอะ | ✅ `5 / 5` สีเขียว | remaining > 3 |
| เหลือน้อย | ⚠️ `2 / 5` สีเหลือง | remaining ≤ 3 |
| หมด | ❌ `0 / 5` สีแดง | remaining ≤ 0 |
| ไม่มีข้อมูล | `—` สีเทา | ไม่พบ quota summary |

### Internal Logic

```
1. เปิด modal (ทุก tab) → listQuotaProducts(companyId) → setQuotaProducts
2. สร้าง quotaProductIds = Set(quotaProducts.map(qp => qp.productId))
3. Tab สินค้าปกติ: filter !quotaProductIds.has(pr.id)
4. เปิด tab quota → getQuotaSummary(companyId, qp.id) สำหรับแต่ละ qp
5. Match: summaries.find(s => Number(s.userId) === currentUserId)
6. สร้าง quotaTabMap: Map<productId, { remaining, totalQuota }>
7. renderQuotaTabBadge ใช้ quotaTabMap ก่อน → fallback ไป quotaMap (prop)
```

### Callers ที่ต้องส่ง props

| ไฟล์ | ส่ง companyId | ส่ง currentUserId |
|------|-------------|-----------------|
| `CreateOrderPage.tsx` (main selector) | ✅ `currentUser?.companyId` | ✅ `currentUser?.id` |
| `CreateOrderPage.tsx` (upsell selector) | ✅ `currentUser?.companyId` | ✅ `currentUser?.id` |
| `OrderManagementModal.tsx` | ✅ `currentUser?.companyId` | ✅ `currentUser?.id` |

---

## Export Integration

### data_source: `item.quotaCsvLabel`

ใช้ใน Export Template เพื่อให้ชื่อสินค้าใน CSV ใช้ชื่อจากตาราง `quota_products.csv_label` แทน `products.name`

**ลำดับการ resolve:**
1. ค้นหา `quota_products` ที่ `product_id` ตรงกับ item
2. ถ้ามี `csv_label` → ใช้เลย
3. ถ้ามีแต่ `display_name` → ใช้ display_name
4. ถ้าไม่ใช่ quota product → fallback ไปใช้ `item.productName`

**Cache:** โหลดครั้งเดียวตอน mount `ManageOrdersPage` → `window.__quotaProductsCache`

---

## Permission

เมนู Sidebar ใช้ key: `data.quota_settings`  
ต้องตั้งค่า permission ใน Role Management ให้ role ที่ต้องการเข้าถึง

---

## Service Layer (quotaApi.ts)

### Functions

| Function | HTTP | API Action | คำอธิบาย |
|----------|------|------------|---------|
| `listQuotaProducts(companyId)` | GET | `list_products` | ดึงสินค้าโควตา (mapped to QuotaProduct) |
| `createQuotaProduct(payload)` | POST | `create_product` | สร้างจากสินค้าที่มีอยู่ |
| `createQuotaProductWithNew(payload)` | POST | `create_product_with_quota` | สร้างสินค้าใหม่ + โควตาพร้อมกัน |
| `updateQuotaProduct(payload)` | POST | `update_product` | แก้ไข/toggle active |
| `getActiveRate(quotaProductId)` | GET | `get_rate` | ดึง rate ปัจจุบัน |
| `listRateSchedules(quotaProductId)` | GET | `list_rates` | ดึง rates ทั้งหมด (รับ `number \| 'global'`) |
| `createRateSchedule(payload)` | POST | `create_rate` | สร้าง rate ใหม่ (quotaProductId=0→global, scopeProductIds?[]→multi-product) |
| `updateRateSchedule(payload)` | POST | `update_rate` | แก้ไข rate (ส่งเฉพาะ field ที่เปลี่ยน) |
| `deleteRateSchedule(id)` | POST | `delete_rate` | ลบ rate schedule |
| `listQuotaAllocations(params)` | GET | `list_allocations` | ดึงประวัติ allocation |
| `allocateQuota(payload)` | POST | `allocate` | แจกโควตา (admin) |
| `useQuota(payload)` | POST | `use_quota` | บันทึกการใช้โควตา |
| `confirmQuota(payload)` | POST | `confirm_quota` | ยืนยันโควตา (กำหนดเอง + require_confirm=1) |
| `calculateUserQuota(qpId, userId)` | GET | `calculate` | คำนวณโควตาของ user |
| `getQuotaSummary(companyId, qpId)` | GET | `summary` | สรุปโควตาทุกคน (⚠️ returns raw camelCase) |

### ⚠️ หมายเหตุ: `getQuotaSummary` ไม่มี mapper

`getQuotaSummary` คืน `res.data` ตรงๆ **ไม่มีการ map** snake_case → camelCase  
เนื่องจาก PHP คืน camelCase อยู่แล้ว → ใช้ได้ตรงกับ `QuotaSummary` type  
แต่ต้องระวังถ้าเปลี่ยน backend ให้คืน snake_case → จะ break

---

## ส่วนที่ยังไม่ได้ทำ (Phase 2 ขั้นสูง)

- [ ] **ล็อคออเดอร์:** ป้องกันไม่ให้สร้างออเดอร์เมื่อโควตาของพนักงานหมด
- [ ] **Auto-record usage:** บันทึก `quota_usage` อัตโนมัติเมื่อสร้างออเดอร์สินค้าโควตาสำเร็จ
- [ ] **Dashboard widget:** แสดงโควตาคงเหลือในหน้า Telesale Dashboard
- [ ] **Quota deduction on order:** หักโควตาอัตโนมัติเมื่อสร้างออเดอร์ที่มีสินค้าโควตา
