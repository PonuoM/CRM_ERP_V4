---
description: คู่มืออธิบายการทำงานหน้าจัดการโปรโมชั่น (Promotions Page)
---

# จัดการโปรโมชั่น (Promotions Page)

## ภาพรวม

หน้าจัดการโปรโมชั่น ใช้สำหรับสร้าง/แก้ไข/ปิดใช้งานโปรโมชั่นสินค้า โปรโมชั่นคือชุดสินค้าที่กำหนดจำนวน + ราคาพิเศษ + ของแถมไว้ล่วงหน้า เพื่อให้ Telesale เลือกใช้ตอนสร้างออเดอร์

**คุณสมบัติหลัก:**
- สร้างโปรโมชั่นใหม่พร้อมกำหนดสินค้า ระยะเวลา และสถานะ
- ดูรายการโปรโมชั่นที่ใช้งาน (Active) + ที่หมดอายุ/ปิด (History)
- แก้ไขโปรโมชั่นผ่าน modal (เมื่อยังไม่มีออเดอร์อ้างอิง)
- เปิด/ปิดสถานะโปรโมชั่น
- ป้องกันแก้ไข/ลบโปรโมชั่นที่มีออเดอร์อ้างอิงแล้ว (🔒 ใช้งานแล้ว)

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|-------|
| `pages/PromotionsPage.tsx` | Layout หลัก — จัดการ 3 view + โหลดข้อมูล |
| `pages/ActivePromotionsPage.tsx` | แสดงโปรโมชั่นที่กำลังใช้งาน (card grid) |
| `pages/PromotionHistoryPage.tsx` | ตารางโปรโมชั่นที่หมดอายุ/ปิดใช้งาน |
| `pages/CreatePromotionPage.tsx` | ฟอร์มสร้างโปรโมชั่นใหม่ |
| `components/PromotionModal.tsx` | Modal แก้ไขโปรโมชั่น |
| `types.ts` | `Promotion`, `PromotionItem`, `Product` interfaces |
| `services/api.ts` | API functions: `listPromotions`, `createPromotion`, `updatePromotion`, `deletePromotion` |

---

## สถาปัตยกรรม

```
PromotionsPage (Layout)
├── state: promotions[], products[], currentView
├── loadData → Promise.all(listPromotions, listProducts)
├── refreshPromotions → listPromotions
├── isPromotionTrulyActive(p) → active && !expired
│
├── view = 'active'
│   └── ActivePromotionsPage
│       ├── Grid cards (responsive 1→2→3 cols)
│       ├── Dropdown menu (edit / toggle)
│       ├── checkPromotionUsage(id) → apiFetch(orders?promotion_id=X)
│       └── PromotionModal (edit)
│
├── view = 'history'
│   └── PromotionHistoryPage
│       ├── ตาราง (ชื่อ, รหัส, ระยะเวลา, สินค้า, สถานะ, การจัดการ)
│       └── ปุ่มเปิดใช้งาน (reactivate)
│
└── view = 'create'
    └── CreatePromotionPage
        ├── ฟอร์ม: ชื่อ, รหัส (SKU), รายละเอียด, วันเริ่ม/สิ้นสุด, active
        ├── เพิ่มสินค้า: เลือก product, จำนวน, ราคาพิเศษ, ของแถม
        └── Submit → POST promotions → onSuccess → switch to 'active'
```

---

## Data Types

### `Promotion`

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `id` | number | PK |
| `sku` | string? | รหัสโปรโมชั่น |
| `name` | string | ชื่อโปรโมชั่น |
| `description` | string? | รายละเอียด |
| `companyId` | number | บริษัท |
| `active` | boolean \| number | สถานะ (รองรับทั้ง bool/number จาก API) |
| `startDate` / `start_date` | string? | วันเริ่มต้น |
| `endDate` / `end_date` | string? | วันสิ้นสุด |
| `items` | PromotionItem[] | สินค้าในโปรโมชั่น |

### `PromotionItem`

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `id` | number | PK |
| `productId` / `product_id` | number | FK → products.id |
| `quantity` | number | จำนวน |
| `isFreebie` / `is_freebie` | boolean | ของแถมหรือไม่ |
| `priceOverride` / `price_override` | number? | ราคาพิเศษ (ถ้ามี) |
| `product_name` | string? | ชื่อสินค้า (joined) |

---

## การแบ่ง Active / History

```
Active = promotion.active === true && ไม่หมดอายุ
History = !active || หมดอายุ (end_date < วันนี้)
```

**กฎ expiry:**
- ถ้า `end_date` เป็น null หรือ `'0000-00-00'` → **ไม่มีวันหมดอายุ** (ถือว่า active ตลอด)
- ถ้ามี `end_date` → เทียบกับวันปัจจุบัน (ปัด end_date เป็น 23:59:59)

---

## ฟีเจอร์หลัก

### 1. สร้างโปรโมชั่น (CreatePromotionPage)

**ฟอร์ม:**
- ชื่อโปรโมชั่น * (required)
- รหัส SKU
- รายละเอียด (textarea)
- วันเริ่ม / วันสิ้นสุด (date picker)
- เปิดใช้งานทันที (checkbox, default: true)

**เพิ่มสินค้า:**
- เลือกจาก dropdown (แสดงชื่อ + stock คงเหลือ)
- กำหนดจำนวน, ราคาพิเศษ, เป็นของแถมหรือไม่
- กด "เพิ่มสินค้า" → append เข้าตาราง
- แต่ละ item ลบได้

**Submit:** POST `promotions` → `onSuccess()` → refreshPromotions + switch ไปแท็บ Active

### 2. โปรโมชั่นที่ใช้งาน (ActivePromotionsPage)

**แสดงผล:**
- Grid cards (1/2/3 cols ตาม breakpoint)
- แต่ละ card: ชื่อ, badge 🔒 (ถ้ามีออเดอร์อ้างอิง), SKU, รายละเอียด, ระยะเวลา, สินค้า 3 รายการแรก

**Dropdown menu (三):**

| Action | เงื่อนไข | API |
|--------|----------|-----|
| **แก้ไข** | ห้ามถ้ามีออเดอร์อ้างอิง (🔒) | เปิด PromotionModal |
| **ปิดใช้งาน** | ทำได้เสมอ | PUT `promotions/{id}` `{ active: 0 }` |

**Usage check:**
- ตอน mount → วนลูปเรียก `apiFetch('orders?promotion_id=X')` ทุก promotion
- ผลลัพธ์เก็บใน `Set<number>` → ใช้ badge 🔒 + disable ปุ่มแก้ไข

### 3. ประวัติโปรโมชั่น (PromotionHistoryPage)

**ตาราง:**
- ชื่อ, รหัส SKU, ระยะเวลา, สินค้า (2 รายการแรก), สถานะ, การจัดการ

**สถานะ:**

| สถานะ | เงื่อนไข | สี |
|-------|----------|-----|
| หมดอายุ | `end_date < now` | 🔴 แดง |
| ปิดใช้งาน | `active = false` (ยังไม่หมดอายุ) | ⚪ เทา |
| ใช้งาน | `active = true` + ไม่หมดอายุ | 🟢 เขียว |

**Actions:**
- **หมดอายุ** → แสดง "หมดอายุแล้ว" (disabled)
- **ปิดใช้งาน** → ปุ่ม "เปิดใช้งาน" → PUT `promotions/{id}` `{ active: 1 }`
- **ใช้งาน** → แสดง "ใช้งานอยู่" (badge)

---

## API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `promotions?companyId=X` | ดึงรายการโปรโมชั่นทั้งหมด |
| POST | `promotions` | สร้างโปรโมชั่นใหม่ |
| PUT | `promotions/{id}` | อัปเดตโปรโมชั่น (rename, active toggle, etc.) |
| DELETE | `promotions/{id}` | ลบโปรโมชั่น |
| GET | `orders?promotion_id=X` | เช็คว่ามีออเดอร์อ้างอิงหรือไม่ |
| GET | `products?companyId=X` | ดึงรายการสินค้า (สำหรับ dropdown) |

### Create promotion payload:
```json
{
  "name": "แพ็คสุดคุ้ม",
  "sku": "PROMO-001",
  "description": "ซื้อ 2 แถม 1",
  "company_id": 1,
  "active": true,
  "start_date": "2026-03-01",
  "end_date": "2026-03-31",
  "items": [
    { "productId": 5, "quantity": 2, "isFreebie": false, "priceOverride": 990 },
    { "productId": 8, "quantity": 1, "isFreebie": true }
  ]
}
```

---

## การคำนวณ net_total ของ order_items ที่อยู่ใต้โปรโมชั่น

### สูตร
```
child order_items.net_total = promotion_items.price_override × parent order_items.quantity
```

### Flow
1. **Frontend** (3 จุด: `OrderManagementModal.tsx`, `CreateOrderPage.tsx` main + upsell)
   - Child item ส่ง `pricePerUnit` = ราคาสินค้าปกติ (แสดงผล)
   - `priceOverride` อาจมีหรือไม่มีใน payload (ปัจจุบันหน้าบ้านไม่ส่ง)
2. **Backend** (`api/index.php` Phase 3 child insert, ทั้ง POST และ PUT)
   - ถ้า payload มี `priceOverride` → ใช้ค่านั้น
   - ถ้าไม่มี → **auto-lookup** จาก `promotion_items` table ด้วย `promotion_id` + `product_id`
   - สูตร: `$netTotal = $overridePrice * $parentQty`
   - ถ้าหาไม่เจอเลย (ทั้ง payload และ DB) → fallback เดิม `pricePerUnit × qty - discount`
3. **สินค้าธรรมดา** (ไม่อยู่ใต้โปรโมชั่น) → ไม่มี `priceOverride` → ใช้ logic เดิมเสมอ

### ตัวอย่าง (promotion_id=15, parent qty=1)
| product_id | qty | price_override | net_total |
|------------|-----|---------------|----------|
| 141 | 10 | 100 | 100 |
| 143 | 10 | 300 | 300 |
| **Parent** | **1** | - | **400** |

### Quantity Scaling

- `originalQuantity` = จำนวนต่อ 1 ชุดโปรโมชั่น (เก็บ frontend เท่านั้น, ไม่มีใน DB)
- เมื่อเปลี่ยน parent qty → `child.qty = originalQuantity × parentQty`
- DB-loaded items ไม่มี `originalQuantity` → derive จาก `qty / oldParentQty`

---

## การแสดงผลสินค้าโปรโมชั่นในออเดอร์

| Component | Feature |
|-----------|----------|
| `OrderManagementModal.tsx` | Collapse/expand, edit qty, CornerDownRight, ChevronDown/Right |
| `OrderDetailModal.tsx` | Collapse/expand (read-only), CornerDownRight, smaller text, 'เซ็ต' badge |
| `CreateOrderPage.tsx` | เลือกผ่าน `ProductSelectorModal` |
| `ProductSelectorModal.tsx` | Tab โปรโมชั่น — filter: `active && !expired(end_date) && searchTerm` |

> **Note:** tab 'โปรโมชั่น/เซ็ตสินค้า' ที่เคยอยู่ inline ใน `CreateOrderPage` ถูกลบออกแล้ว แต่ tab ใน `ProductSelectorModal` ยังใช้งานอยู่

---

## ข้อควรระวัง

| หัวข้อ | รายละเอียด |
|--------|-----------|
| **Dual field names** | API ส่ง snake_case (`start_date`, `is_freebie`, `price_override`) แต่ frontend ใช้ camelCase (`startDate`, `isFreebie`, `priceOverride`) → ทุกที่เช็คทั้ง 2 format |
| **active type** | `promotion.active` เป็นได้ทั้ง `boolean` และ `number` (0/1 จาก MySQL) → ต้อง cast ก่อนใช้ |
| **company_id** | `CreatePromotionPage` + `PromotionModal` ใช้ `companyId` จาก `currentUser` prop (แก้แล้ว ไม่ได้ hardcode) |
| **Usage check = N+1 queries** | วนเรียก API ทุก promotion → ถ้ามี promotion เยอะจะช้า ควร optimize เป็น batch query |
| **PromotionModal** | component แยก สำหรับ edit — ไม่ได้ใช้ตอน create |
| **priceOverride** | `LineItem.priceOverride` (types.ts) ใช้เฉพาะ child promotion items → backend override `net_total`. หากไม่มีใน payload, backend auto-lookup จาก `promotion_items` table |
| **productId FK** | Parent promotion item ต้องส่ง `productId: undefined/null` (ห้ามส่ง `0` → FK violation). Backend มี safety: `!empty() ? (int) : null` |
