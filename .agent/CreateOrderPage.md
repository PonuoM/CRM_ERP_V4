# คู่มือหน้าสร้างคำสั่งซื้อ (CreateOrderPage)

## 1. ภาพรวม

**ไฟล์**: [CreateOrderPage.tsx](file:///c:/AppServ/www/CRM_ERP_V4/pages/CreateOrderPage.tsx) (~9,900 บรรทัด)

หน้านี้ทำหน้าที่ 2 โหมด:
1. **สร้างออเดอร์ใหม่** — เลือก/สร้างลูกค้า → กรอกที่อยู่จัดส่ง → เลือกสินค้า → ชำระเงิน → บันทึก
2. **อัปเซล (Upsell)** — เลือกออเดอร์เดิมของลูกค้า → เพิ่มสินค้าลงออเดอร์เดิม

### Section Index (ค้นหาด้วยรหัส เช่น `[E8]`)

| รหัส | Section | บรรทัด~ | คำอธิบาย |
|---|---|---|---|
| `[A]` | Imports | ~1 | import ทั้งหมด |
| `[B]` | Types & Interfaces | ~39 | `TransferSlipUpload`, `UpsellSlip`, `CreateOrderPageProps` |
| `[C]` | Utility Functions | ~82 | `sanitizeAddressValue`, `normalizeAddress`, `cleanAddressName` |
| `[D]` | OrderSummary | ~233 | Sub-component สรุปยอด (สินค้า - ส่วนลด + shipping - billDiscount) |
| `[E]` | **Main Component** | ~374 | `CreateOrderPage` component เริ่มต้น |
| `[E1]` | Upsell — State & Hooks | ~415 | state ทั้งหมดของ Upsell (orders, items, boxes, slips) |
| `[E2]` | Upsell — Item Handlers | ~953 | add/remove/update items, product/promotion select |
| `[E3]` | Upsell — Slip & COD | ~1300 | slip upload + COD box management สำหรับ Upsell |
| `[E4]` | Upsell — Save Handler | ~1591 | validate + `addUpsellItems` API |
| `[E5]` | Normal — Bank & Slip State | ~1715 | bank accounts, transfer slip uploads |
| `[E6]` | Normal — Product Selector State | ~1841 | product selector modal state |
| `[E7]` | Normal — Validation System | ~1883 | field refs, highlight, clearValidationErrorFor |
| `[E8]` | Normal — **คำนวณยอด** | ~2003 | ⚠️ คำนวณฝั่ง frontend เท่านั้น — backend คำนวณแยก |
| `[E9]` | Normal — Address System | ~2183 | cascading dropdowns + postal code auto-fill + CRUD |
| `[E10]` | Normal — Customer Search | ~3206 | mapCustomerData, handleSelectCustomer, startCreatingNewCustomer |
| `[E11]` | Normal — Phone Validation | ~4010 | validate phone 10 หลัก + backup phone |
| `[E12]` | Normal — **handleSave** | ~4104 | validate ทุก field → build payload → onSave → post-save updates |
| `[E13]` | Normal — COD Box Logic | ~4964 | divide equally, codAmount change |
| `[E14]` | Normal — Product Helpers | ~5004 | addProductById, addPromotionById, calcPromotionSetPrice |
| `[E15]` | JSX: **Upsell View** | ~5646 | `renderUpsellView()` — UI ทั้งหมดของโหมดอัปเซล |
| `[E16]` | JSX: **Normal Order** | ~6839 | main `return()` — UI ทั้งหมดของโหมดสร้างออเดอร์ปกติ |

### Props หลัก

| Prop | คำอธิบาย |
|---|---|
| `products` | รายการสินค้าทั้งหมด |
| `promotions` | โปรโมชั่นทั้งหมด |
| `pages` | หน้าเพจ (sales channel) |
| `platforms` | แพลตฟอร์ม |
| `warehouses` | คลังสินค้า (จับคู่ตามจังหวัด) |
| `currentUser` | ผู้ใช้ปัจจุบัน |
| `users` | รายชื่อพนักงาน |
| `onSave` | callback บันทึกออเดอร์ → ส่ง payload ไปยัง parent |
| `onCancel` | callback ยกเลิก |
| `initialData` | `{ customer, upsell? }` — ถ้า `upsell=true` → เข้าโหมดอัปเซล |

---

## 2. ระบบเลือก/สร้างลูกค้า `[E10]`

### 2.1 ค้นหาลูกค้า
- Debounce 500ms → `listCustomers({ q, pageSize: 50, companyId })`
- แสดงผลลัพธ์ dropdown, เมื่อเลือก → fetch ข้อมูลสดจาก `GET /customers/{id}`

### 2.2 สร้างลูกค้าใหม่
- ถ้าพิมพ์เบอร์โทร (0xxxxxxxxx) → ใส่ในช่อง phone
- ถ้าพิมพ์ชื่อ → แยกเป็น firstName / lastName
- กรอก: ชื่อ, นามสกุล, เบอร์โทร, เบอร์สำรอง, ประเภทลูกค้า

### 2.3 แก้ไขลูกค้า (เมื่อเลือกลูกค้าเดิม)
- แก้ไข: ชื่อ, นามสกุล, เบอร์โทร, เบอร์สำรอง, ประเภทลูกค้า, Facebook, Line ID

### 2.4 สร้างออเดอร์ + สร้างลูกค้าใหม่
เมื่อสร้างคำสั่งซื้อแบบปกติ **พร้อมสร้างลูกค้าใหม่** ระบบจะกำหนดค่าเริ่มต้นให้ลูกค้าใหม่:
- `assigned_to` = `user_id` ของผู้สร้างคำสั่งซื้อ (เจ้าของลูกค้าทันที)
- `current_basket_key` = `38` (ตะกร้า "ลูกค้าใหม่")

---

## 3. ระบบที่อยู่จัดส่ง `[E9]`

### 3.1 ตัวเลือกที่อยู่
- **ที่อยู่ profile** — ดึงจาก `customer.address` (default)
- **ที่อยู่ที่บันทึกไว้** — ดึงจาก `Address_DB/get_address_data.php?endpoint=customer_addresses`
- **ที่อยู่ใหม่** — กรอกใหม่ทั้งหมด

### 3.2 Cascading Dropdown

```
รหัสไปรษณีย์ (พิมพ์ 3+ หลัก → ค้นหาอัตโนมัติ)
    → จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์
```

**API**: `Address_DB/get_address_data.php`
- `endpoint=geographies` → ภาค
- `endpoint=provinces` → จังหวัด
- `endpoint=districts&id={province_id}` → อำเภอ
- `endpoint=sub_districts&id={district_id}` → ตำบล
- `endpoint=search&search={postal_code}` → ค้นหาจากรหัสไปรษณีย์

### 3.3 การจัดการที่อยู่
- **ลบที่อยู่** → `POST endpoint=delete_customer_address`
- **ตั้งเป็นที่อยู่หลัก** → `POST endpoint=set_primary_address` (สลับกับที่อยู่ปัจจุบัน)
- **บันทึกที่อยู่ใหม่** → checkbox "บันทึกเป็นที่อยู่ใหม่"
- **อัปเดต profile** → checkbox "อัปเดตที่อยู่โปรไฟล์"

### 3.4 คลังสินค้าอัตโนมัติ
- เมื่อเลือกจังหวัด → ค้นหา warehouse ที่ `responsibleProvinces` ครอบคลุมจังหวัดนั้น
- ถ้าไม่เจอ → fallback ไปคลังที่มี `"everywhere"`

---

## 4. ระบบสินค้า `[E14]`

### 4.1 ProductSelectorModal
- 3 tabs: **สินค้า (products)**, **โปรโมชั่น (promotions)**, **โควตา (quota)**
- เลือกสินค้า → เพิ่มเป็น LineItem (ชื่อ, จำนวน, ราคา/หน่วย, ส่วนลด)
- เลือกโปรโมชั่น → สร้าง parent item + child items (รวมของแถม)

### 4.2 โควตา
- ดึงจาก `quotaApi` → คำนวณ remaining สำหรับแต่ละสินค้า
- จำกัดจำนวนไม่ให้เกิน quota ที่เหลือ

### 4.3 ราคาและส่วนลด
- แต่ละ item: `quantity × pricePerUnit - discount`
- Promo parent: `pricePerUnit × quantity` (ราคาชุด)
- Promo child: ใช้ `priceOverride` (ราคาพิเศษ) หรือ `price × qty`

---

## 5. ระบบชำระเงิน `[E5]`

### 5.1 วิธีชำระเงิน

| วิธี | ค่า enum | ฟีเจอร์เพิ่มเติม |
|---|---|---|
| โอนเงิน | `Transfer` | อัปโหลดสลิป + เลือกบัญชีธนาคาร + วันที่โอน |
| เก็บเงินปลายทาง | `COD` | กรอกยอด COD ต่อกล่อง (ต้องรวมเท่ายอดสุทธิ) |
| รับสินค้าก่อนโอน | `PayAfter` | - |
| คูปองส่วนลด | `DiscountCoupon` | - |

### 5.2 Transfer (โอนเงิน)
- อัปโหลดหลายสลิปได้
- เลือกบัญชีธนาคาร → `listBankAccounts(companyId, activeOnly=true)`
- กรอกวันที่/เวลาโอน
- แต่ละสลิป: file → DataURL + bankAccountId + transferDate + amount
- เมื่ออัปโหลด → `paymentStatus = PendingVerification`

### 5.3 COD (เก็บเงินปลายทาง) `[E13]`
- กำหนดจำนวนกล่อง (numBoxes)
- แต่ละกล่อง: `boxNumber` + `codAmount`
- **Validation**: `ΣcodAmount = totalAmount` (ต้องเท่ากันพอดี)
- ปุ่ม "หารเท่า" → แบ่งยอดเท่ากันทุกกล่อง

---

## 6. สรุปยอด (OrderSummary) `[D]` + `[E8]`

> [!WARNING]
> `[E8]` คือการคำนวณยอดฝั่ง **frontend** สำหรับแสดงผลเท่านั้น
> Backend คำนวณยอดจริงแยกต่างหากใน API — อย่าแก้ส่วนนี้เพื่อแก้ยอด backend

```
ยอดรวมสินค้า          = Σ(qty × pricePerUnit)   ── ไม่รวมของแถม, ไม่รวม child items
ส่วนลดรายการสินค้า    = Σ(discount)
Subtotal              = ยอดรวม - ส่วนลดรายการ
ค่าขนส่ง              = shippingCost             ── กรอกได้
ส่วนลดท้ายบิล (%)     = billDiscount             ── เป็น % → คำนวณเป็นจำนวนเงิน
ยอดสุทธิ              = Subtotal + ค่าขนส่ง - (Subtotal × billDiscount%)
```

---

## 7. โหมดอัปเซล (Upsell) `[E1]`–`[E4]`, `[E15]`

เข้าเมื่อ `initialData.upsell = true`

### Flow:
1. **ดึงออเดอร์** `[E1]` → `getUpsellOrders(customerId, currentUserId)` → แสดง dropdown เลือก
2. **แสดงรายการเดิม** `[E15]` → items ของออเดอร์ที่เลือก (อ่านอย่างเดียว)
3. **เพิ่มรายการใหม่** `[E2]` → เลือกสินค้า/โปรโมชั่น + กรอกจำนวน/ส่วนลด
4. **COD กล่อง** `[E3]` → ถ้า payment = COD → เพิ่มกล่องใหม่ (ต่อจากกล่องเดิม)
5. **สลิป** `[E3]` → ถ้า payment = Transfer → อัปโหลดสลิปใหม่ + ดูสลิปเก่า
6. **บันทึก** `[E4]` → `addUpsellItems(orderId, creatorId, items)` → แสดง success modal

### การ Scale โปรโมชั่น:
- เปลี่ยน qty ของ promo parent → child items จะ scale ตาม `originalQuantity × parentQty`

---

## 8. Validation `[E7]` + `[E12]`

| Field | เงื่อนไข |
|---|---|
| `customerSelector` | ต้องเลือกหรือสร้างลูกค้า |
| `newCustomerFirstName` | ต้องกรอกชื่อ (ลูกค้าใหม่) |
| `newCustomerPhone` | ต้องกรอกเบอร์โทร (ลูกค้าใหม่) |
| `shippingAddress` | ต้องมีที่อยู่จัดส่ง + ตรวจความสัมพันธ์ผ่าน `check_exist.php` |
| `customerStatus` | ต้องเลือกสถานะลูกค้า |
| `deliveryDate` | ต้องระบุวันจัดส่ง (ไม่เกินวันที่ 7 ของเดือนถัดไป) |
| `items` | ต้องมีสินค้าอย่างน้อย 1 รายการ |
| `quota` | ตรวจสอบโควตาคงเหลือก่อนบันทึก |
| `paymentMethod` | ต้องเลือกวิธีชำระ |
| `transferSlips` | ถ้า Transfer → ต้องมีสลิป + ธนาคาร + วันที่โอน + จำนวนเงิน |
| `cod` | ถ้า COD → ยอดรวมกล่องเท่ายอดสุทธิ + กล่องไม่เกินจำนวนสินค้า + ทุกกล่องมีสินค้า |
| `salesChannel` | ต้องเลือกช่องทางขาย |
| `salesChannelPage` | ต้องเลือกเพจ (ถ้าแพลตฟอร์มต้องการ) |

เมื่อ validate ไม่ผ่าน → scroll ไปยังฟิลด์ที่ผิด + highlight สีแดง

---

## 9. Payload ที่ส่งออก (`onSave`) `[E12]`

```ts
{
  order: Partial<Order>,        // ข้อมูลออเดอร์ (items, shippingAddress, paymentMethod, ...)
  newCustomer?: {...},           // ข้อมูลลูกค้าใหม่ (ถ้าสร้างใหม่)
  customerUpdate?: {...},        // อัปเดต address, facebookName, lineId
  updateCustomerInfo?: {...},    // อัปเดต firstName, lastName, phone, backupPhone
  newCustomerAddress?: {...},    // บันทึกที่อยู่ใหม่ลง customer_addresses
  updateCustomerAddress?: bool,  // อัปเดตที่อยู่ profile ลูกค้า
  updateCustomerSocials?: bool,  // อัปเดต social ลูกค้า
  slipUploads?: [{               // DataURL ของสลิป (array of objects)
    dataUrl, bankAccountId, transferDate, amount
  }],
  bankAccountId?: number,        // ธนาคารจาก slip แรก
  transferDate?: string,         // วันที่โอนจาก slip แรก
  customerType?: string,         // สถานะลูกค้า (New/Reorder/Upsell/Mined Lead)
}
```

### Post-save actions (ทำหลังบันทึกสำเร็จ):
1. **Quota recording** → `recordOrderUsage()` (fire-and-forget)
2. **อัปเดตที่อยู่ profile** → `update_customer_address.php` (ถ้าเลือก profile หรือ updateProfileAddress)
3. **อัปเดต socials** → `update_customer_address.php` (facebook, lineId, birthDate)
4. **บันทึกที่อยู่ใหม่** → `save_customer_address` (ถ้าเลือก "ที่อยู่ใหม่" + ไม่ได้ update profile)

---

## 10. API ที่ใช้

| API | Section | การใช้งาน |
|---|---|---|
| `listCustomers()` | `[E10]` | ค้นหาลูกค้า |
| `GET /customers/{id}` | `[E10]` | ดึงข้อมูลลูกค้าสด |
| `listBankAccounts()` | `[E5]` | ดึงบัญชีธนาคาร |
| `getUpsellOrders()` | `[E1]` | ดึงออเดอร์สำหรับอัปเซล |
| `addUpsellItems()` | `[E4]` | บันทึกรายการอัปเซล |
| `createOrderSlip()` | `[E3]` | อัปโหลดสลิป (upsell) |
| `listOrderSlips()` | `[E3]` | ดึงสลิปของออเดอร์ |
| `Address_DB/get_address_data.php` | `[E9]` | ข้อมูลที่อยู่ + CRUD |
| `Address_DB/check_exist.php` | `[E12]` | ตรวจความสัมพันธ์ที่อยู่ |
| `Address_DB/update_customer_address.php` | `[E12]` | อัปเดตที่อยู่/socials |
| `quotaApi` | `[E12]` | ตรวจสอบ + บันทึกโควตา |

---

## 11. Shipping Providers

```ts
["J&T Express", "Flash Express", "Kerry Express", "Aiport Logistic", "ไปรษณีย์ไทย"]
```
