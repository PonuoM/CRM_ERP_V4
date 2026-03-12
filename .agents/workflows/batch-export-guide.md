---
description: คู่มืออธิบายการทำงาน Batch Process Export API (ดึงข้อมูล + อัปเดตสถานะ + อัปเดตลูกค้า)
---

# Batch Process Export API

**ไฟล์:** `api/Order_DB/batch_process_export.php`  
**Method:** `POST`  
**วัตถุประสงค์:** รวม fetch + status update ใน request เดียว สำหรับ export ออเดอร์เป็น CSV

> [!NOTE]
> **ไฟล์เก่า:** `pages/ManageOrdersPage.tsx` เป็นไฟล์ frontend ที่มี export flow ต้นฉบับ ก่อนจะเปลี่ยนมาใช้ batch API  
> Flow เดิม: `ManageOrdersPage` → `onProcessOrders` → `api/index.php PATCH /orders/{id}` (ทีละ order) → trigger BasketRoutingServiceV2

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

พร้อมเก็บ mapping `customerSaleDates[customer_id] = delivery_date` (fallback: order_date) สำหรับ Step 3  
ถ้า customer มีหลาย order ใน batch เดียวกัน → ใช้ delivery_date ล่าสุด

---

### Step 3 — อัปเดตข้อมูลลูกค้า (เฉพาะ targetStatus = 'Picking')

> [!IMPORTANT]
> **ไม่แตะ `assigned_to`** — ปล่อยให้ cron/basket routing จัดการ  
> Logic ตรงกับ `recordSale()` ใน `ownership_handler.php`

```sql
UPDATE customers SET 
    lifecycle_status = 'Old3Months',
    ownership_expires = {delivery_date + 90 days, max NOW+90},
    has_sold_before = 1,
    last_sale_date = {delivery_date},
    follow_up_count = 0,
    followup_bonus_remaining = 1
WHERE customer_id = ?
```

| คอลัม | ค่า | หมายเหตุ |
|--------|-----|----------|
| `lifecycle_status` | `'Old3Months'` | |
| `ownership_expires` | `delivery_date + 90 วัน` | cap ที่ max 90 วันจากวันนี้ |
| `has_sold_before` | `1` | |
| `last_sale_date` | `delivery_date` | fallback: `order_date` |
| `follow_up_count` | `0` | reset |
| `followup_bonus_remaining` | `1` | reset |
| `assigned_to` | ❌ ไม่แตะ | |

---

### Step 3.5 — Basket Routing V2 (หลัง commit)

> [!IMPORTANT]
> เรียก **หลัง commit** เพราะ `BasketRoutingServiceV2->transitionTo()` มี transaction ของตัวเอง  
> ตรงกับ pattern ใน `api/index.php` lines 5869-5899

```php
$router = new BasketRoutingServiceV2($pdo);
foreach ($ordersById as $orderId => $order) {
    $router->handleOrderStatusChange($orderId, $targetStatus, $actorId);
}
```

BasketRoutingServiceV2 จะจัดการย้ายตะกร้าลูกค้าตาม business rules:
- **Picking + Basket 51 + Telesale ขาย** → 39 (ขายได้)
- **Picking + Basket 51 + ไม่มี Telesale** → 38 (ขายไม่ได้)
- **Picking + Basket 53** → 52 (New Customer Distribution)
- **Picking + มี owner + Telesale** → 39
- **Picking + มี owner + Admin** → 51
- **Picking + ไม่มี owner + Telesale** → 39 + assign owner
- **Picking + ไม่มี owner + Admin** → 52

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
```
