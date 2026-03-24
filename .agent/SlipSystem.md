# คู่มือระบบสลิป (Slip System)

## 1. ภาพรวม

ระบบสลิปประกอบด้วย 2 หน้าหลัก:

| หน้า | ไฟล์ | วัตถุประสงค์ |
|---|---|---|
| **อัปโหลดสลิป** | `pages/SlipUpload.tsx` | แสดงออเดอร์ที่ต้องชำระ + อัปโหลด/แก้ไขสลิป |
| **สลิปทั้งหมด** | `pages/SlipAll.tsx` | ดูสลิปทั้งหมดในระบบ + กรอง/ค้นหา/preview/export |

---

## 2. SlipUpload — หน้าอัปโหลดสลิปโอนเงิน

### 2.1 Tabs (ช่องทางการชำระ)

| Tab | ค่า `activeTab` | คำอธิบาย |
|---|---|---|
| Transfer (โอนเงิน) | `Transfer` | ออเดอร์ที่ชำระด้วยการโอน |
| COD (เก็บเงินปลายทาง) | `COD` | ออเดอร์เก็บเงินปลายทาง |
| PayAfter (รับสินค้าก่อนโอน) | `PayAfter` | ออเดอร์รับของก่อนค่อยโอน |

### 2.2 ตารางออเดอร์

**API**: `Slip_DB/get_transfer_orders.php`

**Parameters**: `company_id`, `page`, `pageSize`, `payment_method` (= activeTab), filters, `exclude_order_status=Returned,Cancelled`

**คอลัมน์ตาราง**:
- วันที่สั่งซื้อ, วันที่ส่ง, รหัสคำสั่งซื้อ, ชื่อลูกค้า, เบอร์โทร, ยอดเงิน, สถานะ, ปุ่มเพิ่มสลิป

**ตัวกรอง** (6 ช่อง):
- รหัสคำสั่งซื้อ, ชื่อลูกค้า, เบอร์โทร, เลข Tracking, วันที่เริ่มต้น-สิ้นสุด
- สถานะสลิป: `no_slip` (ยังไม่มี) / `partial` (ไม่ครบยอด) / `all` (ทั้งหมด)

**Slip Status Filter** (client-side):
- `no_slip` → `slip_total <= 0`
- `partial` → `slip_total > 0` แต่ < `total_amount`
- `all` → แสดงทั้งหมด

### 2.3 Modal เพิ่มสลิป (`handleAddSlip`)

เมื่อกดปุ่ม "เพิ่มสลิป" → เปิด Modal ประกอบด้วย:

1. **ข้อมูลออเดอร์** — แสดง Order ID + ยอดเงิน
2. **เลือกบัญชีธนาคาร** — dropdown จาก `Bank_DB/get_bank_accounts.php`
3. **วันที่ + เวลาโอน** — DatePicker + time input (format: `YYYY-MM-DDTHH:MM`)
4. **อัปโหลดรูปสลิป** — เลือกได้หลายรูป (multi-file), แต่ละรูป:
   - แสดง preview + ชื่อไฟล์
   - ระบุจำนวนเงินแยกต่างหาก
   - รูปแรก default จำนวนเงิน = `total_amount - slip_total` (ยอดคงเหลือ)
   - รูปถูก process ด้วย `processImage()` (resize + WebP)
5. **ประวัติสลิปเก่า** — แสดงสลิปที่เคยอัปโหลดไว้ + ปุ่มแก้ไข/ดูรูป

### 2.4 Flow การบันทึกสลิป (`handleSlipSubmit`)

```
1. Validate: bank_account_id + transfer_date + slipItems.length > 0 + จำนวนเงินถูกต้อง
2. Loop แต่ละรูป:
   a. uploadSlipImageFile(orderId, file) → ได้ URL
   b. createOrderSlipWithPayment({ orderId, amount, bankAccountId, transferDate, url, companyId, uploadBy, uploadByName })
3. อัปเดต order: paymentStatus = "PendingVerification", amountPaid = 0
4. รีเฟรชรายการออเดอร์
```

### 2.5 แก้ไขสลิป (`handleUpdateSlip`)

- แก้ไข: จำนวนเงิน, บัญชีธนาคาร, วันที่โอน, รูปสลิป (เปลี่ยนรูปใหม่ได้)
- API: `updateOrderSlip({ id, amount, bankAccountId, transferDate, url?, companyId, updatedBy })`

### 2.6 API ที่ใช้

| API | การใช้งาน |
|---|---|
| `Slip_DB/get_transfer_orders.php` | ดึงออเดอร์ตาม payment_method + filters |
| `Bank_DB/get_bank_accounts.php` | ดึงบัญชีธนาคารของบริษัท |
| `Slip_DB/upload_slip_image.php` | อัปโหลดรูปสลิป (FormData) |
| `Slip_DB/insert_order_slip.php` | บันทึกข้อมูลสลิป |
| `Slip_DB/get_slip_history.php` | ดึงประวัติสลิปของออเดอร์ |
| `updateOrderSlip()` | แก้ไขสลิป |
| `updateOrder()` | อัปเดตสถานะการชำระ |

---

## 3. SlipAll — หน้าสลิปทั้งหมด

### 3.1 ภาพรวม

แสดงสลิปทั้งหมดในระบบ จัดกลุ่มตาม **Order ID** (OrderSlipGroup) — 1 ออเดอร์อาจมีหลายสลิป

### 3.2 ตัวกรอง (Server-Side)

| ตัวกรอง | ค่า |
|---|---|
| ค้นหา | ชื่อไฟล์, ลูกค้า, ผู้อัปโหลด |
| สถานะ | all / pending / preapproved / approved / rejected |
| ช่วงเวลา | all / today / week / month |
| ช่องทางชำระ | dropdown จาก `get_payment_methods.php` |

### 3.3 สถานะสลิป

| Status | แสดง | สี |
|---|---|---|
| `pending` | รอตรวจสอบ | เหลือง |
| `preapproved` | รอตรวจสอบจากบัญชี | น้ำเงิน |
| `approved` / `verified` | ยืนยันแล้ว | เขียว |
| `rejected` | ยกเลิก | แดง |

**Group Status Logic**: ถ้ามีสลิปใดเป็น `pending` → group = `pending`

### 3.4 คอลัมน์ตาราง

| คอลัมน์ | แสดง |
|---|---|
| รายการคำสั่งซื้อ | Order ID + thumbnail สลิปรูปแรก + badge จำนวนรูป |
| ลูกค้า | ชื่อลูกค้า |
| ช่องทางชำระ | paymentMethod |
| จำนวนเงิน | amount หรือ orderTotal |
| จำนวนรูป | จำนวนสลิปในกลุ่ม |
| สถานะ | badge สถานะ |
| วันที่อัปโหลดล่าสุด | latestUpload |
| การจัดการ | ปุ่ม "ดูรายละเอียด" |

### 3.5 Preview Modal

- **Image Gallery** — ดูรูปสลิปทีละรูป + ปุ่มเลื่อนซ้าย/ขวา + thumbnails
- **ข้อมูลสลิปปัจจุบัน** — ชื่อไฟล์, จำนวนเงิน, วันที่โอน, ธนาคาร, สถานะ, ผู้อัปโหลด, วันที่อัปโหลด
- **ข้อมูลคำสั่งซื้อ** — ชื่อลูกค้า, ยอดรวม

### 3.6 Export CSV

คอลัมน์: Order ID, ชื่อไฟล์, สถานะ, ลูกค้า, จำนวนเงิน, วันที่อัปโหลด, ผู้อัปโหลด

### 3.7 Role-Based Filtering

- **Backoffice / Finance** → เห็นทุกสลิป
- **อื่นๆ** → กรองตาม `user_id`, `role`, `team_id`

### 3.8 API ที่ใช้

| API | การใช้งาน |
|---|---|
| `Slip_DB/list_company_slips.php` | ดึงสลิปทั้งหมด (server-side filter + pagination) |
| `Slip_DB/get_payment_methods.php` | ดึง payment methods สำหรับ dropdown |

---

## 4. Data Types

### Order (SlipUpload)
```ts
{ id, order_date, delivery_date, total_amount, first_name, last_name, phone, full_name, payment_status, slip_total }
```

### PaymentSlip (SlipAll)
```ts
{ id, name, url?, status, uploadedBy?, customerName?, amount?, orderTotal?, orderId?, bankName?, bankNumber?, transferDate?, paymentMethod? }
```

### SlipHistory (SlipUpload Modal)
```ts
{ id, order_id, amount, bank_account_id, bank_name, bank_number, transfer_date, url, created_at }
```

### BankAccount
```ts
{ id, bank, bank_number, is_active, display_name }
```
