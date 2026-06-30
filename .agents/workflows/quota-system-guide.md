---
description: คู่มืออธิบายการทำงานระบบสินค้าโควตา (Product Quota System)
---

# ระบบสินค้าโควตา (Product Quota System)

## ภาพรวม

ระบบจำกัดจำนวนสินค้าที่พนักงานขายได้ตามโควตา คำนวณจากยอดขาย + Admin แจกเพิ่ม

**คุณสมบัติหลัก:** กำหนดยอดขาย/โควตา (เช่น ฿5,000 = 1 โควตา) · 3 โหมด: reset/cumulative/confirm · Reset 2 แบบ: monthly (ทุกวันที่ X) / interval (ทุก N วัน) · Cumulative segmented (เปลี่ยน rate ไม่สูญเสียสะสม) · ไม่นับ Cancelled · Multi-Product Scope (`quota_rate_scope`) · Tab สินค้าโควตาใน ProductSelectorModal + badge คงเหลือ · จำกัดจำนวนสินค้าตาม quotaMaxMap (ทั้ง create + upsell)

**รองรับ Role:** `Telesale`, `Supervisor Telesale`, `Admin Page` — filter ที่ `quota.php` 3 จุด (summary L289, summary_by_rate L1074, pending_counts L1636)

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|-------|
| `api/Database/create_quota_tables.sql` | SQL สร้าง 5 ตาราง (รวม `quota_rate_scope`) |
| `api/Database/migrate_confirm_mode.sql` | ALTER TABLE โหมดกำหนดเอง |
| `api/Database/migrate_soft_delete.sql` | soft delete + ลบ UNIQUE constraint |
| `api/Database/migrate_global_quota.sql` | nullable quota_product_id + `quota_rate_scope` |
| `api/Quota/migrate_valid_dates.php` | เพิ่ม `valid_from/valid_until` ใน allocations |
| `api/Database/migrate_per_product_rate.sql` | เพิ่ม `sales_per_quota` ใน `quota_rate_scope` (rate ต่อ product) |
| `api/migrations/015_add_rate_schedule_id_to_quota_allocations.sql` | เพิ่ม `rate_schedule_id` เพื่อแยกคอลัมน์จาก `source_detail` |
| `api/Quota/quota.php` | Backend API ทั้งหมด (16+ endpoints) |
| `api/Quota/quota_record_helper.php` | Shared helper `recordQuotaUsageForOrder()` |
| `types.ts` | Interfaces: QuotaProduct, QuotaRateSchedule, QuotaAllocation, QuotaSummary |
| `services/quotaApi.ts` | Service layer (17 functions) |
| `pages/QuotaSettingsPage.tsx` | Admin ตั้งค่าโควตา (3 tabs) |
| `pages/CreateOrderPage.tsx` | ส่ง companyId/userId ให้ modal + `recordOrderUsage` หลัง save + `quotaMaxMap` จำกัดจำนวน (create + upsell) |
| `components/ProductSelectorModal.tsx` | Tab สินค้าโควตา + badge คงเหลือ |
| `components/SingleDatePicker.tsx` / `DateRangePicker.tsx` | ปฏิทินเลือกวัน (fixed z-[9999]) |

**Migration:** Production → `migrate_confirm_mode` → `migrate_soft_delete` → `migrate_global_quota` → `migrate_valid_dates` → `migrate_per_product_rate` → `015_add_rate_schedule_id` | Fresh → `create_quota_tables` + วันที่แก้ไขต่างๆ

---

## Database Schema

### 1. `quota_products` — สินค้าโควตา
`id`, `product_id` (FK→products), `company_id`, `display_name`, `csv_label`, `is_active`, `deleted_at`
UNIQUE(`product_id, company_id`)

### 2. `quota_rate_schedules` — อัตราโควตา
`id`, `quota_product_id` (NULL=global/scoped), `sales_per_quota`, `effective_date`, `order_date_field` (order_date|delivery_date), `quota_mode` (reset|cumulative|confirm), `reset_interval_days`, `reset_day_of_month` (1-28, monthly), `reset_anchor_date` (interval), `calc_period_start/end` (confirm), `usage_start_date/end_date` (confirm), `require_confirm`, `created_by`, `deleted_at`

**quota_product_id:** specific ID → เฉพาะ product | NULL + ไม่มี scope → 🌐 Global | NULL + มี scope → 📌 Scoped

**Reset:** `reset_day_of_month` มีค่า → monthly | NULL → interval (N วันจาก anchor)
**Confirm:** คำนวณจาก `calc_period_start→end`, `require_confirm=1` → รอ admin ยืนยัน, `usage_end_date` → หมดอายุ

### 3. `quota_allocations` — ประวัติแจกโควตา
`id`, `quota_product_id`, `rate_schedule_id`, `user_id`, `company_id`, `quantity`, `sales_at_allocation` (บันทึกยอดขายตอนแอดมินกดยืนยัน), `source` (auto|admin|auto_confirmed|transfer), `source_detail` (ข้อความหมายเหตุล้วนๆ), `allocated_by`, `period_start/end`, `valid_from`, `valid_until`, `deleted_at`

> **Note:** คอลัมน์ `rate_schedule_id` ถูกแยกออกมาจาก `source_detail` แล้วในเวอร์ชันล่าสุด (015) เพื่อความถูกต้องตามหลัก 1NF ปัจจุบัน `source_detail` ใช้เก็บเฉพาะข้อความ (Note) เท่านั้น

### 4. `quota_usage` — ประวัติใช้โควตา
`id`, `quota_product_id`, `user_id`, `company_id`, `order_id`, `quantity_used`, `period_start/end`, `deleted_at`
UNIQUE(`order_id, quota_product_id`)

### 5. `quota_rate_scope` — rate ใช้ได้กับ product ไหน
PK: `(rate_schedule_id, quota_product_id)` — ใช้เฉพาะเมื่อ rate มี `quota_product_id = NULL`
`sales_per_quota` DECIMAL(12,2) DEFAULT NULL — ยอดขาย/โควตาเฉพาะสินค้านี้ (NULL = ใช้ค่าจาก rate schedule)

> **Shared Pool (โควตากองกลาง):** หาก 1 Rate ผูกกับหลายสินค้า (หลายแถวใน `quota_rate_scope`) ระบบจะถือว่า Rate นั้นเป็น "กองกลาง" สินค้าทุกตัวที่ผูกจะแชร์ยอดโควตาร่วมกัน เวลาแจก/โอน จะแจกเป็น `quota_product_id = NULL` พร้อมกับผูก `rate_schedule_id` ไว้เสมอ
> **Independent Quota:** หาก 1 Rate ผูกกับสินค้าแค่ 1 ตัว จะทำหน้าที่เสมือนโควตาเฉพาะของสินค้านั้นๆ

> ทุกตาราง soft delete (`deleted_at`) — ทุก SELECT ต้อง `WHERE deleted_at IS NULL`

---

## Backend API (quota.php)

### GET Endpoints

| Action | Params | คำอธิบาย |
|--------|--------|----------|
| `list_products` | companyId | สินค้าโควตาทั้งหมด |
| `get_rate` | quotaProductId (รับ 'global'/0) | rate ที่ active |
| `list_rates` | quotaProductId (รับ 'global'/0) | rates ทั้งหมด + `scope_product_ids[]` |
| `list_allocations` | quotaProductId?, userId?, companyId? | ประวัติ allocation |
| `calculate` | quotaProductId, userId | คำนวณโควตาคงเหลือ (รวม global/scoped) |
| `summary` | companyId, quotaProductId | สรุปทุกคน (legacy, product-based) |
| `summary_by_rate` | companyId, rateScheduleId (number/'all') | สรุปตาม rate |
| `pending_counts` | companyId | จำนวนรอยืนยันแยกตาม rate → `{ rateId: count }` |

### POST Endpoints

| Action | คำอธิบาย |
|--------|----------|
| `create_product` | สร้างจากสินค้าที่มี (duplicate product row + quota_product) |
| `create_product_with_quota` | สร้างสินค้าใหม่ + โควตา (atomic) |
| `update_product` | แก้ไข/toggle active |
| `create_rate` | สร้าง rate (quotaProductId=0→global, scopeProductIds?→multi) |
| `update_rate` | แก้ rate (ส่งเฉพาะ field ที่เปลี่ยน) |
| `delete_rate` | ลบ rate (soft delete) |
| `allocate` | แจกโควตาโดย Admin |
| `transfer_quota` | ระบบโอนโควตาให้กัน (สัดส่วน Shared Pool จะถูกคำนวณและโอนเป็น Shared Pool ด้วย `rate_schedule_id` ต้นทาง) |
| `use_quota` | บันทึกใช้โควตา |
| `confirm_quota` | ยืนยัน (confirm mode) → allocation source='auto_confirmed' |
| `bulk_confirm_quota` | ยืนยันหลายคน → `{ rateScheduleId, userIds[], confirmedBy, companyId }` |
| `record_order_usage` | สแกน order_items → match quota_products → INSERT IGNORE quota_usage |

> ⚠️ API Response ใช้ **camelCase** เสมอ — ห้ามใช้ `user_id` (snake_case) ต้องใช้ `userId`

---

## Core Calculation Logic

### ขั้นตอน
1. **ดึง latest rate** → `effective_date ≤ NOW()` ORDER DESC LIMIT 1 (product-specific → fallback global/scoped)
2. **คำนวณ period** → Reset monthly: วันที่ X ของเดือน | Reset interval: anchor + N × interval | Cumulative: ALL rates → segmented
3. **ยอดขาย** → `SUM(net_total)` โดยนับเฉพาะสินค้าที่ไม่ใช่ของแถม (`is_freebie = 0`) และไม่ใช่สินค้าย่อยในโปรโมชัน (`parent_item_id IS NULL`) จากตาราง `order_items` JOIN `orders` WHERE `o.order_status NOT IN ('Cancelled', 'Returned')`
4. **Auto** = `FLOOR(totalSales / salesPerQuota)` · **Admin** = SUM allocations (+ validity filter) · **Used** = SUM quota_usage
5. **Remaining** = `autoQuota + adminQuota - totalUsed`

**⚠️ No Rate Fallthrough:** ถ้าไม่มี rate schedule → ยังคำนวณ admin allocations + usage (ไม่ return 0 ทั้งหมด) → `quotaMode='N/A'`, autoQuota=0 แต่ adminQuota/used คำนวณปกติ

### ⚠️ SQL Gotchas

| ถูก | ❌ ผิด | เหตุผล |
|-----|--------|--------|
| `o.id = oi.parent_order_id` | `oi.order_id` | order_items.order_id มี suffix `-1` |
| `oi.creator_id` | `o.creator_id` | รวม upsell items |
| ไม่ filter product_id | `oi.product_id = :pid` | โควตาได้จากยอดขายทุกสินค้า |

### Global/Scoped (เพิ่มเติม)
หลังคำนวณ product-specific → ค้นหา global/scoped rate → คำนวณ `globalAutoQuota + globalAdminQuota` → Total = all combined

### Confirm mode & Cumulative Usage (หนี้โควตา / หนี้ยกมา)
- `require_confirm=1` → ดู allocation `source='auto_confirmed'` → autoQuota = confirmedAmount (freeze)
- `require_confirm=0` → autoQuota = pendingAutoQuota (อัตโนมัติ)
- `usage_end_date < today` → isExpired, remaining = 0
- `usage_start_date > today` → isBeforeUsageStart, autoQuota = 0
- **นโยบาย "ตัดบวก ทบลบ" (Expire Positive, Carry Forward Negative):** ในโหมด Confirm ระบบจะทำการคำนวณทีละรอบบิล (Period-by-period) ตามลำดับเวลา เพื่อหา "ยอดยกมา (Carried Debt)"
  - **หากรอบบิลก่อนหน้าใช้ไม่หมด (Balance เป็นบวก):** โควตาที่เหลือจะหมดอายุ และตัดทิ้งไป (`carriedDebt = 0`)
  - **หากรอบบิลก่อนหน้าใช้เกินโควตา (Balance เป็นลบ):** ส่วนที่ใช้เกินจะกลายเป็นหนี้โควตา และถูกนำไปบวกทบเป็นยอดการใช้งาน (Usage) ของรอบบิลปัจจุบัน เพื่อหักลบโควตารอบใหม่ทันที (`carriedDebt = balance`)

### Cumulative Segmented
เปลี่ยน rate → แบ่ง segment แต่ละช่วง ใช้ rate ของตัวเอง → รวม autoQuota ทุก segment | Rate reset ตัดสะสมทิ้ง

### ⚠️ Frontend Quota Deduction Simulation
ระบบหน้าบ้าน (CreateOrderPage) จะดักจับการหักโควตากองกลางก่อนยิง API โดยการจำลอง (Simulation) หักยอดทีละสินค้า หากพบว่ายอดรวมของทุกสินค้าที่ใช้กองกลางเดียวกันเกินจำนวนสิทธิ์ที่เหลือ จะบล็อคออเดอร์ทันที

---

## Frontend — QuotaSettingsPage (3 Tabs)

**UI Theme:** White card header + emerald/teal accent line (top gradient) · Pill tabs (bg-gray-100) · Green gradient buttons · Table gradient headers · fadeIn animation ทุก tab · Tailwind `fadeIn` keyframe กำหนดใน `index.html` tailwind config

### Tab 1: สินค้าโควตา
- Dual-mode สร้าง: อ้างอิงสินค้าที่มี (duplicate) หรือ สร้างใหม่พร้อมโควตา
- Toggle Active/Inactive
- Table: gradient header (`from-gray-50 to-emerald-50/30`) · uppercase column titles · hover `bg-emerald-50/40` · border-l-4 status color
- Button: gradient `from-emerald-600 to-teal-600` + hover scale

### Tab 2: อัตราโควตา
- **Filter Bar:** rounded-2xl shadow · Multi-select สินค้า + ช่วงวัน + ล้างตัวกรอง
- โหลด rates ทุก product + global ทีเดียว → filter frontend
- **Rate Card Layout (3 แถว):**
  - **Row 1:** Status badge + ชื่อ rate + ฿/โควตา (pill bg-gray-100) + วันที่มีผล + Edit/Delete
  - **Row 2:** Product pill badges แยก pill ต่อชิ้น (bg-emerald-100 / bg-teal-100) + แสดง per-product rate ถ้าต่างจาก main
  - **Row 3:** วันที่คำนวณออเดอร์ + calc period + ช่วงอายุโควตา + ชื่อผู้สร้าง
- Card border-l-4 ตามสถานะ: emerald (active) / amber (future) / red (expired)
- ⚠️ สร้าง reset → confirm dialog แจ้งเตือนสะสมหาย | แก้ไข → ล็อคโหมด

### Tab 3: สรุปโควตาพนักงาน
- **แยก 2 ตาราง ตาม role group:**
  - 🟢 **Telesale** (Telesale + Supervisor Telesale) — badge rounded-xl สีเขียว + จำนวนคน (bg-gray-100 pill)
  - 🟣 **Admin Page** — badge rounded-xl สีม่วง + จำนวนคน
  - ตารางไหนไม่มีข้อมูลจะไม่แสดง
  - Table: gradient header · even row stripe · hover `bg-emerald-50/40` · rounded-2xl container
- **Custom dropdown เลือกอัตราโควตา** (ไม่ใช่ native `<select>`):
  - Trigger button: แสดง badge pill สีส้ม `⏳ N รอยืนยัน` ด้านหน้าชื่อ rate
  - Dropdown panel: z-50 rounded-xl shadow-lg · แต่ละ option มี amber badge pill + truncated label
  - Selected state: bg-emerald-50 + text-emerald-700
  - Click outside → auto close (ref + mousedown listener)
  - State: `rateSelectorOpen` + `rateSelectorRef`
- **Pending counts:** pre-loaded `⏳ N รอยืนยัน` badge ใน dropdown options
- **Checkbox + Bulk confirm / Individual confirm:** แสดงเฉพาะ confirm mode + require_confirm=1 (สงวนสิทธิ์ให้ผู้ที่มี `is_system = 1` เท่านั้นที่จะเห็นปุ่มและกดยืนยันได้)
- **Allocation modal:** เลือกสินค้าเอง (checkbox "สินค้าทั้งหมด" default ติ๊ก / เอาติ๊กออก → toggle ทีละตัว) + จำนวนต่อสินค้า + วันเริ่ม/หมดอายุ + หมายเหตุ + สรุปจำนวนแถว (ไม่ส่ง periodStart/periodEnd)
- **Breakdown modal (👁️):** ประวัติโควตา แสดงรายละเอียดแยกตาม rate + แสดงชื่อสินค้า (`[Product Name]`) และชื่อ Rate อ้างอิงเพื่อป้องกันการสับสนว่าเป็นข้อมูลซ้ำซ้อน
- **Snapshot ยอดขาย (Audit):** ในโหมดรอยืนยัน เมื่อกดยืนยันโควตา ระบบจะดึงยอดขาย ณ เสี้ยววินาทีนั้นมาเก็บใน `sales_at_allocation` และแสดงตัวเลข `(ยืนยัน: ฿xxx,xxx)` สีเขียวใต้ยอดขาย Real-time ในตารางหลัก + ประวัติ Modal
**คงเหลือ (conditional):** `>0` green | `=0` gray | `<0` red | expired → gray ขีดฆ่า | before usage → gray

**Mode "ทั้งหมด" vs เลือก rate:** ทั้งหมด → aggregate, ไม่มี period/checkbox/confirm | เลือก rate → มีทุกอย่าง

---

## ProductSelectorModal — Tab สินค้าโควตา

- Tab ที่ 3 ("⊕ สินค้าโควตา") แสดงเมื่อ `companyId` prop ถูกส่ง
- Filter สินค้าโควตาออกจาก tab ปกติ (ป้องกันซ้ำ)
- Props: `companyId?`, `currentUserId?`, `quotaMap?`, `quotaProducts?`
- **Dynamic Quota (Best Practice):** ตัว Modal ลดภาระการเรียก API (Dumb Component) โดยจะรับ `quotaMap` (แผนผังโควตาที่ถูกหักลบสินค้าในตะกร้าบิลแบบ Real-time) และ `quotaProducts` ที่ถูกคำนวณจากหน้า `CreateOrderPage`
- ทำให้สามารถเช็คโควตากองกลางได้แม่นยำ หากเพิ่มสินค้าลงตะกร้าบิลจนแต้มกองกลางหมด Modal จะแสดงสถานะโควตาหมดทันทีโดยไม่ต้องโหลด API ใหม่
- การ Disable ปุ่ม "เลือก" จะดูจากเงื่อนไขว่า `โควตาคงเหลือ < ต้นทุนโควตาของสินค้านั้นๆ (quotaCost)` หรือเช็คจากแฟล็ก `isExhausted` เป็นหลัก

**Badge:** `isExhausted = true` ❌ red disabled | `isExhausted = false, remaining > 3` ✅ green | `isExhausted = false, remaining ≤ 3` ⚠️ yellow | ไม่มีข้อมูล `—` gray

---

## Phase 2 — Enforcement & Auto-Recording ✅

### Auto-Record Flow
```
quota_record_helper.php → recordQuotaUsageForOrder()
  ├─ POST /orders (สร้าง)
  ├─ PUT /orders/:id (แก้ไข)
  └─ POST /upsell (เพิ่มสินค้า)
  + quota.php record_order_usage (frontend fallback)
```
Helper: DELETE existing → SELECT quota_products → SELECT order_items → match → INSERT IGNORE

### Frontend Blocking

| จุด | เงื่อนไข | ผล |
|-----|---------|-----|
| ProductSelectorModal | `isExhausted` (โควตาคงเหลือน้อยกว่าราคาสินค้า) | disabled + "โควตาหมด" |
| Quantity input (create) | `nextQty > quotaMaxMap` (เพดาน Absolute Max) | ตัดค่าลง + alert |
| Quantity input (upsell) | `nextQty > quotaMaxMap` (เพดาน Absolute Max) | ตัดค่าลง + alert (ผ่าน `handleUpsellUpdateItem`) |

### quotaMaxMap (Real-time Quantity Limit)
`Map<productId, absoluteMaxQty>` — โหลดและคำนวณผ่าน `useMemo` แบบ Real-time ที่หน้า `CreateOrderPage.tsx`
- **การคำนวณ Absolute Max:** `(จำนวนของสินค้านี้ที่มีอยู่ในบิลปัจจุบัน) + (แต้มกองกลางที่เหลืออยู่หลังจากหักสินค้าทั้งหมดในบิลแล้ว / ราคาโควตา)`
- ระบบเช็คการกระจายสินค้าที่มีรหัสเหมือนกันในหลายแถว (Multiple rows) ด้วย `.reduce()`
- ทำให้ตารางบังคับเพดานสูงสุดในการพิมพ์เลขได้อย่างแม่นยำ ไม่ยอมให้กรอกเกินกองกลางแม้แต่นิดเดียว โดยไม่รบกวนข้อมูลเดิมที่พิมพ์ค้างไว้

**Visual:** `max` attr + border emerald + label "โควตา: N" + tooltip (เหมือนกันทั้ง 2 โหมด) (ตัวเลข N จะลดลงแบบ Dynamic เมื่อเพิ่มสินค้าตัวอื่นที่แชร์กองกลางเดียวกัน)

### Phase 3 (ยังไม่ทำ)
- [ ] Backend validation (block order API)
- [ ] Dashboard widget

---

## Service Layer (quotaApi.ts)

| Function | Action | หมายเหตุ |
|----------|--------|----------|
| `listQuotaProducts` | list_products | |
| `createQuotaProduct` | create_product | duplicate product row |
| `createQuotaProductWithNew` | create_product_with_quota | atomic |
| `updateQuotaProduct` | update_product | |
| `getActiveRate` | get_rate | |
| `listRateSchedules` | list_rates | รับ number/'global' |
| `createRateSchedule` | create_rate | 0→global, scopeProductIds→multi |
| `updateRateSchedule` | update_rate | partial update |
| `deleteRateSchedule` | delete_rate | |
| `listQuotaAllocations` | list_allocations | |
| `allocateQuota` | allocate | รองรับ validFrom/validUntil |
| `useQuota` | use_quota | |
| `confirmQuota` | confirm_quota | |
| `calculateUserQuota` | calculate | |
| `getQuotaSummary` | summary | legacy, ไม่มี mapper (PHP คืน camelCase) |
| `getSummaryByRate` | summary_by_rate | rate ID / 'all' |
| `bulkConfirmQuota` | bulk_confirm_quota | |
| `recordOrderUsage` | record_order_usage | |
| `getPendingCounts` | pending_counts | → `Record<number, number>` |

## Permission
เมนู Sidebar key: `data.quota_settings` — ตั้งค่าใน Role Management

**Role ที่รองรับในหน้าสรุป:** `Telesale`, `Supervisor Telesale`, `Admin Page`
→ hardcode ใน SQL query `role IN (...)` ที่ 3 จุดใน `quota.php` (summary, summary_by_rate, pending_counts)
