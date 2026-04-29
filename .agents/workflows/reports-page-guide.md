---
description: คู่มืออธิบายการทำงานหน้ารายงาน (Reports Page) — ดาวน์โหลด CSV, ดูสรุปตีกลับ, รายงานคอมมิชชั่น
---

# คู่มือหน้ารายงาน (Reports Page)

**ไฟล์:** `pages/ReportsPage.tsx`

ศูนย์รวมรายงานทั้งหมดของระบบ เปิดให้เลือกประเภทรายงาน กรองวันที่/แผนก/สถานะ แล้ว Export เป็น CSV หรือดูสรุปบนหน้าจอ

---

## สารบัญ (Table of Contents)
- [1. ประเภทรายงาน (7 Report Cards)](#1-ประเภทรายงาน-7-report-cards)
- [2. ตัวกรอง (Filters)](#2-ตัวกรอง-filters)
- [3. การดึงข้อมูล (Data Fetching)](#3-การดึงข้อมูล-data-fetching)
- [4. การ Export CSV](#4-การ-export-csv)
- [5. หน้าจอแสดงผล (UI)](#5-หน้าจอแสดงผล-ui)
- [6. สิทธิ์การเข้าถึง](#6-สิทธิ์การเข้าถึง)
- [7. ไฟล์ที่เกี่ยวข้อง](#7-ไฟล์ที่เกี่ยวข้อง)

---

## 1. ประเภทรายงาน (7 Report Cards)

| ID | ชื่อ | สถานะ | แหล่งข้อมูล |
|----|------|-------|-------------|
| `orders-raw` | รายงานออเดอร์แบบละเอียด | ✅ ใช้งานได้ | API `orders?pageSize=15000` (on-demand) |
| `stock` | รายงานสต๊อคคงเหลือ | 🔒 Disabled | props `warehouseStock` |
| `lot-stock` | รายงานสต๊อคคงคลัง-Lot | 🔒 Disabled | props `productLots` |
| `customers` | รายงานลูกค้า | 🔒 Disabled | props `customers` |
| `return-summary` | รายงานตีกลับเข้าคลัง | ✅ ใช้งานได้ | API `Orders/export_return_orders.php` |
| `commission` | รายงานคอมมิชชั่น | ✅ ใช้งานได้ | API `Commission/get_commission_summary.php` + `export_commission_orders.php` |
| `call-history` | บันทึกการโทร | ✅ ใช้งานได้ | API `Reports/export_call_history.php` |

---

## 2. ตัวกรอง (Filters)

### 2.1 ช่วงเวลา (Date Range)
| ตัวเลือก | ช่วง |
|----------|------|
| วันนี้ | วันนี้ |
| 7 วัน | 7 วันย้อนหลัง |
| 30 วัน | 30 วันย้อนหลัง |
| เดือนนี้ | วันที่ 1 ถึงวันนี้ |
| เดือนที่แล้ว | วันที่ 1 ถึงสิ้นเดือนที่แล้ว |
| 1 ปี | 1 ปีย้อนหลัง |
| กำหนดเอง | เลือก start/end |

> ใช้ local date format เพื่อหลีกเลี่ยง timezone issues (UTC+7)

### 2.2 กรองแผนก (Department Filter)
- Multi-select dropdown (`selectedDepartments`)
- ดึงรายชื่อแผนกจาก `users.role` ที่มี orders ในช่วงเวลาที่เลือก
- มีปุ่ม "ทั้งหมด" สำหรับ select/deselect all

### 2.3 กรองสถานะออเดอร์ (Order Status Filter)
- Multi-select dropdown (`selectedOrderStatuses`)
- ตัวเลือก: รอดำเนินการ, ยืนยันแล้ว, กำลังจัดเตรียม, กำลังจัดส่ง, จัดส่งสำเร็จ, ยกเลิก, ตีกลับ

> **หมายเหตุ:** ตัวกรองแผนกและสถานะจะแสดงเฉพาะเมื่อเลือกรายงาน `orders-raw`

---

## 3. การดึงข้อมูล (Data Fetching)

### 3.1 Orders & Customers
- เมื่อเปลี่ยน date range → เรียก API ดึง orders + customers ใหม่อัตโนมัติ
- `orders?pageSize=15000&orderDateStart=...&orderDateEnd=...&companyId=...`
- `customers?pageSize=5000&companyId=...`
- SuperAdmin ไม่ส่ง companyId (ดูทุกองค์กร)
- แสดง warning ถ้าข้อมูลถูกตัดที่ 15,000 รายการ

### 3.2 Return Summary
- เรียกเมื่อเลือกรายงาน `return-summary`
- API: `Orders/get_return_summary.php?date_from=...&date_to=...`
- คืนค่า: `totalOrders, allOrders, totalBoxes, returning, good, damaged, lost`

### 3.3 Commission Summary
- เรียกเมื่อเลือกรายงาน `commission`
- API: `Commission/get_commission_summary.php?company_id=...&group_by=...&start_date=...&end_date=...`
- `group_by`: `month` / `week` / `day`
- คืนค่า: rows ของ `{ period, incomplete, pending, calculated, total, total_commission }`

### 3.4 Order Boxes (สำหรับ Returned Orders)
- หลังโหลด orders → batch-fetch `order_boxes` เฉพาะ orders ที่ `orderStatus = 'Returned'`
- API: `Orders/get_order_boxes.php?order_ids=ID1,ID2,...` (chunks of 100)
- เก็บ map `{orderId-boxNumber → return_status}` ใน state `orderBoxesMap`
- ใช้ใน `reportData` useMemo สำหรับคอลัมน์ 'สถานะออเดอร์' ของ orders-raw export

### 3.5 Call History
- เรียกเมื่อเลือกรายงาน `call-history` และเปลี่ยนช่วงวันที่ (ใช้ตัวกรองวันที่แบบ Global)
- API: `Reports/export_call_history.php?company_id=...&start_date=...&end_date=...&format=preview`
- คืนค่า: rows ของข้อมูลการโทรสูงสุด 15 รายการ เพื่อนำมาแสดงตารางพรีวิว

---

## 4. การ Export CSV

### 4.1 รายงานออเดอร์แบบละเอียด (`orders-raw`)
ดึงข้อมูลจาก API ขณะ export (ไม่ใช้ preview data):

**คอลัมน์ CSV:**
`วันที่สั่งซื้อ, เลขคำสั่งซื้อ, user_id, ผู้ขาย, แผนก, ชื่อลูกค้า, เบอร์โทรลูกค้า, ประเภทลูกค้า, วันที่จัดส่ง, ช่องทางสั่งซื้อ, เพจ, ช่องทางการชำระ, ที่อยู่, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์, ภาค, รหัสสินค้า/โปร, สินค้า, ประเภทสินค้า, ประเภทสินค้า (รีพอร์ต), ชื่อโปร, ของแถม, จำนวน (ชิ้น), ราคาต่อหน่วย, ส่วนลด, ยอดรวมรายการ, หมายเลขกล่อง, หมายเลขติดตาม, วันที่จัดส่ง Airport, สถานะจาก Airport, สถานะออเดอร์, สถานะการชำระเงิน, สถานะสลิป, วันที่รับเงิน, ตะกร้าขาย`

**Logic พิเศษ:**
- แต่ละ order แยก row ตาม item (1 row ต่อ 1 สินค้า)
- ยอดรวมของ Claim/Gift = 0 (discount = full price)
- EXTERNAL orders ที่ price_per_unit=0 ใช้ net_total แทน
- รหัสสินค้า: โปรโมชั่น → `PROMO-XXX`, สินค้าเดี่ยว → SKU
- ภาค: map จากจังหวัด (รวม 77 จังหวัดทั้งหมด)
- กรองแผนกที่เลือกด้วย (`selectedDepartments`)

**สถานะออเดอร์ (ตีกลับ):**
- เมื่อ `orderStatus = 'Returned'` → ดึง `order_boxes` ผ่าน `get_order_boxes.php` แล้วแสดงสถานะ return ต่อกล่อง
- ตัวอย่าง: `ตีกลับ (กล่อง 1 : สภาพดี)`, `ตีกลับ (กล่อง 2 : ชำรุด)`
- สถานะ: `returning→กำลังตีกลับ, good/returned→สภาพดี, damaged→ชำรุด, lost→ตีกลับสูญหาย, NULL→ไม่ถูกตีกลับ`

**สถานะออเดอร์ (status mapping):**

| Status | แสดงผล |
|--------|----------|
| `Pending` | รอดำเนินการ |
| `Confirmed` | ยืนยันแล้ว |
| `Picking` | กำลังจัดเตรียม |
| `Preparing` | กำลังจัดเตรียมสินค้า |
| `Shipping` | กำลังจัดส่ง |
| `Delivered` | จัดส่งสำเร็จ |
| `Cancelled` | ยกเลิก |
| `Returned` | ตีกลับ (กล่อง X : สถานะ) |
| `Claiming` | รอเคลม |
| `BadDebt` | หนี้สูญ |
| `PreApproved` | รออนุมัติ |

### 4.2 รายงานตีกลับ (`return-summary`)
ดึงจาก API `Orders/export_return_orders.php`:

**คอลัมน์ CSV:**
`Order ID, Sub Order ID, วันที่สั่งซื้อ, ชื่อลูกค้า, เบอร์โทร, ที่อยู่, แขวง/ตำบล, เขต/อำเภอ, จังหวัด, รหัสไปรษณีย์, Tracking No., สถานะตีกลับ, หมายเหตุ, ยืนยันจบเคส, ค่าเคลม, ราคากล่อง, ยอดเก็บได้, ชื่อสินค้า, จำนวน, ผู้ขาย, วันที่บันทึก, ช่องทางชำระ`

**Logic พิเศษ:**
- Group by `order_id + box_number` — order-level fields แสดงเฉพาะ row แรกของกลุ่ม
- สถานะ: `returning→กำลังตีกลับ, good→สภาพดี, damaged→ชำรุด, lost→ตีกลับสูญหาย`

### 4.3 รายงานคอมมิชชั่น (`commission`)
Export ผ่าน `window.open()` → เปิด URL ใหม่พร้อม token:
- API: `Commission/export_commission_orders.php?company_id=...&status=...&start_date=...&end_date=...&token=...`
- Export ตาม status: `incomplete`, `pending`, `calculated`
- ช่วงวันที่แยกจาก summary (มี DateRangePicker ของตัวเอง)
- **สถานะออเดอร์**: ใช้ logic เดียวกับ orders-raw (รวม `Preparing`, ตีกลับต่อกล่อง via `order_boxes`)

### 4.4 รายงานบันทึกการโทร (`call-history`)
- เรียก API `Reports/export_call_history.php?company_id=...&start_date=...&end_date=...&format=json`
- นำข้อมูล JSON ที่ได้มาใช้งานร่วมกับฟังก์ชัน `downloadDataFile` เพื่อสร้างไฟล์ CSV/Excel 
- ใช้ตัวกรองช่วงเวลา (Date Range) หลักของหน้ารายงานร่วมกับรายงานอื่นๆ

### 4.5 รายงานอื่น (stock, lot-stock, customers)
ใช้ข้อมูลจาก props โดยตรง → `downloadDataFile()` function

### รูปแบบ CSV ทั้งหมด
- Encoding: UTF-8 + BOM (`\uFEFF`)
- ชื่อไฟล์: `{report}_{startDate}_{endDate}.csv`
- Escape: comma/quotes ใน value → wrap ด้วย double-quotes

---

## 5. หน้าจอแสดงผล (UI)

### 5.1 เลือกรายงาน
- แสดงเป็น Card grid (2-3 คอลัมน์)
- Card ที่ disabled แสดงสีเทาพร้อมข้อความ "ใช้งานได้ในอนาคต"
- กดเลือก Card → แสดงเนื้อหารายงานด้านล่าง

### 5.2 Preview Table (orders-raw, stock, lot-stock, customers)
- แสดง preview สูงสุด 50 rows แรก
- ถ้ามีมากกว่า → แสดง banner "แสดงเพียง 50 รายการแรก จากทั้งหมด N" + ปุ่มดาวน์โหลด
- คอลัมน์ "สถานะออเดอร์" แสดงเป็น Badge สี

### 5.3 Return Summary Dashboard
- แถวที่ 1: ออเดอร์ทั้งหมด, ออเดอร์ตีกลับ, % ตีกลับ, จำนวนกล่อง
- แถวที่ 2: กำลังตีกลับ, เข้าคลัง (รวม), สภาพดี, ชำรุด, สูญหาย
- ปุ่มดาวน์โหลด CSV

### 5.4 Commission Summary
- ตาราง pivot ตาม period (month/week/day)
- คอลัมน์: ข้อมูลไม่ครบ, รอคำนวณ, คำนวณแล้ว, รวม, ค่าคอมฯ
- แถว footer รวม totals
- ส่วน Export: เลือก status + ช่วงเวลา → ดาวน์โหลด CSV

### 5.5 Call History
- ใช้ตัวกรองช่วงเวลา (Global Date Filter) จากด้านบนของเพจร่วมกัน
- แสดงข้อมูลพรีวิวตารางประวัติการโทร (สูงสุด 15 รายการ) 
- มีปุ่มดาวน์โหลดรายงานข้อมูลเต็มรูปแบบเป็น CSV หรือ Excel

---

## 6. สิทธิ์การเข้าถึง

- **SuperAdmin:** ดูข้อมูลทุกองค์กร (ไม่ส่ง companyId)
- **Role อื่น:** ดูเฉพาะ companyId ของตัวเอง

---

## 7. ไฟล์ที่เกี่ยวข้อง

### Frontend
- `pages/ReportsPage.tsx` — หน้าจอหลัก
- `components/DateRangePicker.tsx` — Component เลือกช่วงวันที่
- `utils/customerGrade.ts` — คำนวณเกรดลูกค้า
- `utils/apiBasePath.ts` — resolve API base URL
- `appBasePath.ts` — app base path

### Backend APIs
| API | หน้าที่ |
|-----|---------|
| `orders?pageSize=...` | ดึงออเดอร์ (รวม items, slips) |
| `customers?pageSize=...` | ดึงข้อมูลลูกค้า |
| `Orders/get_order_boxes.php` | ดึง order_boxes (return_status) แบบ batch ตาม order_ids |
| `Orders/export_return_orders.php` | ดึงข้อมูลตีกลับสำหรับ CSV |
| `Orders/get_return_summary.php` | สรุปสถิติตีกลับ |
| `Commission/get_commission_summary.php` | สรุปคอมมิชชั่นตาม period |
| `Commission/export_commission_orders.php` | Export CSV คอมมิชชั่น (direct download) |
| `Reports/export_call_history.php` | ดึงข้อมูลประวัติการโทร (รองรับ format: csv, json, preview) |
