---
description: คู่มืออธิบายการทำงานหน้าตรวจสอบคำสั่งซื้อ (Check Order Page)
---

# คู่มือหน้าตรวจสอบคำสั่งซื้อ (CheckOrderPage)

## ภาพรวม

หน้า **ตรวจสอบคำสั่งซื้อ** (`pages/CheckOrderPage.tsx`) เป็นศูนย์กลางสำหรับตรวจสอบความถูกต้องของออเดอร์ แบ่งเป็น 5 tab:

### Super Admin Company Selector

สำหรับผู้ใช้ที่มี role = `Super Admin` จะแสดง **dropdown เลือกบริษัท** มุมขวาบนของหน้า เพื่อดูข้อมูลขององค์กรอื่นได้

- ดึงรายชื่อบริษัทจาก `Order_DB/companies.php` (same pattern as `BasketSettingsPage`)
- State: `selectedCompanyId` → `effectiveCompanyId` = ถ้าเป็น Super Admin ใช้ค่าที่เลือก, ถ้าไม่ใช่ใช้ `currentUser.companyId`
- `effectiveCompanyId` จะถูกส่งเป็น prop `companyId` ไปยังทุก tab (ClassificationTab, PromoCheckTab, CreatorCheckTab)
- เมื่อเปลี่ยน company, ทุก tab จะ re-fetch ข้อมูลอัตโนมัติ (ผ่าน `useEffect` dependency)

> **ขอบเขต:** เป็น **page-level state** (`useState`) เท่านั้น — ไม่ได้เก็บใน localStorage หรือ global context
> - ออกจากหน้านี้แล้วกลับมา → reset เป็น `currentUser.companyId`
> - หน้าอื่นทั้งหมดยังใช้ `currentUser.companyId` (company จริงของผู้ใช้) ไม่ได้รับผลกระทบ
> - หน้าอื่นที่มี company selector แยก: `BasketSettingsPage`, `BankAccountsManagementPage`, `PlatformsManagementPage`

| Tab | สี | หน้าที่ |
|-----|-----|---------|
| จัดประเภทยกเลิก | orange | จัดประเภทออเดอร์ที่ถูกยกเลิก |
| ตรวจสอบโปรโมชั่น | rose | ตรวจ child items ที่ net_total ไม่ตรง price_override |
| ตรวจสอบ Creator | teal | หา order_items ที่ creator_id ไม่ใช่ telesale/admin |
| ตั้งค่ายกเลิก | violet | CRUD ประเภทการยกเลิก + กำหนด default |
| สั่งทำ | - | (placeholder/future) |

## ไฟล์ที่เกี่ยวข้อง

### Frontend

| ไฟล์ | บทบาท |
|------|--------|
| `pages/CheckOrderPage.tsx` | Main page — 5 tab components |
| `components/OrderManagementModal.tsx` | Modal จัดการออเดอร์ (ใช้จาก tab ตรวจสอบโปรโมชั่น + ตรวจสอบ Creator) |
| `components/OrderDetailModal.tsx` | Modal ดูรายละเอียดออเดอร์ |
| `services/api.ts` | API wrapper functions |

### Backend

| ไฟล์ | บทบาท |
|------|--------|
| `api/Orders/analyze_cancelled_orders.php` | ดึงออเดอร์ที่ยกเลิก + สถิติ |
| `api/Orders/confirm_cancellation.php` | บันทึกประเภทยกเลิก (batch) |
| `api/Orders/get_cancellation_types.php` | ดึงรายการประเภทยกเลิก |
| `api/Orders/manage_cancellation_types.php` | CRUD ประเภทยกเลิก |
| `api/Orders/validate_promotion_orders.php` | ตรวจสอบ child.net_total vs price_override |
| `api/Orders/fix_promotion_orders.php` | แก้ไขออโต้ child qty + net_total |
| `api/Orders/validate_creator_orders.php` | หา orders ที่ creator_id ไม่ใช่ telesale/admin |
| `api/Orders/validate_creator_mismatch.php` | หา promotion orders ที่ parent/child creator_id ไม่ตรงกัน |
| `api/Orders/fix_creator_mismatch.php` | แก้ไข child.creator_id ให้ตรงกับ parent |

## Tab Components

### 1. ClassificationTab (จัดประเภทยกเลิก)

**Flow:**
1. โหลดออเดอร์ที่ถูกยกเลิก จาก `analyzeCancelledOrders()`
2. Filter โดย sub-tab: ทั้งหมด / ยังไม่จัดประเภท / จัดประเภทแล้ว
3. เลือกประเภทยกเลิกในแต่ละ row
4. กด "บันทึก" → `confirmCancellation()` batch save

**API:** `analyzeCancelledOrders`, `confirmCancellation`, `getCancellationTypes`

---

### 2. PromoCheckTab (ตรวจสอบโปรโมชั่น)

**Validation Rule (ราคาไม่ตรง):**
```
child.net_total != promotion_items.price_override × parent.quantity
```

**Flow:**
1. เรียก `validatePromotionOrders(companyId)` → ได้ list ออเดอร์ที่ child net_total ผิด
2. แสดงตาราง: Order ID | วันที่ | ลูกค้า | สถานะ | โปรโมชั่น | จำนวนเซ็ต | Parent Net | Child ผิด
3. กดปุ่ม **"แก้ไขออโต้"** → `fixPromotionOrders()` → fix child qty/net_total ตาม template
4. กด **"จัดการ"** → `getOrder()` → เปิด `OrderManagementModal`

**API:** `validatePromotionOrders`, `fixPromotionOrders`, `getOrder`, `patchOrder`

---

#### ส่วน "ตรวจสอบ Creator ไม่ตรง" (อยู่ใน PromoCheckTab)

**Validation Rule:**
```
parent.creator_id != child.creator_id (ในเซ็ตโปรโมชั่นเดียวกัน)
```

**Flow:**
1. เรียก `validateCreatorMismatch(companyId)` → ได้ list ออเดอร์ที่ parent/child creator_id ไม่ตรงกัน
2. แสดงตาราง: Order ID | วันที่ | ลูกค้า | สถานะ | โปรโมชั่น | Parent Creator | Child ผิด | แก้ไข
3. กดปุ่ม **"แก้ไขทันที"** ต่อแถว → `fixCreatorMismatch(companyId, [parentItemId])` → อัปเดต child.creator_id ให้ตรงกับ parent
4. กดปุ่ม **"แก้ไขทั้งหมด"** → fix ทุก parent_item_ids ในคราวเดียว

**API:** `validateCreatorMismatch`, `fixCreatorMismatch`

> คู่มือเพิ่มเติม: ดู `/promotions-guide` สำหรับรายละเอียด Auto-Fix logic

---

### 3. CreatorCheckTab (ตรวจสอบ Creator)

**Logic:**
```sql
WHERE oi.creator_id NOT IN (
  SELECT id FROM users
  WHERE LOWER(role) LIKE '%telesale%'
     OR LOWER(role) LIKE '%admin%'
)
```

**Flow:**
1. เรียก `validateCreatorOrders(companyId)` → ได้ list ออเดอร์ที่ creator_id ไม่ใช่ telesale/admin
2. แสดงตาราง: Order ID | วันที่ | ลูกค้า | สถานะ | Creator | Role | Items
3. กด **"จัดการ"** → `getOrder()` → เปิด `OrderManagementModal`

**API:** `validateCreatorOrders`, `getOrder`, `patchOrder`

---

### 4. SettingsTab (ตั้งค่ายกเลิก)

**Flow:**
1. CRUD ประเภทยกเลิก (เพิ่ม/แก้ไข/ลบ/กู้คืน)
2. Drag & Drop จัดลำดับ
3. กำหนด default type

**API:** `manageCancellationTypes`, `setDefaultCancellationType`

> คู่มือเพิ่มเติม: ดู `/cancellation-system-guide` สำหรับ Flow รายละเอียด

## Routing

```
App.tsx → case "ตรวจสอบคำสั่งซื้อ" / "nav.cancellation_management"
  → <CheckOrderPage currentUser={currentUser} />
```

## API Functions (services/api.ts)

| Function | Endpoint | Method |
|----------|----------|--------|
| `validatePromotionOrders(companyId)` | `Orders/validate_promotion_orders.php` | GET |
| `fixPromotionOrders(companyId, ids)` | `Orders/fix_promotion_orders.php` | POST |
| `validateCreatorOrders(companyId)` | `Orders/validate_creator_orders.php` | GET |
| `validateCreatorMismatch(companyId)` | `Orders/validate_creator_mismatch.php` | GET |
| `fixCreatorMismatch(companyId, ids)` | `Orders/fix_creator_mismatch.php` | POST |
| `analyzeCancelledOrders(companyId, page, pageSize)` | `Orders/analyze_cancelled_orders.php` | GET |
| `confirmCancellation(items, classifiedBy)` | `Orders/confirm_cancellation.php` | POST |
| `getCancellationTypes()` | `Orders/get_cancellation_types.php` | GET |
| `manageCancellationTypes(method, data)` | `Orders/manage_cancellation_types.php` | * |
| `setDefaultCancellationType(id)` | `Orders/manage_cancellation_types.php` | POST |
