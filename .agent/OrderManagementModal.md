# OrderManagementModal Component Guide

## Overview
`OrderManagementModal.tsx` is a comprehensive modal component used for viewing, editing, and managing order details. It supports various order types (COD, Transfer, etc.), handles partial payments, manages shipping details, and tracks order history.

## Props Interface
```typescript
interface OrderManagementModalProps {
  order: Order;                 // The order object to display/edit
  customers: Customer[];        // List of available customers
  activities: Activity[];       // Order activity history
  onSave: (updatedOrder: Order) => void; 
  onClose: () => void;
  currentUser?: User;           // Current logged-in user
  users?: User[];               // List of system users (for assignee, etc.)
  onEditCustomer?: (customer: Customer) => void;
  products?: Product[];         // List of products for item selection
  backdropClassName?: string;
  permission?: 'seller' | 'manager'; // Controls role-based visibility
}
```

## Key Features

### 1. Role-Based Permissions
The component restricts certain sensitive actions based on the `permission` prop:
- **Manager**: Can view and interactive with "Verify Slip" (ยืนยันสลิป) controls.
- **Seller**: Controls for slip verification are hidden.

Usage in `App.tsx`: permission is determined by the active page context (e.g., `ManageOrdersPage` grants 'manager', `TelesaleOrdersPage` grants 'seller').

### 2. Slip Management
- **View**: Displays uploaded slips in a list.
- **Upload**: Allows uploading new keys/slips. **Transfer Date** defaults to empty (requiring user input) instead of current datetime.
  - Backend รองรับ: `png`, `jpeg`, `jpg`, `gif`, `webp`, `bmp`, `svg` (ทั้ง data URL และ raw base64)
- **Verification**: `isSlipLocked` and `canVerifySlip` logic prevents modification of verified slips unless authorized. Use checkboxes to toggle "Verified" status.
- **Lightbox**: Click on a slip to view it in full size.

### 3. COD & Box Management
- **Boxes**: Supports splitting order into multiple boxes. Each box has tracking number, COD amount, and collection status.
- **Validation**:
  - Ensures total COD amount across boxes matches `Order Total`.
  - Prevents saving if detailed COD amounts don't sum up correctly (tolerance < 0.1).
- **Auto-Calculation**: Can distribute `Amount Paid` across boxes based on weight/proportion if needed.

### 4. Product & Promotion Selection
- **Product Selector**: Modal to search and add products/promotions.
- **Promotions**: Handles parent-child relationships for bundled items.
  - Parent item (`parent_item_id = NULL`, `is_promotion_parent = 1`) holds the promotion's total price.
  - ⚠️ Parent item **ต้องส่ง `productId: undefined/null`** (ห้ามส่ง `0` → FK constraint violation)
  - Child items (`parent_item_id != NULL`) are individual products under the promotion.
  - **Both `computeOrderTotal` and `calculateOrderTotal` exclude child items** to prevent double-counting — only parent items and standalone products are summed.
- **Stock Check**: (In-progress/Partial) Displays stock availability.

> 💡 **Promotion display pattern** ใช้เหมือนกันใน `OrderDetailModal.tsx` (read-only, collapse/expand, CornerDownRight arrow, smaller text สำหรับ child)

#### Promotion Child Item Pricing (`priceOverride`)

เมื่อเลือกโปรโมชั่น (`handleSelectPromotion`):
- Child items ส่ง **2 field** ให้ backend:
  - `pricePerUnit` = ราคาสินค้าปกติ (ใช้แสดงผลเท่านั้น)
  - `priceOverride` = `promotion_items.price_override` (อาจมีหรือไม่มีใน payload)
- **สูตร net_total ของ child:** `net_total = promotion_items.price_override × parent.quantity`
- Backend (Phase 3 child insert, ทั้ง POST และ PUT):
  1. ถ้ามี `priceOverride` ใน payload → ใช้ค่านั้น
  2. ถ้าไม่มี → **auto-lookup** จาก `promotion_items` table ด้วย `promotion_id` + `product_id`
  3. `$netTotal = $overridePrice * $parentQty` (หา parent qty จาก items array)
- สินค้าธรรมดา (ไม่มี `priceOverride` และหาไม่เจอใน DB) → ยังใช้ logic เดิม `pricePerUnit × qty - discount`

#### Quantity Scaling Logic

Child item quantity ถูก scale ตามจำนวน parent (เช่น โปรโมชั่น 100 ขวด สั่ง 3 ชุด = 300 ขวด)
- **`originalQuantity`**: จำนวนต่อ 1 ชุดโปรโมชั่น (เก็บเฉพาะ frontend, ไม่มีใน DB)
- **UI onChange**: เมื่อเปลี่ยนจำนวน parent → `child.qty = originalQuantity × parentQty`
- **UI display (DB-loaded)**: ถ้าไม่มี `originalQuantity` → แสดง `item.quantity` ตรงๆ (ค่าจาก DB = สุดท้ายแล้ว)
- **Parent qty onChange (DB-loaded)**: derive `baseQty = qty / oldParentQty` ก่อนคูณ `newParentQty`

### 5. Address Management
- **Auto-Fill**: Selecting a customer auto-fills shipping address.
- **Manual Edit**: Allows overriding shipping details for the specific order.
- **Province Loader**: Dynamically loads Thai province/district data.

## Total Calculation Functions

| Function | Location | Used For |
|----------|----------|----------|
| `computeOrderTotal(order)` | Top-level (line ~168) | Hydrating `totalAmount` when order loads |
| `calculateOrderTotal(items, shipping, discount)` | Inside component (line ~2179) | COD validation in `handleSave` + auto-updating `totalAmount` on item changes |

Both functions apply the same filters:
1. **Exclude freebies** (`isFreebie` / `is_freebie`)
2. **Exclude child promotion items** (`parentItemId` / `parent_item_id` != null)

## Backend Order Item Insert (3-Phase Process)

| Phase | เงื่อนไข | net_total Logic |
|-------|---------|----------------|
| 1) Parent promotion | `isPromotionParent = true` | `pricePerUnit × qty - discount` |
| 2) สินค้าธรรมดา | `!isParent && !hasParent` | `pricePerUnit × qty - discount` |
| 3) Child promotion | `!isParent && hasParent` | ถ้ามี `priceOverride` ใน payload → ใช้ค่านั้น, ไม่มี → auto-lookup จาก `promotion_items` table, `$netTotal = $overridePrice * $parentQty` |

> ⚠️ Backend safety: `productId = 0` ถูกแปลงเป็น `null` อัตโนมัติ (`!empty() ? (int)$it['productId'] : null`)

## State Management
- **`currentOrder`**: Local copy of the order for editing. Changes are drafted here until `onSave` is clicked.
- **`slips`**: Manages the list of slip images/records associated with the order.
- **`calculatedTotals`**: `useMemo` hook effectively recalculates total price, discounts, and shipping cost on every item change.

### 6. หมายเหตุออเดอร์ (Order Notes)
- ฟิลด์ `orders.notes` — **edit mode**: แสดง textarea สีเหลืองให้แก้ไขได้ (อยู่ใต้ที่อยู่จัดส่ง ภายใน InfoCard เดียวกัน)
- **view mode**: แสดง read-only เมื่อมีข้อมูล, ซ่อนเมื่อว่าง
- ใช้ `handleFieldChange("notes", value)` → อัปเดต `currentOrder.notes`
- บันทึกพร้อมกับ `onSave` (ผ่าน `...currentOrder` spread) → Backend UPDATE `orders SET notes=COALESCE(?,notes)`
- Locked order: textarea ถูก disabled ยกเว้น `permission="manager"`

## Validation & Saving
The `handleSave` function performs critical checks before committing:
1. **COD Balance**: Checks if Box COD Sum == Order Total.
2. **Payment Integration**: For 'PayAfter' or 'Transfer', updates slip amounts/metadata.
3. **Sequential Boxes**: Ensures box numbers are sequential (1, 2, 3...).

## Order Locking Mechanism
The `isModifiable` (and derived `isLocked`) logic prevents editing of orders that have progressed beyond the confirmation stage.
- **Locked Statuses**: `Preparing`, `Picking`, `Shipping`, `Delivered`, `Returned`, `Cancelled`, `BadDebt`, `Claiming`.
- **Effect**: If locked, all input fields are disabled, **and the "Edit Order" and "Upload Additional Slip" buttons are disabled (but visible)**. The order is read-only.
- **Override**: Users with `permission="manager"` can bypass this lock and edit any order.


## Usage Example (from App.tsx)
```tsx
<OrderManagementModal
  order={modalState.data as Order}
  customers={customers}
  activities={activities}
  onSave={handleUpdateOrder}
  onClose={closeModal}
  currentUser={currentUser}
  permission={modalPermission} // Calculated based on user role/page
/>
```
