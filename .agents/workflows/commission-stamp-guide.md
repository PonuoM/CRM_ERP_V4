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
| `api/Commission/migrate_commission_stamp.php` | สร้างตาราง (auto-run via require_once) |
| `api/Commission/stamp_orders.php` | POST — สร้าง batch + upsert orders (รองรับ `dry_run`) |
| `api/Commission/unstamp_orders.php` | POST — ลบ stamp (ทั้ง batch / เฉพาะ order) |
| `api/Commission/get_stamp_batches.php` | GET — ดึง batch ทั้งหมด / drill-down ดู orders / ค้นหา order_id |
| `api/Commission/get_commission_summary.php` | GET — สรุปจำนวนตามสถานะ แบ่งตามช่วงเวลา |
| `api/Commission/get_user_commission.php` | GET — ค่าคอมรายบุคคล แยกตาม user + ช่วงเวลา |
| `api/Commission/export_commission_orders.php` | GET — Export CSV + คอลัมน์ค่าคอม (Smart: auto-detect memory + fallback streaming) |
| `api/Database/create_commission_stamp.sql` | SQL migration (standalone สำหรับรันตรงกับ DB) |
| `pages/Finance/CommissionStampPage.tsx` | หน้า UI หลัก |
| `pages/ReportsPage.tsx` | รายงานคอมมิชชั่น (หมวดรายงาน) — สรุปสถานะ + Export CSV |
| `components/Sidebar.tsx` | เมนู "จัดการค่าคอม" ใน section การเงิน |
| `components/PermissionEditor.tsx` | permission key `finance-commission-stamp` |
| `App.tsx` | Route `'finance-commission-stamp'` / `'Calculate Commission'` |
| `services/api.ts` | เพิ่ม `Commission/` ใน direct-access path |
| `components/DateRangePicker.tsx` | ใช้เลือกช่วงวันที่สรุป + Export (auto-align ป้องกันล้นขอบจอ) |

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
| `for_month` | INT | เดือนที่ต้องการสรุปค่าคอม (1-12) |
| `for_year` | INT | ปีปฏิทินที่ต้องการสรุปค่าคอม (เช่น 2026) |

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

> [!CAUTION]
> **DDL Implicit Commit:** `migrate_commission_stamp.php` ต้องเรียก **ก่อน** `$pdo->beginTransaction()` เสมอ
> เพราะ `CREATE TABLE` ทำให้ MySQL commit transaction อัตโนมัติ
> ใช้ `ob_start()` / `ob_end_clean()` ครอบ migration เพื่อกัน JSON output ปน response
>
> ```php
> // ✅ ถูกต้อง
> ob_start();
> require_once __DIR__ . '/migrate_commission_stamp.php';
> ob_end_clean();
> $pdo->beginTransaction();
>
> // ❌ ผิด — จะทำให้ "There is no active transaction"
> $pdo->beginTransaction();
> require_once __DIR__ . '/migrate_commission_stamp.php';
> ```

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

### ⚙️ Dry Run Mode (ตรวจสอบก่อน Stamp)

ส่ง `dry_run: true` เพื่อ validate ข้อมูลโดยไม่สร้าง batch:

```json
{ "company_id": 1, "user_id": 5, "orders": [...], "dry_run": true }
```

**Output:**
```json
{
  "ok": true,
  "dry_run": true,
  "data": {
    "total": 5,
    "valid": 3,
    "errors": [
      "แถวที่ 2: ไม่พบ Order '999'",
      "แถวที่ 4: User ID '48' ไม่ได้อยู่บริษัทนี้ (order: 260101-00001abc)",
      "แถวที่ 5: ไม่พบ User ID '999' ในระบบ (order: 260102-00002def)"
    ]
  }
}
```

**Validation:**
- `order_id` ต้องมีอยู่ในตาราง `orders`
- `user_id` (ถ้าระบุ) ต้องมีอยู่ในตาราง `users` **และอยู่ใน company เดียวกัน**
  - ถ้า user มีอยู่แต่คนละ company → error: `"ไม่ได้อยู่บริษัทนี้"`
  - ถ้าไม่มีในระบบเลย → error: `"ไม่พบ User ID ในระบบ"`

> [!IMPORTANT]
> Frontend บังคับให้กด **ตรวจสอบ** ก่อนจึงจะปลดล็อกปุ่ม **Stamp** ได้
> แก้ไขข้อมูลในตาราง → verified state รีเซ็ตอัตโนมัติ

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

**ลบ stamp** (ต้องส่ง `company_id` ทุกครั้ง)

| Mode | Input | พฤติกรรม |
|------|-------|---------|
| ลบทั้ง batch | `{ "company_id": 1, "batch_id": 7 }` | ลบ batch + orders ทั้งหมด |
| ลบเฉพาะ orders ใน batch | `{ "company_id": 1, "batch_id": 7, "order_ids": ["123"] }` | ลบเฉพาะ orders ที่ระบุ |
| ลบข้ามทุก batch | `{ "company_id": 1, "order_ids": ["123"] }` | ลบ stamps ของ order นี้ทั้งหมด |

---

### 3. `get_stamp_batches.php` (GET)

| Parameter | คำอธิบาย |
|-----------|---------|
| `company_id` | ดึง batch ทั้งหมดของ company (JOIN users สำหรับชื่อผู้สร้าง) |
| `batch_id` | Drill-down: ดึง orders ใน batch นี้ (JOIN orders + users) |
| `order_id` | ค้นหา batch ที่มี order_id นี้ (INNER JOIN commission_stamp_orders, LIKE search) |

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

**Response format:** `{ ok: true, data: { rows: [...] } }` (⚠️ `data` เป็น Object ไม่ใช่ Array)

**หมายเหตุ:** กรอง sub-orders ออก (`o.id NOT REGEXP '-[0-9]+$'`)

---

### 6. `get_user_commission.php` (GET)

**ค่าคอมรายบุคคล แยกตาม user + ช่วงเวลา**

| Parameter | คำอธิบาย |
|-----------|---------|
| `company_id` | required |
| `group_by` | `month`, `week`, `day` |
| `start_date` | `YYYY-MM-DD` |
| `end_date` | `YYYY-MM-DD` |

**Output:** `{ rows: [...], user_totals: [...] }`
- `rows` — แต่ละ row = `{ user_id, first_name, last_name, username, period, order_count, total_commission }`
- `user_totals` — รวมทุก period ต่อ user = `{ user_id, ..., order_count, total_commission }`

**Logic:**
- ออเดอร์ที่คำนวณแล้ว จะถูกรวมยอดโบนัสโดยยึดข้อมูล `for_month` และ `for_year` ที่กำหนดไว้ในแต่ละ Batch (หากไม่ได้ระบุใน db จะ fallback ใช้วันที่สร้าง batch `created_at`) ไม่สนวันที่สั่งเพื่อแก้ไขปัญหายอดเหมาที่อยู่นอกระยะเวลา

---

### 7. `export_commission_orders.php` (GET)

**Export CSV ตาม template เดียวกับ ReportsPage (รายงานแบบละเอียด) + คอลัมน์ค่าคอม**

| Parameter | คำอธิบาย |
|-----------|---------|
| `company_id` | required |
| `status` | `all`, `incomplete`, `pending`, `calculated` |
| `start_date` / `end_date` | ช่วงวันที่ |
| `token` | Auth token (ส่งผ่าน query string สำหรับ direct download) |

**Smart Export (3-Phase):**
1. **Phase 1 (Main Query):** JOIN orders + items + products + customers + users + commission → `fetchAll()`
2. **Phase 2 (Batch Supplementary Data):** ดึงข้อมูลเสริมด้วย order IDs — chunked 500 IDs/batch
   - **2a:** Tracking numbers (`order_tracking_numbers`)
   - **2b:** Slip count + transfer date (`order_slips`)
   - **2c:** COD payment dates (`cod_records` + `cod_documents`)
   - **2d:** Airport delivery (`order_tracking_numbers` → `google_sheet_shipping`)
3. **Phase 3 (Output CSV):** `formatCsvRow()` + `fputcsv()`

> [!CAUTION]
> **`array_values()` จำเป็นหลัง `array_unique()`** — PDO ต้องการ 0-indexed array สำหรับ positional `?` placeholders
> ถ้าไม่ re-index → supplementary data หาย (tracking, airport, payment = null)
> ```php
> // ✅ ถูกต้อง
> $orderIds = array_values(array_unique(array_column($rows, 'order_id')));
> // ❌ ผิด — keys ไม่ต่อเนื่อง เช่น [0,1,3,5,...]
> $orderIds = array_unique(array_column($rows, 'order_id'));
> ```

**Helper functions:**
- `convertMemoryToBytes()` — แปลง `128M` / `1G` → bytes
- `formatCsvRow()` — แปลง DB row → CSV array (ใช้ร่วมทั้ง 2 mode)

**วันที่รับเงิน** — Logic:
- ดึงจาก `order_slips.transfer_date` (สลิปโอนเงิน) ก่อน
- ถ้าไม่มีสลิป → fallback ใช้ `cod_records` →  `cod_documents.document_datetime` (COD เก็บเงินปลายทาง)

**ความแตกต่าง format กับ ReportsPage:**
| คอลัมน์ | Commission Export (PHP) | Orders-Raw (JS) |
|---------|------------------------|------------------|
| วันที่ | `31/01/2026` (zero-padded) | `31/1/2026` (ไม่ pad) |
| ราคา/ส่วนลด | `290` (ตัวเลขเปล่า) | `฿290.00` (มี ฿ + ทศนิยม) |

> [!NOTE]
> Logic การนำข้อมูลเหมือน ReportsPage ทุกประการ ต่างกันแค่ format การแสดงผลเท่านั้น

---

## Frontend UI — CommissionStampPage

### โครงสร้างหน้า (5 ส่วน):

#### 1. Summary Cards (3 การ์ด)
- 🔴 **ยังไม่สำเร็จ** — ยังไม่ได้ตรวจสอบจากบัญชี
- 🟡 **รอคิดค่าคอม** — ตรวจสอบจากบัญชีแล้ว แต่ยังไม่คิดค่าคอม
- 🟢 **คิดค่าคอมแล้ว** — stamp แล้ว + ยอดค่าคอมรวม

#### 2. Import & Stamp (ตารางแบบ spreadsheet)

**UI:**
- **Header:** ชื่อรอบ + หมายเหตุ (inline inputs)
- **ตาราง 4 คอลัมน์:** Order ID* | User ID | ค่าคอม | หมายเหตุ
- **Paste support:** วางข้อมูลจาก Excel → auto-fill หลายแถว (split ด้วย tab/comma)
- **ปุ่ม:** ตรวจสอบ (🔍 สีน้ำเงิน) / Stamp (✅ สีเขียว เปิดหลังตรวจสอบผ่าน) / เพิ่มแถว (+) / ลบแถว (🗑️)
- เริ่มต้น 10 แถวว่าง, รีเซ็ตหลัง stamp สำเร็จ

**Dry Run Flow:**
1. กรอกข้อมูล → กด **ตรวจสอบ (N)**
2. ผ่าน → แสดง ✅ + ปลดล็อกปุ่ม Stamp
3. มี error → แสดง ⚠ + รายการปัญหา + Stamp ถูก disable
4. แก้ข้อมูล → verified state รีเซ็ตอัตโนมัติ ต้องตรวจสอบใหม่

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

#### 4. ค่าคอมรายบุคคล (Pivot Cross-Tab) — ธีมสีขาว

- **Header:** พื้นขาว + icon badge สีเทา (`bg-gray-100`)
- **DateRangePicker** แยกอิสระ + Group by toggle (เดือน/สัปดาห์/วัน) active สีเขียว (`bg-emerald-600`)
- **ตาราง Pivot:** แถว = ผู้ใช้ (เรียงตาม total commission desc), คอลัมน์ = ช่วงเวลา (dynamic)
  - **Header row:** `bg-gray-50` + ตัวอักษรสีเทาเข้ม
  - **Avatar:** วงกลมตัวอักษรแรก + gradient สี 8 แบบวนตาม index
  - **แต่ละ cell:** rounded card (`bg-gray-50` + `border-gray-100`) แสดงค่าคอม + จำนวนออเดอร์ / แสดง '—' ถ้าไม่มีข้อมูล
  - **คอลัมน์ "รวม":** progress bar สีเขียว (`from-emerald-400 to-emerald-500`) + bg-gray
  - **แถว "รวมทั้งหมด":** `bg-gray-100` + เส้นบน `border-t-2 border-gray-300`
- **Sticky ชื่อผู้ใช้** — คอลัมน์แรก sticky เมื่อ scroll แนวนอน (bg ตาม odd/even row)
- **Empty state:** ไอคอน Users (สีเทา) + ข้อความ hint
- อยู่ระหว่าง "สรุปตามช่วงเวลา" กับ "ประวัตินำเข้า"

> [!IMPORTANT]
> `loadUserComm()` ต้อง parse `Number()` ให้ `total_commission` และ `order_count` จาก API เพราะ MySQL คืนเป็น string → ถ้าไม่ parse จะต่อ string แทนบวกเลข

#### 5. ประวัตินำเข้า (เดิมชื่อ "ประวัติ Batch")

- รายการ batch พร้อมจำนวน orders + ค่าคอมรวม
- Expand → ดู orders ใน batch (ตาราง: Order ID, วันที่สั่ง, ยอด, ผู้ได้รับค่าคอม, ค่าคอม, หมายเหตุ, Stamp เมื่อ)
- ลบ batch (confirm dialog)

**ค้นหา Order ID:**
- ช่อง search ที่ header — พิมพ์ Order ID → backend filter batch ที่มี order นี้ (LIKE search)
- Auto-expand batch แรกที่พบ + โหลด orders
- Scroll ไปที่ section อัตโนมัติ
- **Highlight matching rows:** current match = `bg-amber-200` + เส้นซ้ายสีส้มเข้ม, other matches = `bg-amber-50` + เส้นซ้ายสีส้มอ่อน

#### 6. Floating Search Navigator (Ctrl+F style)

- กล่องลอย fixed มุมขวาล่าง — ปรากฏเมื่อมีการค้นหาหรือ expand batch
- มีช่อง input สำหรับพิมพ์ Order ID (sync กับช่อง search ที่ header)
- แสดง "N / M" + ปุ่ม ▲▼ เลื่อนไปแต่ละ match
- ปุ่ม ✕ ล้างการค้นหา
- Auto-scroll ไปที่ row ของ current match (`scrollIntoView({ block: 'center' })`)

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
- **Auto-align:** ตรวจสอบตำแหน่งปุ่มเมื่อเปิด — ถ้าอยู่ใกล้ขอบขวา (เหลือ < 660px) จะเปลี่ยนจาก `left-0` เป็น `right-0` ป้องกัน popup ล้นออกนอกจอ

---

## Direct File Access

`services/api.ts` → `Commission/` ถูกเพิ่มในรายการ paths ที่ bypass `index.php` router

```typescript
// api.ts — direct access list
'Commission/'  // ← เพิ่มแล้ว
```

---

## รายงานคอมมิชชั่น (ReportsPage)

หมวด `'commission'` ใน `ReportsPage.tsx` — แสดงสรุปสถานะและ Export CSV เหมือน CommissionStampPage แต่อยู่ใน section รายงาน

### คุณสมบัติ:
- **การ์ด:** "รายงานคอมมิชชั่น" + icon $ สีเขียว (emerald)
- **DateRangePicker:** เลือกช่วงเวลาสรุป (default: 1 ม.ค. ถึงวันนี้)
- **Group by:** เดือน / สัปดาห์ / วัน
- **ตารางสรุป:** ช่วงเวลา | 🔴 ยังไม่สำเร็จ | 🟡 รอคิดค่าคอม | 🟢 คิดแล้ว | รวม | ค่าคอมรวม + แถวรวมทั้งหมด
- **Export CSV:** DateRangePicker แยก + 4 ปุ่ม (ทั้งหมด / ยังไม่สำเร็จ / รอคิดค่าคอม / คิดแล้ว)
- **ซ่อน filter bar หลัก:** แถบกรองวันของ ReportsPage ถูกซ่อนเมื่ออยู่ในโหมดคอมมิชชั่น (มี DateRangePicker ของตัวเอง)

### API Response Parsing:
```typescript
// get_commission_summary.php คืน { ok: true, data: { rows: [...] } }
const rawData = res?.data;
const rows = Array.isArray(rawData) ? rawData
  : Array.isArray(rawData?.rows) ? rawData.rows
  : Array.isArray(res) ? res : null;
```

> [!WARNING]
> **`isLoading` guard:** ReportsPage มี `isLoading` จาก order fetch — commission ต้อง SKIP guard นี้
> `if (isLoading && selectedReport !== 'commission') { ... }`

---

## Known Issues & Gotchas

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|--------|
| `"There is no active transaction"` | `require_once migrate` อยู่ภายใน `beginTransaction()` → DDL implicit commit | ย้าย migration ไปรันก่อน `beginTransaction()` |
| Double JSON response | migration file มี `echo json_encode(...)` | ใช้ `ob_start()` / `ob_end_clean()` ครอบ |
| Export memory error | company มี orders มาก > 50K | ✅ แก้แล้ว: Smart Export auto-detect memory → fallback streaming fetch |
| Export tracking/airport/payment = null | `array_unique()` สร้าง keys ไม่ต่อเนื่อง → PDO bind positional `?` ผิดตำแหน่ง | ✅ แก้แล้ว: เพิ่ม `array_values()` หลัง `array_unique()` |
| Export timeout (MySQL gone away) | query supplementary data ทีเดียว > 7,000 IDs → `IN(...)` ใหญ่เกินไป | ✅ แก้แล้ว: `array_chunk()` 500 IDs/batch |
| Batch name ว่าง | Frontend ไม่ส่ง `batch_name` | Backend fallback: `'Batch ' . date('Y-m-d H:i')` |
| Grand total concatenate strings | API คืน `total_commission`, `order_count` เป็น string จาก MySQL → `+` ต่อ string | ใช้ `Number()` parse ตอน set state ใน `loadUserComm()` |
| ReportsPage commission ไม่แสดงข้อมูล | `res.data` เป็น Object `{rows:[...]}` ไม่ใช่ Array → `Array.isArray()` ได้ `false` | ✅ แก้แล้ว: parse `res.data.rows` fallback |
| DateRangePicker ล้นขอบจอขวา | popup ใช้ `left-0` เสมอ + `minWidth: 640px` | ✅ แก้แล้ว: auto-detect → `right-0` เมื่ออยู่ใกล้ขอบ |
