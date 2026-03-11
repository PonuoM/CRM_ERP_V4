---
description: คู่มืออธิบายการทำงาน Batch Process Export API (ดึงข้อมูล + อัปเดตสถานะ + อัปเดตลูกค้า)
---

# Batch Process Export API

**ไฟล์:** `api/Order_DB/batch_process_export.php`  
**Method:** `POST`  
**วัตถุประสงค์:** รวม fetch + status update ใน request เดียว สำหรับ export ออเดอร์เป็น CSV

---

## Request / Response

### Request Body
```json
{
  "orderIds": ["250101-00001", "250101-00002"],
  "targetStatus": "Picking",
  "actorId": 123,
  "actorName": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderIds` | string[] | ✅ | รายการ order ID ที่ต้องการ export (สูงสุด 500) |
| `targetStatus` | string | ❌ | สถานะใหม่ (default: `Picking`) |
| `actorId` | number | ❌ | user ID ของคนที่กด export |
| `actorName` | string | ❌ | ชื่อคนกด (default: `Unknown User`) |

### Response
```json
{
  "success": true,
  "processed": 24,
  "customerUpdates": 20,
  "orders": [{ "...full order data..." }]
}
```

---

## ขั้นตอนการทำงาน (5 Steps)

### Step 1 — ดึงข้อมูลออเดอร์แบบ Bulk

ดึง 4 ชุดข้อมูลพร้อมกัน:

| Query | ตาราง | JOIN | ข้อมูล |
|-------|-------|------|--------|
| 1. Orders | `orders` | `LEFT JOIN customers` | ข้อมูลออเดอร์ + ที่อยู่ลูกค้า |
| 1a. Items | `order_items` | `LEFT JOIN products` | รายการสินค้า (ชื่อ, SKU, shop) |
| 1b. Boxes | `order_boxes` | — | กล่องพัสดุ |
| 1c. Tracking | `order_tracking_numbers` | — | เลข tracking |

ผลลัพธ์จะ index ด้วย `order.id` → `ordersById[id]`

---

### Step 2 — อัปเดตสถานะออเดอร์

```sql
UPDATE orders SET order_status = {targetStatus} WHERE id = {orderId}
```

พร้อมเก็บ mapping `customerUpdates[customer_id] = creator_id` สำหรับ Step 3

---

### Step 3 — อัปเดตข้อมูลลูกค้า (เฉพาะ targetStatus = 'Picking')

> [!IMPORTANT]
> `assigned_to` อัปเดตเฉพาะเมื่อผู้ขาย (creator) เป็น **Telesale** (`role_id IN (6, 7)`)

**ขั้นตอน:**
1. ดึง `creator_id` ทั้งหมด → query `users WHERE role_id IN (6, 7)` เพื่อดูว่าใครเป็น Telesale
2. แบ่งเป็น 2 กรณี:

| ผู้ขาย | `lifecycle_status` | `assigned_to` | `ownership_expires` | `followup_bonus_remaining` |
|--------|:------------------:|:-------------:|:-------------------:|:--------------------------:|
| **Telesale** (role 6, 7) | → `Old3Months` | → `creator_id` | → `+90 วัน` | → `1` |
| **อื่น ๆ** | → `Old3Months` | ❌ **ไม่แตะ** | → `+90 วัน` | → `1` |

**เหตุผล:** ป้องกันไม่ให้ลูกค้าหลุดจากระบบแจกงานเมื่อผู้ขายไม่ใช่ Telesale (เช่น Admin หรือ Packer สร้าง order)

---

### Step 4 — บันทึก Activity Log

```sql
INSERT INTO activities (customer_id, type, description, actor_name, timestamp)
VALUES ({customer_id}, 'OrderStatusChanged', 'อัปเดตสถานะ...', {actorName}, NOW())
```

- Bulk insert ทีเดียวทุก order
- ทำเฉพาะเมื่อมี `actorId`

---

### Step 5 — Commit & Return

- `commit()` transaction
- ส่งคืน full order data (รวม items, boxes, tracking) สำหรับ Frontend สร้าง CSV

---

## Error Handling

- ทุกอย่างอยู่ใน `try/catch` + `beginTransaction()`
- ถ้า error → `rollBack()` + return 500
- ถ้า `orderIds` ว่าง → return success ทันที (processed: 0)
- ถ้าไม่พบ order → `rollBack()` + return 404

---

## ตารางที่เกี่ยวข้อง

```
orders ─────────┬──→ order_items ──→ products
                ├──→ order_boxes
                ├──→ order_tracking_numbers
                └──→ customers
                     └──→ users (assigned_to, creator_id)
```
