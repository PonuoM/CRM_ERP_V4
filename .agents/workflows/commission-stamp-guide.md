---
description: คู่มืออธิบายการทำงานระบบ Commission Stamp (ระบบ Stamp ค่าคอมมิชชัน)
---

# ระบบ Commission Stamp (Stamp ค่าคอมมิชชัน)

## ภาพรวม

ระบบ Commission Stamp เป็นระบบสำหรับ "stamp" (ตราประทับ) ออเดอร์ที่ได้คิดค่าคอมมิชชันแล้ว ใช้สำหรับแบ่งแยกออเดอร์ออกเป็น 3 สถานะ: ยังไม่สำเร็จ (incomplete), รอคิดค่าคอม (pending), คิดแล้ว (calculated)

**คุณสมบัติหลัก:**
- Import Order IDs ด้วยตารางแบบ spreadsheet (รองรับ Copy & Paste จาก Excel)
- สร้าง Batch (รอบ) สำหรับแต่ละครั้งที่ import
- รองรับ 4 รูปแบบ: `order_id` / `order_id + user_id` / `order_id + user_id + ค่าคอม` / `order_id + user_id + ค่าคอม + หมายเหตุ`
- 1 order สามารถมีผู้ได้รับค่าคอมได้มากกว่า 1 คน
- Upsert logic ข้ามทุก batch (ไม่จำกัดแค่ batch ปัจจุบัน)
- สรุปจำนวนออเดอร์ตามสถานะ แบ่งตามวัน/สัปดาห์/เดือน
- Export CSV ตามสถานะ + ช่วงวันที่ที่กำหนดเอง
- เงื่อนไขออเดอร์สำเร็จ: `payment_status = 'Approved'`

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|-------|
| `api/Commission/migrate_commission_stamp.php` | สร้างตาราง `commission_stamp_batches` + `commission_stamp_orders` |
| `api/Commission/stamp_orders.php` | POST — สร้าง batch + upsert orders |
| `api/Commission/unstamp_orders.php` | POST — ลบ stamp (ทั้ง batch / เฉพาะ order) |
| `api/Commission/get_stamp_batches.php` | GET — ดึง batch ทั้งหมด / drill-down ดู orders ใน batch |
| `api/Commission/get_commission_summary.php` | GET — สรุปจำนวนตามสถานะ แบ่งตามช่วงเวลา |
| `api/Commission/export_commission_orders.php` | GET — Export CSV คล้าย ReportsPage + คอลัมน์ค่าคอม |
| `pages/Finance/CommissionStampPage.tsx` | หน้า UI หลัก (import table, summary, batch history, export) |
| `components/Sidebar.tsx` | เมนู "Commission Stamp" ใน section Finance |
| `components/PermissionEditor.tsx` | กำหนด permission key `finance-commission-stamp` |
| `App.tsx` | Route `'finance-commission-stamp'` / `'Calculate Commission'` |
| `services/api.ts` | เพิ่ม `Commission/` ใน direct-access path |
| `components/DateRangePicker.tsx` | ใช้เลือกช่วงวันที่สรุป + Export |

---

## Database Schema

### 1. `commission_stamp_batches` — รอบ Import

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `id` | INT AUTO_INCREMENT | PK |
| `company_id` | INT | FK → companies.id |
| `name` | VARCHAR(255) | ชื่อรอบ เช่น "คิดค่าคอมเดือน ก.พ. 2569" |
| `order_count` | INT DEFAULT 0 | จำนวน orders ใน batch (recalculated) |
| `total_commission` | DECIMAL(12,2) DEFAULT 0 | ค่าคอมรวมใน batch (recalculated) |
| `created_by` | INT | FK → users.id (ผู้สร้าง) |
| `created_at` | TIMESTAMP DEFAULT NOW() | วันที่สร้าง |
| `note` | TEXT | หมายเหตุรอบ |

### 2. `commission_stamp_orders` — ออเดอร์ที่ stamp

| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `id` | INT AUTO_INCREMENT | PK |
| `batch_id` | INT | FK → commission_stamp_batches.id |
| `order_id` | VARCHAR(50) | FK → orders.id |
| `user_id` | INT NULL | FK → users.id (ผู้ได้รับค่าคอม, NULL = ไม่ระบุ) |
| `commission_amount` | DECIMAL(12,2) NULL | จำนวนค่าคอม (NULL = ไม่ระบุ) |
| `note` | TEXT NULL | หมายเหตุเฉพาะ order |
| `stamped_at` | TIMESTAMP DEFAULT NOW() | เวลาที่ stamp |
| `stamped_by` | INT NULL | FK → users.id (ผู้ทำการ stamp) |

**Unique Constraint:** `UNIQUE(batch_id, order_id, user_id)` — 1 batch ต่อ 1 order + user

---

## Backend API

### 1. `stamp_orders.php` (POST)

**สร้าง batch + upsert orders**

**Input:**
```json
{
  "company_id": 1,
  "user_id": 5,
  "batch_name": "คิดค่าคอมเดือน ก.พ.",
  "note": "หมายเหตุ (ไม่บังคับ)",
  "orders": [
    { "order_id": "260101-00001abc" },
    { "order_id": "260102-00002def", "user_id": 48, "commission_amount": 1500 },
    { "order_id": "260103-00003ghi", "user_id": 48, "commission_amount": 2000, "note": "Upsell bonus" }
  ]
}
```

**Output:**
```json
{
  "ok": true,
  "data": {
    "batch_id": 7,
    "stamped": 3,
    "added": 2,
    "replaced": 1,
    "errors": ["Order '999' not found"]
  }
}
```

### ⚠️ Upsert Logic (สำคัญมาก)

การค้นหาทำ **ข้ามทุก batch** (ไม่จำกัดแค่ batch ปัจจุบัน):

#### ขั้นตอน:

1. **Exact match** → ค้นหา record ที่ `order_id + user_id` ตรงกัน (across all batches)
   - พบ → **UPDATE** (เปลี่ยน amount, note, batch_id, stamped_at)
2. **ถ้าไม่เจอ exact match + importing WITH user_id** → ค้นหา record ที่มี `order_id` เดียวกัน แต่ `user_id = NULL`
   - พบ → **DELETE** record เก่า (NULL user_id) แล้ว **INSERT** record ใหม่ (มี user_id)
3. **ถ้าไม่เจอเลย** → **INSERT** ใหม่

#### ตัวอย่าง 4 scenarios:

| ครั้งที่ | Import | DB หลัง Import | Logic |
|---|---|---|---|
| 1 | `order_id: 123` | `(123, NULL, NULL)` — 1 record | INSERT ใหม่ |
| 2 | `order_id: 123, amount: 300` | `(123, NULL, 300)` — 1 record | Exact match (order_id + NULL) → UPDATE amount |
| 3 | `order_id: 123, user_id: 3, amount: 500` | `(123, 3, 500)` — 1 record | ไม่เจอ exact (user_id=3) → เจอ NULL record → DELETE + INSERT |
| 4 | `order_id: 123, user_id: 2, amount: 300` | `(123, 3, 500)` + `(123, 2, 300)` — 2 records | ไม่เจอ exact (user_id=2) + ไม่เจอ NULL → INSERT เพิ่ม |

#### Batch count recalculation:

หลัง upsert เสร็จ ระบบจะ recalculate `order_count` + `total_commission` ของ **ทุก batch** เพราะ record อาจย้าย batch

---

### 2. `unstamp_orders.php` (POST)

**ลบ stamp**

| Mode | Input | พฤติกรรม |
|------|-------|---------|
| ลบทั้ง batch | `{ "batch_id": 7 }` | ลบ batch + orders ทั้งหมด |
| ลบเฉพาะ orders ใน batch | `{ "batch_id": 7, "order_ids": ["123", "456"] }` | ลบเฉพาะ orders ที่ระบุ |
| ลบข้ามทุก batch | `{ "order_ids": ["123"] }` | ลบ stamps ของ order นี้ทั้งหมด |

---

### 3. `get_stamp_batches.php` (GET)

| Parameter | คำอธิบาย |
|-----------|---------|
| `company_id` | ดึง batch ทั้งหมดของ company (JOIN users สำหรับชื่อผู้สร้าง) |
| `batch_id` | Drill-down: ดึง orders ใน batch นี้ (JOIN orders + users) |

---

### 4. `get_commission_summary.php` (GET)

**สรุปจำนวนออเดอร์ตามสถานะ แบ่งตามช่วงเวลา**

| Parameter | ค่า | คำอธิบาย |
|-----------|-----|---------|
| `company_id` | INT | required |
| `group_by` | `month`, `week`, `day` | กลุ่มช่วงเวลา |
| `start_date` | `YYYY-MM-DD` | เริ่มต้น |
| `end_date` | `YYYY-MM-DD` | สิ้นสุด |

**สถานะ 3 ประเภท:**

| สถานะ | เงื่อนไข SQL |
|-------|-------------|
| `incomplete` | `payment_status != 'Approved'` AND ยังไม่ stamp |
| `pending` | `payment_status = 'Approved'` AND ยังไม่ stamp |
| `calculated` | มี record ใน `commission_stamp_orders` |

**Group by format (period column):**
- `month` → `2026-03`
- `week` → `2026-W03` (ISO week)
- `day` → `2026-03-17`

**หมายเหตุ:** กรอง sub-orders ออก (`o.id NOT REGEXP '-[0-9]+$'`)

---

### 5. `export_commission_orders.php` (GET)

**Export CSV ตาม template เดียวกับ ReportsPage (รายงานแบบละเอียด) + คอลัมน์ค่าคอม**

| Parameter | คำอธิบาย |
|-----------|---------|
| `company_id` | required |
| `status` | `all`, `incomplete`, `pending`, `calculated` |
| `start_date` / `end_date` | ช่วงวันที่ |
| `token` | Auth token (ส่งผ่าน query string สำหรับ direct download) |

---

## Frontend UI — CommissionStampPage

### โครงสร้างหน้า (4 ส่วน):

#### 1. Summary Cards (3 การ์ด)
- 🔴 **ยังไม่สำเร็จ** — `payment_status ≠ Approved`
- 🟡 **รอคิดค่าคอม** — Approved แต่ยังไม่ stamp
- 🟢 **คิดค่าคอมแล้ว** — stamp แล้ว + ยอดค่าคอมรวม

#### 2. Import & Stamp (ตารางแบบ spreadsheet)

**UI:**
- **Header:** ชื่อรอบ + หมายเหตุ (inline inputs)
- **ตาราง 4 คอลัมน์:** Order ID* | User ID | ค่าคอม | หมายเหตุ
- **Paste support:** วางข้อมูลจาก Excel → auto-fill หลายแถว (split ด้วย tab/comma)
- **ปุ่ม:** เพิ่มแถว (+) / ลบแถว (🗑️) / Stamp (✅)
- เริ่มต้น 10 แถวว่าง, รีเซ็ตหลัง stamp สำเร็จ

**State:**
```typescript
interface ImportRow {
  id: number;
  orderId: string;
  userId: string;
  amount: string;
  note: string;
}
```

#### 3. สรุปตามช่วงเวลา

**Controls:**
- `DateRangePicker` — เลือกช่วงวันที่สรุป (default: 3 เดือนล่าสุด)
- Group by toggle: เดือน / สัปดาห์ / วัน

**ตารางสรุป:** ช่วงเวลา | 🔴 ยังไม่สำเร็จ | 🟡 รอคิด | 🟢 คิดแล้ว | รวม | ค่าคอมรวม

**Week label format:** `dd/mm/yy - dd/mm/yy` เช่น `01/01/26 - 07/01/26` (คำนวณจาก ISO week → Monday-Sunday)

**Export:**
- แยก `DateRangePicker` สำหรับ Export (อิสระจากช่วงสรุป)
- 4 ปุ่ม: ทั้งหมด / ยังไม่สำเร็จ / รอคิดค่าคอม / คิดแล้ว

#### 4. ประวัติ Batch

- รายการ batch พร้อมจำนวน orders + ค่าคอมรวม
- Expand → ดู orders ใน batch (ตาราง: Order ID, วันที่สั่ง, ยอด, ผู้ได้รับค่าคอม, ค่าคอม, หมายเหตุ, Stamp เมื่อ)
- ลบ batch (confirm dialog)

---

## Permission

| ตำแหน่ง | Key |
|---------|-----|
| Sidebar เมนู (Finance) | `finance-commission-stamp` |
| App.tsx route | `'finance-commission-stamp'` / `'Calculate Commission'` |
| PermissionEditor | Finance section → `finance-commission-stamp` |

---

## Date Picker Components ที่ใช้

### `DateRangePicker.tsx`
- **Props:** `value: DateRange` (ISO start/end), `onApply(range)`
- **ใช้ใน:** เลือกช่วงวันที่สรุป + เลือกช่วงวันที่ Export (แยก 2 ตัว)
- **Popover:** `position: absolute` relative กับ input

---

## Direct File Access

`services/api.ts` → `Commission/` ถูกเพิ่มในรายการ paths ที่ bypass `index.php` router

```typescript
// api.ts — direct access list
'Commission/'  // ← เพิ่มแล้ว
```
