---
description: คู่มืออธิบายการทำงานระบบยกเลิกออเดอร์ (Order Cancellation & Classification System)
---

# Order Cancellation System Guide

## ภาพรวม

ระบบยกเลิกออเดอร์ประกอบด้วย 3 ส่วนหลัก:

1. **การยกเลิกออเดอร์** — กดยกเลิกจากตารางออเดอร์ หรือเปลี่ยนสถานะเป็น Cancelled ใน modal
2. **การจัดประเภทการยกเลิก** — ระบุเหตุผลที่ออเดอร์ถูกยกเลิก (เช่น ยกเลิกก่อนเข้าระบบ, หลังเข้าระบบ, ลูกค้าปฏิเสธ)
3. **การตั้งค่าประเภทการยกเลิก** — จัดการ CRUD ประเภท + ตั้งค่าเริ่มต้น

## สถาปัตยกรรม

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                                │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │ OrderTable      │   │ OrderManagement  │   │ Cancelled    │  │
│  │ ปุ่มยกเลิก      │──▶│ Modal            │   │ Classification│  │
│  │ (CancelConfirm  │   │ (เปลี่ยนสถานะ +   │   │ Page          │  │
│  │  Modal)          │   │  ระบุประเภท)      │   │ (จัดประเภท bulk)│  │
│  └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘  │
│           │                     │                     │          │
│           ▼                     ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ services/api.ts                                              │ │
│  │ confirmCancellation()  getOrderCancellation()                │ │
│  │ getCancellationTypes() analyzeCancelledOrders()              │ │
│  │ manageCancellationTypes() setDefaultCancellationType()       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Backend (PHP API)                                               │
│                                                                  │
│  Orders/confirm_cancellation.php     (POST - upsert ประเภท)      │
│  Orders/get_order_cancellation.php   (GET - ดึงประเภทรายตัว)     │
│  Orders/get_order_cancellations_batch.php (GET - ดึง batch)      │
│  Orders/get_cancellation_types.php   (GET - dropdown ประเภท)     │
│  Orders/manage_cancellation_types.php (CRUD + default setting)  │
│  Orders/analyze_cancelled_orders.php (GET - วิเคราะห์ออเดอร์เก่า) │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Database (MySQL)                                                │
│                                                                  │
│  cancellation_types         (master ประเภท)                      │
│  order_cancellations        (mapping: order → type + notes)      │
│  app_settings               (ค่า default_cancellation_type_id)   │
└──────────────────────────────────────────────────────────────────┘
```

## Database Schema

### ตาราง `cancellation_types` (Master)
- **Migration:** `api/Database/20260310_cancellation_types.sql`

| Column | Type | Description |
|---|---|---|
| id | INT PK | รหัสประเภท |
| label | VARCHAR(100) | ชื่อประเภท (เช่น "ยกเลิกก่อนเข้าระบบ") |
| description | TEXT | คำอธิบายเพิ่มเติม |
| sort_order | INT | ลำดับการแสดงใน dropdown |
| is_active | TINYINT(1) | เปิด/ปิดการใช้งาน |

**ข้อมูลเริ่มต้น:**
1. ยกเลิกก่อนเข้าระบบ — ลูกค้าสั่งใหม่ ยกเลิกออเดอร์เก่า
2. ยกเลิกหลังเข้าระบบ — ไม่มีออเดอร์ทดแทน
3. ลูกค้าปฏิเสธการรับสินค้า — ปฏิเสธหลังจัดส่ง

### ตาราง `order_cancellations` (Mapping)

| Column | Type | Description |
|---|---|---|
| id | INT PK | - |
| order_id | VARCHAR(32) UNIQUE | FK → orders.id |
| cancellation_type_id | INT | FK → cancellation_types.id |
| notes | TEXT | หมายเหตุ (ไม่บังคับ) |
| classified_by | INT | FK → users.id (ผู้ระบุประเภท) |
| classified_at | TIMESTAMP | วันเวลาที่ระบุ |

### ตาราง `app_settings` (ค่าเริ่มต้น)
- สร้างอัตโนมัติ (CREATE TABLE IF NOT EXISTS) ใน `manage_cancellation_types.php`
- Key: `default_cancellation_type_id` → Value: id ของประเภทเริ่มต้น

## ไฟล์ที่เกี่ยวข้อง

### Frontend

| ไฟล์ | หน้าที่ |
|---|---|
| `components/CancelConfirmModal.tsx` | Modal ยืนยันการยกเลิกจากปุ่มยกเลิกในตาราง (ใช้ประเภท default, lock dropdown) |
| `components/OrderManagementModal.tsx` | Modal จัดการออเดอร์ — เปลี่ยนสถานะเป็น Cancelled + เลือกประเภท + หมายเหตุ |
| `components/OrderTable.tsx` | ตารางออเดอร์ — แสดง pill สถานะยกเลิก + ประเภท + หมายเหตุ |
| `pages/CancelledClassificationPage.tsx` | หน้าจัดประเภทออเดอร์ยกเลิก (bulk) สำหรับออเดอร์ระบบเก่า |
| `pages/CancellationSettingsPage.tsx` | หน้าตั้งค่า CRUD ประเภทยกเลิก + กำหนดค่าเริ่มต้น |
| `services/api.ts` | ฟังก์ชัน API ที่เกี่ยวข้อง (ดู section ถัดไป) |

### Backend

| ไฟล์ | Method | หน้าที่ |
|---|---|---|
| `api/Orders/confirm_cancellation.php` | POST | Upsert ประเภทยกเลิกลง `order_cancellations` (รองรับ batch) |
| `api/Orders/get_order_cancellation.php` | GET | ดึงข้อมูลประเภทยกเลิกของ order 1 ตัว |
| `api/Orders/get_order_cancellations_batch.php` | GET | ดึงข้อมูลประเภทยกเลิก batch (สำหรับตาราง) |
| `api/Orders/get_cancellation_types.php` | GET | ดึง dropdown ประเภทยกเลิก (is_active=1) |
| `api/Orders/manage_cancellation_types.php` | CRUD | จัดการประเภท + ตั้งค่า default + soft delete/restore |
| `api/Orders/analyze_cancelled_orders.php` | GET | วิเคราะห์ออเดอร์ยกเลิกที่ยังไม่จัดประเภท + แนะนำประเภท |

### SQL Migration

| ไฟล์ | คำอธิบาย |
|---|---|
| `api/Database/20260310_cancellation_types.sql` | สร้าง `cancellation_types` + `order_cancellations` + seed data |

### Sidebar

- เมนู "จัดประเภทยกเลิก" → key: `nav.cancelled_classification`
- เมนู "ตั้งค่าการยกเลิก" → key: `nav.cancellation_settings`
- อยู่ใต้กลุ่ม "คำสั่งซื้อและลูกค้า" ใน `components/Sidebar.tsx` (line ~243-244)

## Flow การทำงาน

### Flow 1: ยกเลิกจากปุ่ม "ยกเลิก" ในตาราง (OrderTable)

```
1. User คลิกปุ่ม "ยกเลิก" ที่ OrderTable
2. App.tsx → setcancellingOrderId(orderId) → เปิด CancelConfirmModal
3. CancelConfirmModal แสดง:
   - ประเภทเริ่มต้น (locked, อ่านอย่างเดียว)
   - ช่องหมายเหตุ (ไม่บังคับ)
4. User กด "ยืนยันยกเลิกคำสั่งซื้อ"
5. App.tsx → handleConfirmCancel():
   a. apiPatchOrder(orderId, { order_status: 'Cancelled' })
   b. confirmCancellation([{ order_id, cancellation_type_id, notes }])
   c. อัปเดต state ในหน้า
```

### Flow 2: เปลี่ยนสถานะเป็น Cancelled ใน OrderManagementModal

```
1. User เปิด OrderManagementModal (จากหน้า Orders หรือ Manage Orders)
2. เปลี่ยน dropdown สถานะออเดอร์ เป็น "ยกเลิก"
3. UI แสดงส่วนเลือกประเภทยกเลิก + หมายเหตุ
4. Validation: ต้องเลือกประเภท (ไม่ใช่ "ยังไม่ระบุ") ก่อนกดบันทึก
5. handleSave():
   a. ตรวจสอบ: ถ้า status=Cancelled แต่ไม่ได้เลือกประเภท → alert + return
   b. ถ้า status=Cancelled + มีประเภท → confirmCancellation()
   c. onSave(updatedOrder) → API patch
```

### Flow 3: จัดประเภท bulk (CancelledClassificationPage)

```
1. หน้าโหลดข้อมูลทั้งหมดจาก analyzeCancelledOrders() (ดึงครั้งเดียว 5000 records)
2. Backend วิเคราะห์ + แนะนำประเภทอัตโนมัติ:
   - มีออเดอร์ที่เกี่ยวข้อง (ลูกค้าเดียวกัน ±7 วัน) → "ยกเลิกก่อนเข้าระบบ"
   - ไม่มีออเดอร์ที่เกี่ยวข้อง → "ยกเลิกหลังเข้าระบบ"
3. กำหนดค่า confidence: high (≤1 วัน) / medium (≤3 วัน) / low (>3 วัน หรือไม่มี related)
4. Client-side features:
   - Tab: "แนะนำ (ความมั่นใจสูง)" / "ทั้งหมด"
   - Sort by: คลิก header คอลัมน์
   - PageSize selector: 10/20/50/100 ต่อหน้า
   - Search: Order ID, ชื่อลูกค้า, เบอร์โทร
5. User เลือก checkbox + เลือกประเภท → กด "ยืนยัน"
6. confirmCancellation() → upsert ข้อมูลลง order_cancellations
```

### Flow 4: ตั้งค่าประเภทยกเลิก (CancellationSettingsPage)

```
1. CRUD ประเภทยกเลิก (เพิ่ม/แก้ไข/ลบ/กู้คืน)
2. ตั้งค่าประเภทเริ่มต้น (default) → ใช้สำหรับ CancelConfirmModal
3. ลำดับ sort_order → กำหนดลำดับใน dropdown
4. Soft delete: is_active = 0 → ซ่อนจาก dropdown แต่ยังอยู่ในระบบ
```

## API Functions (services/api.ts)

```typescript
// ดึง dropdown ประเภทยกเลิก (is_active=1)
getCancellationTypes(): Promise<{ data: CancellationType[] }>

// วิเคราะห์ออเดอร์ยกเลิกที่ยังไม่จัดประเภท
analyzeCancelledOrders(companyId: number, page: number, pageSize: number)

// Upsert ประเภทยกเลิก (batch)
confirmCancellation(items: { order_id, cancellation_type_id, notes? }[], classifiedBy)

// CRUD ประเภทยกเลิก + ตั้ง default
manageCancellationTypes(method: 'GET'|'POST'|'PUT'|'DELETE', data?)
setDefaultCancellationType(defaultTypeId: number)

// ดึงประเภทยกเลิกของ order เดี่ยว
getOrderCancellation(orderId: string)

// ดึงประเภทยกเลิก batch (ใช้ใน OrderTable)
getOrderCancellationsBatch(orderIds: string[])
```

## การแสดงผลในตาราง (OrderTable)

- ออเดอร์สถานะ "ยกเลิก" แสดง **pill badge** สีแดง
- ถ้ามีข้อมูลใน `order_cancellations`:
  - แสดง label ประเภท (เช่น "ยกเลิกก่อนเข้าระบบ") + หมายเหตุถ้ามี
- ถ้ายังไม่มีข้อมูล (ออเดอร์เก่า):
  - ใน OrderManagementModal แสดง option "ยังไม่ระบุ" ใน dropdown

## Validation Rules

1. **เปลี่ยนสถานะเป็น Cancelled:** ต้องเลือกประเภทยกเลิก (ไม่ใช่ "ยังไม่ระบุ") ก่อนกดบันทึก
2. **กดปุ่มยกเลิก:** ใช้ประเภท default อัตโนมัติ (lock, ไม่ให้เปลี่ยน)
3. **COD Validation:** ตรวจยอดเก็บเงินตรงกับยอดออเดอร์ก่อนบันทึก
4. **Manager Override:** ผู้ใช้ permission=manager สามารถเปลี่ยนสถานะเป็นสถานะใดก็ได้ใน dropdown

## Deploy

1. รัน SQL migration: `api/Database/20260310_cancellation_types.sql`
2. ตรวจสอบว่าเมนู sidebar เปิดใช้งานสำหรับ role ที่เกี่ยวข้อง
3. ตั้งค่าประเภทเริ่มต้นผ่านหน้า "ตั้งค่าการยกเลิก"
