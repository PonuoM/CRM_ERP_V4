# CODManagementPage Component Guide

## Overview
`CODManagementPage.tsx` เป็นหน้าจัดการข้อมูล COD (Cash on Delivery) สำหรับนำเข้าข้อมูลการเก็บเงินปลายทางจากขนส่ง ตรวจสอบความถูกต้องกับ Order ในระบบ แล้วบันทึกเป็นเอกสาร COD

## Props Interface
```typescript
interface CODManagementPageProps {
  user: User;
  customers: any[];
  users: User[];
  onOrdersPaidUpdate?: (updates: Record<string, { amountPaid: number; paymentStatus: PaymentStatus }>) => void;
}
```

## Key Features

### 1. การนำเข้าข้อมูล (Data Input)
- **Paste จาก Excel**: วางข้อมูล 2 คอลัมน์ (Tracking Number, COD Amount) ตรงลงในตาราง — ตัดด้วย Tab หรือ Comma
- **อัปโหลด CSV**: รองรับไฟล์ `.csv` ข้าม header row แรก
- **กรอกมือ**: พิมพ์ทีละแถว + ปุ่ม "เพิ่มแถว"
- เริ่มต้นแสดง 15 แถวว่าง

### 2. Import Mode
| โหมด | คำอธิบาย | Validation |
|------|----------|-----------|
| **สร้างเอกสารใหม่** (`new`) | กรอกเลขที่เอกสาร + วันที่ + บัญชีธนาคาร | `POST cod_documents` |
| **เพิ่มในเอกสารเดิม** (`existing`) | เลือกจาก dropdown เอกสาร pending ที่ยังไม่จับคู่กับ Statement | `PATCH cod_documents/{id}` |

### 3. Server-Side Validation (`handleValidate`)
กด "ตรวจสอบข้อมูล" → เรียก 2 API:

1. **`POST validate_cod_tracking`** → จับคู่ tracking number กับ `order_boxes` ในระบบ
2. **`POST Order_DB/cod_batch_check.php`** → เช็คว่า tracking นี้ถูกนำเข้า `cod_records` แล้วหรือยัง

#### Validation Status

| Status | สี | ความหมาย |
|--------|-----|---------|
| `matched` | 🟢 เขียว | ยอดตรงกับ Order (หลังหัก slip + COD ที่เก็บแล้ว) |
| `unmatched` | 🟡 เหลือง | พบ Order แต่ยอดไม่ตรง พร้อมแสดงส่วนต่าง |
| `pending` | 🟠 ส้ม | ไม่พบ Tracking ในระบบ หรือยอดไม่ valid |
| `returned` | 🔴 แดง | ถูก mark เป็น "ตีกลับ" หรือซ้ำในเอกสารอื่น (เก็บครบแล้ว) |
| `unchecked` | ⬜ เทา | ยังไม่ได้ตรวจสอบ |

#### สูตรเปรียบเทียบยอด (Single Tracking)
```
remainingExpected = max(0, expectedAmount - slipAmount - boxCollectedAmount)
difference = codAmount - remainingExpected
matched = |difference| < 0.01
```

#### Multi-Tracking Box (กล่องเดียวหลาย tracking)
- Pass แรก: mark เป็น `pending` เก็บ `boxExpectedAmount`แต่ละ tracking
- Pass ที่ 2: Group ตาม `orderId` → รวม codAmount ทั้ง group เทียบกับ `boxExpectedAmount` หลังหัก slip + COD ที่เก็บแล้ว

#### Duplicate Detection (ซ้ำแล้ว)
- ถ้า tracking มีใน `cod_records` แล้ว:
  - **เอกสารเดียวกัน** → แสดง "ซ้ำแล้ว ฿xxx"
  - **เอกสารอื่น + เก็บครบ** → status `returned` (block)
  - **เอกสารอื่น + ยังค้าง** → status `matched` (import ได้ เติมยอดที่เหลือ)

### 4. Force Import (ข้าม)
- สำหรับ row ที่ `pending` หรือ `unmatched` สามารถติ๊ก checkbox "ข้าม" เพื่อบังคับนำเข้า
- บันทึกใน `cod_records` ด้วย `status = 'forced'` แต่ **ไม่อัพเดท Order**
- มี check-all toggle สำหรับเลือก/ยกเลิกทั้งหมดที่แสดงอยู่

### 5. การนำเข้า (`handleImport`)
**ขั้นตอน:**
1. รวม row ที่ `matched` / `unmatched` / (`pending` + forceImport)
2. De-duplicate ตาม tracking number (ตัดซ้ำภายในไฟล์)
3. สร้างหรือเพิ่มเอกสาร COD ผ่าน API
4. **Batch update orders** → `POST Order_DB/cod_batch_update_orders.php`
   - คำนวณ `amountPaid` = SUM(cod_records.cod_amount) ของ order
   - ถ้า `amountPaid > 0` → `paymentStatus = 'PreApproved'`
   - Fallback: sequential update ทีละ order ถ้า batch ล้มเหลว
5. เรียก `onOrdersPaidUpdate` callback ส่งผลกลับ parent

### 6. Returned & Manual Status (ตีกลับ/สถานะพิเศษ)
สำหรับ row ที่ `unmatched`:

| Action | ผลลัพธ์ |
|--------|---------|
| **ตีกลับ (ชำรุด/ปกติ)** | `handleMarkReturned` → mark row เป็น `returned` |
| **Approve ตีกลับ** | `patchOrder` → `orderStatus = 'Returned'` |
| **Manual Status** (ศูนย์หาย / ไม่สำเร็จ / หายศูนย์) | dropdown สำหรับ tracking ที่ไม่พบ order |
| **Approve Manual** | `patchOrder` → `orderStatus = 'Cancelled'` |

### 7. Document History (ประวัติเอกสาร)
- Modal แสดงรายการเอกสาร COD ทั้งหมดของบริษัท
- **Filter**: วันที่, ธนาคาร
- **Pagination**: 15 รายการ/หน้า
- **Expand**: คลิกเอกสารเพื่อดูรายการ `cod_records` ภายใน (`GET cod_documents/{id}?includeItems=true`)
- **Delete**: ลบได้เฉพาะเอกสารที่ยังไม่ผูกกับ Statement (`is_referenced = 0`)
- **Status Badge**: `verified` = ยืนยันแล้ว, `pending` = รอดำเนินการ
- **Shield Icon**: 🛡️ เขียว = ผูก Statement แล้ว, 🛡️ เทา = ยังไม่ผูก

## APIs ที่ใช้

| API | Method | ใช้ตอน |
|-----|--------|--------|
| `bank_accounts?companyId` | GET | โหลดบัญชีธนาคาร |
| `validate_cod_tracking` | POST | ตรวจสอบ tracking กับ orders |
| `Order_DB/cod_batch_check.php` | POST | เช็ค cod_records ที่มีอยู่ |
| `cod_documents` | GET | โหลดเอกสาร pending / history |
| `cod_documents` | POST | สร้างเอกสารใหม่ + items |
| `cod_documents/{id}` | PATCH | เพิ่ม items ในเอกสารเดิม |
| `cod_documents/{id}` | DELETE | ลบเอกสาร |
| `cod_documents/{id}?includeItems` | GET | ดูรายการ cod_records ในเอกสาร |
| `Order_DB/cod_batch_update_orders.php` | POST | Batch update orders (amountPaid, paymentStatus) |
| `orders/{id}` | PUT | Fallback: update order ทีละตัว |

## Database Tables

| ตาราง | บทบาท |
|-------|-------|
| `cod_documents` | เอกสาร COD (เลขที่, วันที่, ธนาคาร, ยอดรวม) |
| `cod_records` | รายการ COD แต่ละ tracking (tracking_number, cod_amount, order_id, status) |
| `order_boxes` | ข้อมูลกล่อง/tracking ของ order |
| `order_slips` | สลิปชำระเงินของ order |
| `orders` | ออเดอร์ (amount_paid, payment_status) |

## Data Flow Summary
```
Excel/CSV → Paste/Upload → ตารางแถว
                              ↓
                    กด "ตรวจสอบข้อมูล"
                              ↓
              API validate_cod_tracking
              + cod_batch_check.php
                              ↓
                     แสดงผล matched/unmatched/pending
                              ↓
                    กด "สร้างเอกสารใหม่" / "เพิ่มในเอกสาร"
                              ↓
              POST/PATCH cod_documents (สร้าง cod_records)
                              ↓
              POST cod_batch_update_orders.php
              (อัพเดท orders.amount_paid + payment_status)
```
