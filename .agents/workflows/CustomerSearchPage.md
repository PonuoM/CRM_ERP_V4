# คู่มือการทำงานหน้าค้นหาลูกค้า (CustomerSearchPage)

## 1. ภาพรวม
หน้าค้นหาลูกค้า (`pages/CustomerSearchPage.tsx`) ใช้สำหรับค้นหาลูกค้าแบบเจาะจง แสดงข้อมูลโปรไฟล์ และดูประวัติการสั่งซื้อแบบละเอียดรายสินค้า

## 2. Props

| Prop | Type | คำอธิบาย |
|---|---|---|
| `customers` | `Customer[]` | รายชื่อลูกค้า (fallback, ไม่ได้ใช้หลัก) |
| `orders` | `Order[]` | ออเดอร์ (fallback, ดึงใหม่จาก API เมื่อเลือกลูกค้า) |
| `users` | `User[]` | รายชื่อพนักงาน สำหรับ mapping ชื่อผู้ขาย/แผนก |
| `currentUser` | `User` | ผู้ใช้ปัจจุบัน (ใช้กรอง companyId + แสดงปุ่มรับลูกค้า) |
| `onTakeCustomer` | `(customer) => void` | Callback เมื่อกดปุ่ม "รับลูกค้า" |
| `pages` | `Page[]` | รายชื่อเพจ สำหรับ mapping `salesChannelPageId` → ชื่อเพจ |

## 3. การค้นหา (Search Logic)

### ลำดับการค้นหา
1. **ค้นหาลูกค้า** → `listCustomers({ q: searchTerm })` ค้นหาชื่อ/เบอร์โทร
   - พบ **1 คน** → แสดงโปรไฟล์ทันที
   - พบ **หลายคน** → แสดงรายการให้เลือก
2. **ถ้าไม่พบลูกค้า** → ค้นหา **Order ID** → `listOrders({ orderId: searchTerm })`
   - พบออเดอร์ → ดึง `customer_phone` จากออเดอร์ → ค้นหาลูกค้าจากเบอร์โทร
   - เปิดโปรไฟล์ลูกค้า + highlight ออเดอร์ที่ค้นหา (พื้นสีเหลือง)

### UI การค้นหา
- ช่อง input + ปุ่ม "ค้นหา" / "ล้าง"
- กด Enter เพื่อค้นหาได้
- แสดง Loading state ขณะค้นหา
- แสดง "ไม่พบข้อมูล" เมื่อไม่พบ

## 4. โปรไฟล์ลูกค้า (Customer Card)

เมื่อเลือกลูกค้าแล้ว แสดงข้อมูล:

### Card หลัก
- ชื่อ-นามสกุล, เบอร์โทร, ที่อยู่
- **ยอดรวม** (คำนวณจาก items โดยไม่รวมของแถมและสินค้าลูกในชุดโปร)
- **จำนวนครั้งที่สั่ง**
- ปุ่ม **"รับลูกค้า"** (แสดงเมื่อ: ลูกค้าไม่มี `assignedTo` + ผู้ใช้ไม่ใช่ Backoffice + มี callback)

### ข้อมูลเพิ่มเติม (Grid 3 คอลัมน์)
- ผู้ดูแลปัจจุบัน (lookup จาก `users`)
- Facebook Name
- LINE ID

## 5. ประวัติการสั่งซื้อ (Order History Table)

### การดึงข้อมูล
- เมื่อเลือกลูกค้า → `listOrders({ customerId, pageSize: 100 })`
- กรอง sub-orders ออก (ID ที่ลงท้ายด้วย `-\d+`)
- เรียงจากวันที่ล่าสุด → เก่าสุด

### คอลัมน์ตาราง

| คอลัมน์ | แสดง | หมายเหตุ |
|---|---|---|
| เลขที่ Order | `order.id` | แถวแรกของออเดอร์เท่านั้น |
| วันที่ขาย | `order.orderDate` | แถวแรกเท่านั้น, format DD/MM/YYYY |
| สินค้า | `item.productName` | ทุกแถว + badge "ชุดโปรโมชั่น" / "แถม" |
| จำนวน | `item.quantity` | ทุกแถว |
| ราคา | `qty × price - discount` | "ฟรี" สำหรับของแถม, "รวมในชุด" สำหรับ child items |
| พนักงานขาย | ชื่อจาก `item.creatorId` | **ทุกแถว** (รองรับ Upsell หลายคนขาย) |
| แผนก | `role` จาก creator | ทุกแถว |
| ช่องทางการขาย | `salesChannel` หรือ "โทร" | Role 6/7 = "โทร" |
| เพจ | `getPageName(salesChannelPageId)` | ไม่แสดงถ้าเป็น "โทร" |
| สถานะออเดอร์ | `order.orderStatus` | แถวแรกเท่านั้น |
| Tracking | `trackingNumber` | match ตาม `boxNumber` ของ item |

### การจัดกลุ่มสี
- สลับสี `bg-white` / `bg-gray-50` ตาม order index
- สินค้า Promotion parent → `bg-orange-50`
- สินค้าลูกในชุดโปร → `bg-orange-50/50`
- ของแถม → ข้อความสีเขียว
- Highlighted order (ค้นจาก Order ID) → `bg-yellow-50`

## 6. State Management

| State | Type | คำอธิบาย |
|---|---|---|
| `searchTerm` | `string` | คำค้นหา |
| `searchResults` | `Customer[]` | ผลค้นหาหลายคน |
| `selectedCustomer` | `Customer | null` | ลูกค้าที่เลือก |
| `hasSearched` | `boolean` | เคยกดค้นหาแล้วหรือยัง |
| `fetchedOrders` | `Order[]` | ออเดอร์ที่ดึงจาก API ตาม customer |
| `loadingOrders` | `boolean` | กำลังโหลดออเดอร์ |
| `highlightedOrderId` | `string | null` | ออเดอร์ที่ highlight (ค้นจาก Order ID) |
| `isSearching` | `boolean` | กำลังค้นหาลูกค้า |
| `pages` | `Page[]` | รายชื่อเพจ (fetch เอง ถ้า props ไม่มี) |

## 7. API ที่ใช้

| API | การใช้งาน |
|---|---|
| `listCustomers({ q, companyId })` | ค้นหาลูกค้าจากชื่อ/เบอร์ |
| `listCustomers({ phone, companyId })` | ค้นหาลูกค้าจากเบอร์โทร (fallback จาก order) |
| `listOrders({ customerId, pageSize })` | ดึงออเดอร์ของลูกค้า |
| `listOrders({ orderId, companyId })` | ค้นหาด้วย Order ID |
| `listPages(companyId)` | ดึงรายชื่อเพจ |

## 8. Business Rules

- **ยอดรวม**: คำนวณจาก `items` — ไม่รวมของแถม (`isFreebie`) และสินค้าลูกในชุดโปร (`parentItemId != null`)
- **ช่องทางขาย**: ถ้า `creatorRoleId` เป็น 6 หรือ 7 → แสดง "โทร" แทน `salesChannel`
- **เพจ**: แสดงเฉพาะเมื่อช่องทางขายไม่ใช่ "โทร"
- **Tracking**: match ตาม `boxNumber` ของแต่ละ item → fallback แสดง tracking แรกที่แถวแรก

## 9. ปุ่มรับลูกค้า (handleTakeCustomer)

### เงื่อนไขแสดงปุ่ม
- ลูกค้าไม่มี `assignedTo` (ยังไม่มีผู้ดูแล)
- ผู้ใช้ปัจจุบันไม่ใช่ `Backoffice`
- มี `onTakeCustomer` callback

### Flow เมื่อกดปุ่ม (`App.tsx` → `handleTakeCustomer`)

1. **ตรวจสอบ Block** → ถ้า `current_basket_key = 55` (block_customers):
   - ดึง `reason` จาก `listCustomerBlocks(customerId)` (หา active block)
   - แสดง confirm: "⚠️ ลูกค้าคนนี้ถูกบล็อค / เหตุผล: {reason} / ยืนยันที่จะรับอยู่ไหม?"
   - ถ้าไม่ยืนยัน → หยุด
2. **Confirm ปกติ** → "คุณต้องการรับผิดชอบลูกค้า ... หรือไม่?" (ถ้าไม่ใช่ blocked)
3. **PATCH `/customers/{id}`** → `{ assignedTo, dateAssigned, is_blocked: 0 }` (ถ้า blocked จะส่ง `is_blocked: 0` ปลดบล็อคด้วย)
4. **POST `/ownership`** → `{ action: 'retrieve' }` (ตั้ง ownership 30 วัน)
5. **GET `/ownership/{id}`** → ดึง `ownership_expires` ใหม่
6. **อัปเดต state** → `lifecycleStatus` = FollowUp, `isBlocked` = false
7. **Redirect** → `?page=Dashboard+V2&customerId={customer_id}`

### Auto-Forward Basket (Backend)

เมื่อ PATCH customers เปลี่ยน `assigned_to` → backend (`api/index.php` บรรทัด 2378-2396) จะ **อัปเดต `current_basket_key` อัตโนมัติ**:

1. ดึง `basket_config` ของ basket เดิม (`SELECT target_page, linked_basket_key FROM basket_config WHERE id = ?`)
2. ถ้า `target_page = 'distribution'`:
   - มี `linked_basket_key` → ใช้ค่านั้น
   - `linked_basket_key = NULL` → default เป็น `'new_customer'`
3. หา id จาก `basket_config WHERE basket_key = ?` → ตั้ง `current_basket_key` ใหม่ + บันทึก `basket_transition_log`

**ตัวอย่าง**: basket 44 (ตะกร้าแจกงาน) → link ไป basket 49 (ตะกร้า dashboard) → ลูกค้าย้ายอัตโนมัติเมื่อถูก assign
