# กฎเกณฑ์และขั้นตอนการทำงานของระบบจัดการการตีกลับ (Return Management)

## 1. ภาพรวม
โมดูลจัดการการตีกลับ (Return Management) ออกแบบมาเพื่อติดตาม ตรวจสอบ และกระทบยอดคำสั่งซื้อที่ถูกตีกลับ โดยเปรียบเทียบข้อมูลในระบบ (คำสั่งซื้อที่มีสถานะ 'Returned') กับรายงานภายนอก (เช่น รายงานการตีกลับจากขนส่ง)

## 2. กฎเกณฑ์หลัก (Core Rules)

### 2.1 สิทธิ์ของคำสั่งซื้อ
- **ข้อกำหนดสถานะ**: เฉพาะคำสั่งซื้อที่มี `order_status = 'Returned'`
- **แหล่งข้อมูล**: ดึงข้อมูลจากตาราง `orders` และสถานะการคืนจาก `order_boxes` ในระบบ

### 2.2 ระบบแท็บ (Tabs System)
- **ยังไม่ตรวจสอบ (Pending)**: แสดงรายการสถานะ `Returned` ที่ยังไม่มีการระบุสถานะการคืนใน `order_boxes` (`return_status` IS NULL)
- **อยู่ระหว่างตรวจสอบ (Checking)**: **New Tab** แสดงรายการที่มีการตรวจสอบแล้ว **บางกล่อง** แต่ยังไม่ครบทุกกล่อง (Partial)
- **ตรวจสอบแล้ว (Verified)**: แสดงรายการที่ตรวจสอบ **ครบทุกกล่อง** แล้วเท่านั้น (`return_status` IS NOT NULL for all boxes)
  - **New Feature**: มีปุ่ม **"จัดการ"** เพื่อแก้ไขข้อมูล (สถานะ/หมายเหตุ) ภายหลังได้ โดยระบบจะดึงข้อมูล Order กลับมาให้แก้ไขใน Modal เดิม
  - **Grouping Display**: รายการจะถูกจัดกลุ่มตาม **Order ID** เดียวกัน เพื่อไม่ให้แสดงซ้ำซ้อน
    - คอลัมน์แรกแสดง **Order ID** (Main)
    - คอลัมน์ Tracking แสดงรายการ Tracking ทั้งหมดที่เกี่ยวข้อง พร้อมสถานะราย Tracking

### 2.3 ฟีเจอร์ "จัดการ" (Manage Feature) และการค้นหา
- **การค้นหา (Search)**:
  - มีช่องค้นหา **Tracking No.** ด้านบน เพื่อค้นหาและจัดการรายการแบบเจาะจง
    - **Bulk Search**: รองรับการค้นหาหลาย Tracking Number พร้อมกันโดยคั่นด้วยเครื่องหมายจุลภาค (`,`)
  - มีช่องค้นหา **Order ID** ด้านบน (ข้างช่อง Tracking)
    - ใช้ `listOrders({ orderId })` API ค้นหา
  - เมื่อค้นพบ ระบบจะเปิด Modal จัดการของ Order นั้นทันที
- **Modal จัดการ (Manage Modal)**:
  - **การแสดงผล**: แสดงแถวข้อมูลสำหรับจัดการตาม **Tracking Number** ที่ผูกไว้เท่านั้น
  - **Condition**: หากกล่องสินค้านั้นไม่มี Tracking Number จะไม่แสดงแถวให้จัดการ
  - **New: แสดงรายการสินค้า (Products)**: แสดงชื่อและจำนวนสินค้าที่อยู่ในกล่อง/Tracking นั้นๆ (อ้างอิงจาก Sub Order ID / Box Number)
  - **ดำเนินการรายบรรทัด**:
    - **Pending**: รอดำเนินการ
    - **Returning**: ตีกลับ (กำลังเดินทางกลับ)
      - บันทึกลง `order_boxes` (Status: returning)
      - **Auto-Update**: ระบบจะอัปเดต `order_boxes.status` = 'RETURNED' ทันที
    - **Returned**: รับของคืนแล้ว (เข้าคลัง)
      - บันทึกลง `order_boxes` (Status: returned)
      - **Auto-Update**: ระบบจะอัปเดต `order_boxes.status` = 'RETURNED' ทันที
    - **Delivered (ส่งสำเร็จ)**: กรณีส่งสินค้าถึงลูกค้าสำเร็จ (ไม่ได้ตีกลับ)
        - **New Field**: **ยอดที่เก็บได้ (Collected Amount)**: ระบุจำนวนเงินที่เก็บได้จากการส่งสำเร็จ
    - **Others (อื่นๆ)**: สถานะอื่นๆ ที่ไม่เข้าข่ายข้างต้น
    - **Note**: ช่องกรอกหมายเหตุ (Optional)

### 2.4 ข้อกำหนดของไฟล์นำเข้า (Import & Paste)
- รองรับ Import File (Excel/CSV) และ Paste Data (Ctrl+V)
- **รูปแบบข้อมูล**:
  - **Column A**: **Tracking Number**
  - **Column B**: Note
  - **New Feature**: เมื่อเลือกไฟล์ Import ระบบจะให้เลือกสถานะที่ต้องการนำเข้าทันที:
    - **Import ตีกลับ (Returning)**: สถานะเท่ากับ "ตีกลับ"
    - **Import เข้าคลังแล้ว (Returned)**: สถานะเท่ากับ "รับของคืนแล้ว"

### 2.5 ตรรกะการจับคู่และการบันทึก (Matching & Saving Logic)
1. **จับคู่ด้วย Tracking Number**: ความแม่นยำสูงสุด (รวมถึง Sub-tracking)
2. **การบันทึกทับ (Upsert)**: หากมีข้อมูล Tracking ID หรือ Sub Order ID เดิมอยู่ในระบบแล้ว ระบบจะทำการ **อัปเดตข้อมูล (Replace)** ด้วยข้อมูลใหม่จากไฟล์ทันที (เช่น เปลี่ยนสถานะ หรือแก้ไข Note)
3. **จับคู่ด้วย Order ID / Sub Order ID**: ถ้าตรงกับ Sub Order ID จะบันทึกได้แม่นยำรายกล่อง
4. **Race Condition Fix**: แก้ไขปัญหาการบันทึก Tracking Number สลับกล่อง โดยลำดับการทำงานใหม่ใน Backend ให้บันทึก Tracking หลังจากสร้าง/อัปเดต Box เรียบร้อยแล้ว

## 3. ขั้นตอนการทำงาน (Workflow)
1. **ค้นหาหรือเลือกรายการ**: ใช้ช่องค้นหา Tracking หรือเลือกจากรายการ Pending
2. **ตรวจสอบสินค้า**: ใน Modal ให้ดู Column "Products" ว่าสินค้าในกล่องนั้นคืออะไร ตรงกับของจริงหรือไม่
3. **กำหนดสถานะ**: เลือก Return, Delivered หรือ Others ราย Tracking
4. **บันทึก (Save)**: กดบันทึก
   - ระบบจะเก็บข้อมูลลงตาราง `order_boxes` (Update `return_status`, `return_note`, `collected_amount`, `return_created_at`)
   - **Crucial**: ระบบจะอัปเดตสถานะของ **Box** (`order_boxes.status`) เป็น **'RETURNED'** โดยอัตโนมัติ
   - **Important**: ระบบจะอัปเดตสถานะของ **Main Order** ในตาราง `orders` ให้เป็น **'Returned'** โดยอัตโนมัติ (หากมีการบันทึกสถานะใดๆ ก็ตามใน Modal นี้)

## 4. โครงสร้างฐานข้อมูล (Database Schema)

### ตาราง `order_boxes` (Updated for Return Management)
ใช้ตาราง `order_boxes` เดิมที่มีอยู่ แล้วเพิ่มคอลัมน์สำหรับจัดการการคืน เพื่อให้ข้อมูลผูกติดกับกล่องสินค้าโดยตรง

```sql
ALTER TABLE `order_boxes`
ADD COLUMN `return_status` varchar(50) COLLATE utf8mb4_unicode_ci NULL COMMENT 'สถานะการคืน: returning, returned, delivering, delivered, other',
ADD COLUMN `return_note` text COLLATE utf8mb4_unicode_ci NULL COMMENT 'หมายเหตุการคืน',
ADD COLUMN `return_created_at` datetime NULL COMMENT 'วันที่บันทึกการคืน',
ADD COLUMN `collected_amount` decimal(10,2) DEFAULT 0 COMMENT 'ยอดเงินที่เก็บได้ (กรณี Delivered)';
```

*(ตาราง `order_returns` เดิมถูกยกเลิกการใช้งานสำหรับฟีเจอร์นี้)*

## 5. อัปเดตล่าสุด (Change Log - 21/01/2026)
- **Grouped Verified View**: แสดงผลรายการใน Tab "ตรวจสอบแล้ว" ให้รวมกลุ่มตาม **Order ID** เพื่อลดความซ้ำซ้อน
  - **Tracking & Status**: แสดงรายการ Tracking ทั้งหมดใน Order นั้นๆ ในคอลัมน์เดียว โดยระบุสถานะแยกราย Tracking
- **UI Adjustments**:
  - เปลี่ยนคอลัมน์แรกจาก Sub Order ID เป็น **Order ID**
  - เพิ่มปุ่ม **Copy Order ID** ในทุกรายการ
  - ปรับขนาดปุ่ม Tab ให้กดง่ายขึ้น (Padding)
- **Fixes**: แก้ไข Syntax Error สำหรับการ Build Project

## 6. อัปเดตล่าสุด (Change Log - 22/01/2026)
- **Refined Data Fetching**: ปรับปรุงการดึงข้อมูล Tab "ยังไม่ตรวจสอบ" (Pending)
  - **Server-Side Filtering**: ใช้พารามิเตอร์ `returnMode=pending` ใน API เพื่อกรองเฉพาะคำสั่งซื้อที่ **ไม่มี** ในตาราง `order_returns` จาก Server โดยตรง (ลดการโหลดข้อมูลและแก้ปัญหาข้อมูลซ้ำซ้อน)
- **Enhanced Import Tool**:
  - **Already Verified Status**: เพิ่มสถานะ "ตรวจสอบแล้ว" (Badge สีฟ้า) ในเครื่องมือ Import/Paste สำหรับรายการที่เคยถูกบันทึกไปแล้ว (เดิมจะขึ้นว่า Not Found หรือซ้ำ) ทำให้แยกแยะได้ง่ายขึ้นว่ารายการไหนเป็นของใหม่ รายการไหนทำไปแล้ว

## 7. อัปเดตล่าสุด (Change Log - 26/01/2026)
- **Refactor to `order_boxes`**: เปลี่ยนโครงสร้างการเก็บข้อมูลจากตารางแยก `order_returns` มาเก็บในตาราง `order_boxes` โดยตรง
  - เพิ่มคอลัมน์ `return_status`, `return_note`, `return_created_at` ใน `order_boxes`
  - ย้ายข้อมูลเก่าจาก `order_returns` มายัง `order_boxes`

## 8. อัปเดตล่าสุด (Change Log - 05/02/2026)
- **Unrestricted Bulk Import (นำเข้าแบบไม่จำกัดเงื่อนไข)**:
  - **สถานะที่รองรับ**: รองรับการนำเข้าได้ทุกสถานะ:
    - **กำลังตีกลับ (Returning)**
    - **เข้าคลังแล้ว (Returned)**
    - **สภาพดี (Good)**
    - **เสียหาย (Damaged)**
    - **สูญหาย (Lost)**
  - **Logic การนำเข้า**:
    - **ตรวจสอบสถานะเดิม**:
      - หากสถานะเดิมเป็น **"รอดำเนินการ" (Pending)**: ระบบจะขึ้นสถานะ **"พร้อมอัปเดต"** (สีเขียว)
      - หากสถานะเดิมเป็น **อื่นๆ**: ระบบจะขึ้นสถานะ **"แจ้งเตือน" (Warning สีเหลือง)** พร้อมข้อความระบุสถานะปัจจุบัน และข้อความ **"(นำเข้าซ้ำได้)"** เพื่อให้ผู้ใช้ทราบว่ามีการดำเนินการไปแล้ว แต่ยังคงสามารถกดนำเข้าได้
    - **ปุ่มนำเข้า**: ปุ่มนำเข้าจะ **กดได้เสมอ** แม้ว่ารายการทั้งหมดจะเป็นสถานะแจ้งเตือน (สีเหลือง) ก็ตาม
    - **การบันทึก (Upsert)**: หากมีข้อมูลอยู่แล้วจะทำการอัปเดตสถานะทันที หากไม่มีจะสร้างรายการใหม่
- **Thai Language Support**:
  - ปรับเปลี่ยนข้อความในหน้า Bulk Import และข้อความแจ้งเตือนทั้งหมดเป็น **ภาษาไทย** เพื่อความเข้าใจง่าย
  - เปลี่ยนปุ่ม "Import" เป็น "**นำเข้าข้อมูล**"
  - เปลี่ยนสถานะ Badge เช่น "Ready" -> "**พร้อมนำเข้า**", "Unchecked" -> "**รอตรวจสอบ**"
  - ปรับปรุง Logic "Pending" ให้กรองจาก `order_boxes.return_status IS NULL`
  - ปรับปรุง Logic "Verified" ให้ดึงจาก `order_boxes.return_status IS NOT NULL`

## 8. อัปเดตล่าสุด (Change Log - 26/01/2026 - Part 2)
- **Status Options Cleanup**: ลบตัวเลือก "อยู่ระหว่างจัดส่ง" (Delivering) และ "จัดส่งสำเร็จ" (Delivered) ออกจากหน้า Modal (ภายหลัง User ขอเพิ่มกลับเข้ามา)

## 9. อัปเดตล่าสุด (Change Log - 28/01/2026)
- **3-State Return Logic**: ปรับปรุงสถานะเป็น 3 สถานะสำหรับ Tab:
    1. **Pending**: ยังไม่มีกล่องใดถูกตรวจสอบ
    2. **Checking (New)**: มีการตรวจสอบแล้วบางกล่อง แต่ยังไม่ครบ
    3. **Verified**: ตรวจสอบครบทุกกล่องแล้ว
- **Added "Others" Status**: เพิ่มตัวเลือกสถานะ "อื่นๆ" (Others) สำหรับกรณีที่ไม่เข้าข่ายสถานะปกติ
- **Added "Collected Amount"**: เพิ่มช่องกรอกยอดเงินที่เก็บได้ สำหรับสถานะ "ส่งสำเร็จ" (Delivered) และบันทึกลงฐานข้อมูลในฟิลด์ `collected_amount`
- **Auto Status Update**: เพิ่ม Logic ให้ระบบอัปเดตฟิลด์ `status` ในตาราง `order_boxes` เป็น **'RETURNED'** โดยอัตโนมัติ เมื่อมีการบันทึกสถานะการคืน (Returning/Returned) ผ่านหน้า Return Management
- **Confirmation Modal**: เพิ่มระบบยืนยัน (Confirmation Dialog) ก่อนทำการบันทึกข้อมูล เพื่อแจ้งสรุปจำนวนรายการที่จะถูกบันทึกและป้องกันการกดบันทึกโดยไม่ตั้งใจ
- **Thai Localization**: เปลี่ยน Headers และข้อความสถานะเป็นภาษาไทยทั้งหมด ("อยู่ระหว่างตีกลับ" -> "ตีกลับ")
- **Invalid Date Fix**: แก้ไขการแสดงผลวันที่ที่ขึ้น "Invalid Date" ให้ถูกต้อง โดยรองรับค่า `order_date` จาก API
- **Bulk Search Support**: รองรับการค้นหา Tracking Number หลายรายการพร้อมกัน (Comma-separated)
- **Import Tracking Fix**: แก้ไข Race Condition ใน Backend เพื่อให้ Tracking Number ผูกกับกล่องที่ถูกต้องเมื่อมีการ Import ข้อมูล

## 10. อัปเดตล่าสุด (Change Log - 05/02/2026 - Part 2)
- **Tab Expansion (6 Tabs)**: ขยาย Tab จาก 3 สถานะเป็น 6 สถานะ:
  1. **รอการดำเนินการ (Pending)**: สีเทา
  2. **กำลังตีกลับ (Returning)**: สีส้ม
  3. **เข้าคลัง (Returned)**: สีน้ำเงิน
  4. **สภาพดี (Good)**: สีเขียว
  5. **ชำรุด (Damaged)**: สีแดง
  6. **สูญหาย (Lost)**: สีเทา

- **Backend Pagination & Filtering**: 
  - อัปเดต `get_return_orders.php` ให้รองรับ `page`, `limit`, และ `status` parameters
  - คืนค่า `totalPages` สำหรับ pagination

- **Frontend Pagination**:
  - เพิ่ม Pagination Controls (Previous/Next Buttons, Page Display)
  - รีเซ็ตหน้าเป็น 1 เมื่อเปลี่ยน Tab

- **Status Badge Colors**: 
  - ปรับสี Badge ให้ตรงกับสี Tab:
    - **Returning**: Orange (`bg-orange-100`)
    - **Returned**: Blue (`bg-blue-100`)
    - **Good**: Green (`bg-green-100`)
    - **Damaged**: Red (`bg-red-100`)
    - **Lost/Pending**: Gray (`bg-gray-100`)
  - เปลี่ยนข้อความ Badge เป็นภาษาไทย (เช่น "กำลังตีกลับ", "เข้าคลัง")

- **Loading Spinner**: เพิ่ม Loading Overlay พร้อม Spinner Component เมื่อกำลังโหลดข้อมูล

- **API Fixes**:
  - แก้ไข `handleManageVerified` ให้ใช้ `getOrder(id)` ซึ่งเรียก API แบบ path parameter (`/orders/{id}`) แทน query parameter เพื่อค้นหา Order ที่ถูกต้อง

- **Sidebar Label**: เปลี่ยน Label จาก "Return Management" เป็น **"จัดการตีกลับ"** พร้อมอัปเดต Routing ใน `App.tsx`

## 11. อัปเดตล่าสุด (Change Log - 05/02/2026 - Part 3)
- **Company ID Filtering**: 
  - อัปเดต `get_return_orders.php` ให้รองรับ `companyId` parameter
  - กรองข้อมูลตาม `company_id` ของ Order เพื่อแสดงเฉพาะข้อมูลของบริษัทผู้ใช้
  - อัปเดต Frontend ให้ส่ง `user.companyId` เมื่อเรียก API

- **Permission Editor**: เพิ่ม **"เมนู จัดการตีกลับ (Return Management)"** ในหน้าตั้งค่าสิทธิ์ (`PermissionEditor.tsx`) ภายใต้กลุ่ม "จัดการขนส่ง (Tracking & Transport)"

- **UI Cleanup**: ลบปุ่ม **"Download Template"** ออกจากหน้าจัดการตีกลับ

## 12. อัปเดตล่าสุด (Change Log - 10/02/2026)
- **Backend API Migration to `order_boxes`**:
  - **`get_return_orders.php`**: เปลี่ยนจาก query `order_returns` เป็น `order_boxes` JOIN `order_tracking_numbers` + `orders`
    - Response format: `{status: "success", data: [...], pagination: {total, totalPages, page, limit}}`
  - **`save_return_orders.php`**: เปลี่ยนจาก INSERT/UPDATE `order_returns` เป็น UPDATE `order_boxes`
    - Resolve box ผ่าน `sub_order_id` หรือ `tracking_number → order_tracking_numbers → order_boxes`
  - **`validate_return_candidates.php`**: เปลี่ยนจาก query `order_returns` เป็น `order_tracking_numbers → order_boxes`
    - Payload: `{candidates: [{trackingNumber, index}], mode}` (ตรงกับ frontend)
    - Response: `{results: [{index, valid, message, subOrderId, foundStatus, isWarning}]}`

- **Business Rules สำหรับ `save_return_orders.php`**:
  - **Return statuses** (`returning`, `returned`, `good`, `damaged`, `lost`):
    - `collection_amount = 0`, `collected_amount = 0`
    - `order_boxes.status = 'RETURNED'`
    - ตั้งค่า `return_status`, `return_note`, `return_created_at`
  - **Undo statuses** (`pending`, `delivered` ฯลฯ):
    - `collection_amount = cod_amount` (restore ค่าเดิม)
    - `return_status = NULL`, `return_note = NULL`, `return_created_at = NULL` (ล้างข้อมูลการคืน)
    - `order_boxes.status = UPPER(status)` (เปลี่ยนกลับเป็นสถานะเดิม)
  - **Recalc `orders.total_amount`**: อัปเดตเฉพาะ `payment_method IN ('COD', 'PayAfter')` เท่านั้น

- **Deprecation**: ตาราง `order_returns` ไม่ถูกใช้จาก Backend API อีกต่อไป ข้อมูลทั้งหมดเก็บใน `order_boxes`

- **Auto Order Status Update**:
  - หลังบันทึกใน `save_return_orders.php` ระบบจะเช็คว่า **ทุกกล่อง** ของ order นั้นมี `status = 'RETURNED'` หรือไม่
  - ถ้าทุกกล่องเป็น RETURNED → auto-set `orders.order_status = 'Returned'`
  - ถ้ามีบางกล่องยังไม่เป็น RETURNED → ไม่อัปเดต orders

- **New API: `revert_returned_order.php`** (ยกเลิกสถานะ Returned ทั้ง Order):
  - **Payload**: `{ order_id: string, new_status: string }`
  - **Allowed statuses**: `Pending`, `AwaitingVerification`, `Confirmed`, `Preparing`, `Picking`, `Shipping`, `PreApproved`, `Delivered`, `Cancelled`, `Claiming`, `BadDebt`
  - **ทำงาน**:
    1. ตรวจสอบว่า `orders.order_status = 'Returned'` (ถ้าไม่ใช่จะ reject)
    2. อัปเดต `orders.order_status = new_status`
    3. ล้าง `order_boxes.return_status`, `return_note`, `return_created_at` เป็น NULL ทุกกล่อง
    4. อัปเดต `order_boxes.status = UPPER(new_status)` ทุกกล่อง
    5. Restore `order_boxes.collection_amount = cod_amount`
    6. Recalc `orders.total_amount` (เฉพาะ COD/PayAfter)

## 13. อัปเดตล่าสุด (Change Log - 10/02/2026 - Part 2)

### Revert Button (ปุ่มยกเลิกตีกลับ)
- เพิ่มปุ่ม **"ยกเลิกตีกลับ"** (RotateCcw icon) ที่ header ของ Order group ใน Tab "ตรวจสอบแล้ว"
- เมื่อกดจะเปิด **Revert Modal** ให้เลือกสถานะใหม่ของ Order:
  - `Pending`, `AwaitingVerification`, `Confirmed`, `Preparing`, `Picking`, `Shipping`, `รอตรวจสอบจากบัญชี`, `Delivered`, `Cancelled`, `Claiming`, `BadDebt`
- เรียก API `revert_returned_order.php` เพื่อยกเลิกสถานะ Returned ทั้ง Order

### Database Trigger Update
- แก้ไข trigger `order_boxes_before_update` ให้อนุญาตการเปลี่ยน `collection_amount` เมื่อ transition เข้า/ออกจากสถานะ `'RETURNED'`
- ก่อนหน้านี้ trigger block การเปลี่ยน `collection_amount` หลัง shipping ทำให้ return/revert flow ทำงานไม่ได้
- **Migration file**: `api/Database/20260210_allow_returned_collection_amount.sql`

### UI Locking (ล็อกตัวเลือก pending/delivered)
- เมื่อ **Order มี `order_status = 'Returned'`** (ทุกกล่องตีกลับครบแล้ว):
  - Radio button **"รอดำเนินการ"** และ **"ส่งสำเร็จ"** จะถูก **disabled**
  - แสดงไอคอน **`?`** (วงกลมแดง) พร้อม tooltip hover:
    > "Order นี้ตีกลับครบทุกกล่องแล้ว กรุณาใช้ปุ่ม "ยกเลิกตีกลับ" แทน"
  - ตัวเลือก return sub-statuses อื่นๆ (กำลังตีกลับ, เข้าคลัง, สภาพดี, เสียหาย, สูญหาย) ยังเลือกได้ปกติ

### Backend: Save Logic Refinement
- **`save_return_orders.php`**: ปรับปรุงเงื่อนไขการบล็อก
  - **บล็อกเฉพาะ** `pending` / `delivered` (undo statuses) เมื่อทุกกล่องเป็น RETURNED
  - **อนุญาต** การเปลี่ยน return sub-statuses (`returning` → `returned` → `good` → `damaged` → `lost`) แม้ทุกกล่องจะเป็น RETURNED แล้ว

### Frontend: Error Handling
- ปรับปรุงการแสดง alert เมื่อบันทึก:
  - ❌ `updatedCount === 0` + มี errors → แสดง error ทั้งหมด
  - ⚠️ `updatedCount > 0` + มี errors → แสดงจำนวนสำเร็จ + errors
  - ✅ ไม่มี errors → แสดงจำนวนที่อัปเดตสำเร็จ

### Backend: `return_status` & `return_note` ใน Orders API
- เพิ่ม `return_status` และ `return_note` ใน SELECT query ของ `order_boxes`:
  - **List Orders API** (`index.php` listOrders): เพิ่มใน boxesMap
  - **Single Order API** (`index.php` getOrder): เพิ่มใน boxes query
- **Frontend**: เพิ่ม fallback logic ใน `useEffect` ที่สร้าง `manageRows`:
  - เมื่อไม่พบ match ใน `verifiedOrders` → ตรวจ `managingOrder.boxes` แทน
  - ถ้า box มี `return_status` → pre-fill สถานะและ note ให้ถูกต้อง
  - แก้ปัญหาที่ค้นหาจาก Tracking No. แล้วสถานะแสดงเป็น "pending" ทั้งหมด

## 14. อัปเดต: การอัปเดตออเดอร์จาก Modal กับผลกระทบต่อระบบตีกลับ (10/02/2026)

### Per-Box `cod_amount` Calculation (Transfer / PayAfter)

**ก่อนหน้านี้**: เมื่อสร้างหรือแก้ไขออเดอร์ที่ `paymentMethod` เป็น `Transfer` หรือ `PayAfter` ระบบจะกำหนด `codAmount` ทั้งหมดไปที่กล่องแรก (Box 1 = totalAmount, Box อื่น = 0)

**แก้ไขใหม่**: คำนวณ `codAmount` ต่อกล่องจาก items ที่อยู่ในกล่องนั้น:
```
codAmount = Σ (pricePerUnit × quantity - discount) ของ items ในกล่อง
```

**ไฟล์ที่แก้ไข**:
- **`pages/CreateOrderPage.tsx`**: คำนวณ `codAmount` ต่อกล่อง (POST สร้างใหม่)
- **`components/OrderManagementModal.tsx`**: คำนวณ `codAmount` + ตรวจสอบ RETURNED status (PUT อัปเดต)
- **`api/index.php`** (PUT handler): แยก `cod_amount` กับ `collection_amount` เป็นคนละค่า

### การป้องกัน RETURNED Box (OrderManagementModal → PUT)

เมื่ออัปเดตออเดอร์ผ่าน Modal หากกล่องมี `order_boxes.status = 'RETURNED'`:

| ฟิลด์ | พฤติกรรม |
|---|---|
| `cod_amount` | ✅ อัปเดตตามค่าที่คำนวณจาก items |
| `collection_amount` | ❌ **ไม่อัปเดต** — ใช้ค่าเดิมจาก DB |
| `return_status` | ❌ **ไม่ถูกแตะต้อง** — UPDATE query ไม่ include ฟิลด์นี้ |
| `return_note` | ❌ **ไม่ถูกแตะต้อง** — UPDATE query ไม่ include ฟิลด์นี้ |
| `status` | ❌ **ไม่ถูกแตะต้อง** — ใช้ `COALESCE(status, 'PENDING')` |

หากกล่อง `status != 'RETURNED'`:
- อัปเดตทั้ง `cod_amount` และ `collection_amount` ตามค่าใหม่ที่คำนวณจาก items

### Backend PUT Handler (`api/index.php`) — Non-COD Box Logic

**ก่อนหน้านี้** (เดิม):
```php
// Force: Box 1 = $totalAmount, Box อื่น = 0
if ($num === 1) { $boxData['collection_amount'] = $totalAmount; }
else { $boxData['collection_amount'] = 0.0; }
```

**แก้ไขใหม่**:
```php
// ตรวจสอบ status จาก DB
if ($dbStatus === 'RETURNED') {
    // Preserve collection_amount จาก DB, อัปเดตเฉพาะ cod_amount
    $boxData['collection_amount'] = (float) $existingBoxRow['collection_amount'];
} else {
    // Non-RETURNED: set collection_amount = cod_amount จาก frontend
    $boxData['collection_amount'] = $boxData['cod_amount'];
}
```

- UPDATE/INSERT query ใช้ `$box['cod_amount']` แยกจาก `$box['collection_amount']` (เดิมใช้ `collection_amount` ทั้งคู่)

## 15. อัปเดต: Bulk Import ไร้เงื่อนไข + แสดง Warning ภาษาไทย (11/02/2026)

### ไฟล์ที่แก้ไข
- **`api/Orders/validate_return_candidates.php`**

### การเปลี่ยนแปลง

**ก่อนหน้านี้**: Bulk import มีเงื่อนไข `return_status` ตาม mode:
- `returning` → ต้อง `return_status = NULL` เท่านั้น
- `returned` → ต้อง `return_status` ไม่เป็น `NULL` และไม่เป็น `returned`

**แก้ไขใหม่**: 
- ✅ ทุก tracking number ที่เจอในระบบและมี order box = **valid ทันที** ไม่ว่า `return_status` จะเป็นค่าใดก็ตาม
- ⚠️ ถ้า `return_status != NULL` → แสดง **warning** เป็นภาษาไทย: `"เลข Tracking มีสถานะเป็น \"xxx\""` (ยังคง import ได้)

### Status Map (English → Thai)
| DB Value | Thai Label |
|---|---|
| `returning` | กำลังตีกลับ |
| `returned` | เข้าคลังแล้ว |
| `good` | สภาพดี |
| `damaged` | เสียหาย |
| `lost` | สูญหาย |

### Frontend (`BulkReturnImport.tsx`)
- ไม่ต้องแก้ไข — รองรับ `isWarning` อยู่แล้ว
- แสดง ⚠️ สีเหลือง + ข้อความเตือน
- ปุ่ม "นำเข้าข้อมูล" ยังใช้งานได้เมื่อมี warning

## 16. อัปเดต: Export ข้อมูลตีกลับ (13/02/2026)

### ภาพรวม
เพิ่มฟีเจอร์ Export CSV สำหรับข้อมูลกล่องที่มี `order_boxes.status = 'RETURNED'` โดยเลือกช่วงวันที่ได้ (กรองจาก `orders.order_date`)

### ไฟล์ที่เกี่ยวข้อง
- **Backend**: `api/Orders/export_return_orders.php` [NEW]
- **Frontend**: `pages/ReturnManagementPage.tsx` (เพิ่ม Export UI)
- **API Service**: `services/api.ts` (เพิ่ม `exportReturnOrders`)
- **Component**: ใช้ `components/DateRangePicker.tsx` สำหรับเลือกช่วงวันที่

### Backend API (`export_return_orders.php`)
- **Filter**: `order_boxes.status = 'RETURNED'`
- **Date Range**: กรองจาก `DATE(orders.order_date)`
- **Parameters**: `date_from`, `date_to`, `companyId`
- **JOINs**: `order_boxes` → `order_tracking_numbers` → `orders` → `customers` → `users` (via `orders.creator_id`)
- ไม่มี pagination — ดึงทั้งหมดสำหรับ export

### คอลัมน์ใน CSV

| Header | Source |
|---|---|
| Order ID | `ob.order_id` |
| Sub Order ID | `ob.sub_order_id` |
| วันที่สั่งซื้อ | `o.order_date` |
| ชื่อจริง (ลูกค้า) | `c.first_name` |
| นามสกุล (ลูกค้า) | `c.last_name` |
| เบอร์โทร | `c.phone` |
| Tracking No. | `otn.tracking_number` |
| สถานะตีกลับ | `ob.return_status` (แปลเป็นภาษาไทย) |
| หมายเหตุ | `ob.return_note` |
| ราคากล่อง | `ob.cod_amount` |
| ยอดเก็บได้ | `ob.collection_amount` |
| วันที่บันทึกตีกลับ | `ob.return_created_at` |
| สถานะกล่อง | `ob.return_status` (แปลเป็นภาษาไทย) |
| ช่องทางชำระ | `o.payment_method` |
| ที่อยู่ | `o.street` |
| แขวง/ตำบล | `o.subdistrict` |
| เขต/อำเภอ | `o.district` |
| จังหวัด | `o.province` |
| รหัสไปรษณีย์ | `o.postal_code` |
| ชื่อผู้ขาย | `u.first_name` |
| นามสกุลผู้ขาย | `u.last_name` |
| ตำแหน่งผู้ขาย | `u.role` |
| ยอดเต็ม | `SUM(ob2.cod_amount) WHERE ob2.order_id = ob.order_id` |
| ยอดคงเหลือ | `SUM(ob2.collection_amount) WHERE ob2.order_id = ob.order_id` |

### Status Map (สถานะภาษาไทยใน CSV)
| DB Value | Thai Label |
|---|---|
| `returning` | กำลังตีกลับ |
| `returned` | เข้าคลัง |
| `good` | สภาพดี |
| `damaged` | ชำรุด |
| `lost` | สูญหาย |
| `pending` | รอการดำเนินการ |
| `delivered` | ส่งสำเร็จ |

### DateRangePicker Component
- ใช้ `components/DateRangePicker.tsx` ที่มีอยู่
- มี preset: วันนี้, เมื่อวาน, 7/30/60/90 วันย้อนหลัง, **เดือนนี้**, **เดือนที่แล้ว**
- Default: 30 วันย้อนหลัง
- CSV ใส่ BOM (`\uFEFF`) เพื่อรองรับ Excel ภาษาไทย

## 17. อัปเดตล่าสุด (Change Log - 02/03/2026)

### Date Range Filters (ตัวกรองช่วงวันที่)
- **ตัวกรองวันที่สั่งซื้อ** (`orders.order_date`):
  - ใช้ `DateRangePicker` component
  - **Default = เดือนปัจจุบัน** (เมื่อเข้าหน้ามาครั้งแรก)
  - Checkbox "ทั้งหมด" ใต้ตัวกรอง → ไม่กรองวันที่สั่งซื้อ
- **ตัวกรองวันที่ลงตีกลับ** (`order_boxes.return_created_at`):
  - ใช้ `DateRangePicker` component
  - **Default = ทั้งหมด** (ไม่กรอง, checkbox ติ๊กไว้)
  - Checkbox "ทั้งหมด" ใต้ตัวกรอง → ไม่กรองวันที่ลงตีกลับ
- เมื่อเลือกช่วงวันที่ใหม่ → checkbox "ทั้งหมด" จะถูก uncheck อัตโนมัติ
- เปลี่ยน filter จะ reset pagination กลับหน้า 1

### Tab Counts สัมพันธ์กับ Filter วันที่
- **`get_return_stats.php`**: เพิ่ม parameters `orderDateFrom`, `orderDateTo`, `returnDateFrom`, `returnDateTo`
- **`api.ts`**: `getReturnStats` เปลี่ยนเป็นรับ object params (เดิมรับแค่ `companyId`)
- **Frontend**: `fetchReturnStats` ส่ง date params เดียวกับ `fetchVerifiedOrders` + useEffect trigger เมื่อเปลี่ยน filter
- **Loading Spinner บน Tab**: แสดง spinner เล็กๆ ข้างชื่อ Tab ขณะโหลดจำนวนรายการ

### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `api/Orders/get_return_orders.php` | เพิ่ม 4 params: `orderDateFrom/To`, `returnDateFrom/To` |
| `api/Orders/get_return_stats.php` | เพิ่ม 4 params เดียวกัน |
| `services/api.ts` | อัปเดต `getReturnOrders` + `getReturnStats` |
| `pages/ReturnManagementPage.tsx` | เพิ่ม state, DateRangePicker UI, checkbox, spinner |

## 18. อัปเดตล่าสุด (Change Log - 09/03/2026)

### Return Complete & Claim Feature
เพิ่มฟีเจอร์ "ยืนยันจบเคส" และ "เคลม" สำหรับระบบจัดการตีกลับ

#### Database
- เพิ่ม 2 คอลัมน์ใน `order_boxes`:
  - `return_complete` TINYINT(1) DEFAULT 0 — จบเคสแล้ว (สำหรับสภาพดี)
  - `return_claim` DECIMAL(10,2) — จำนวนเงินเคลม (สำหรับเสียหาย/สูญหาย)
- **Migration**: `api/Database/20260309_add_return_complete_claim.sql`

#### Business Rules

| สถานะ | ฟีเจอร์ใหม่ | ฟิลด์ |
|---|---|---|
| สภาพดี (`good`) | ✅ ยืนยันจบเคส (checkbox) | `return_complete = 1` |
| เสียหาย (`damaged`) | 💰 เคลม (input จำนวนเงิน) | `return_claim = จำนวนเงิน` |
| สูญหาย (`lost`) | 💰 เคลม (input จำนวนเงิน) | `return_claim = จำนวนเงิน` |

- เมื่อ Undo (pending/delivered) → `return_complete = 0`, `return_claim = NULL`

#### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `api/Database/20260309_add_return_complete_claim.sql` | [NEW] Migration เพิ่มคอลัมน์ |
| `api/Orders/save_return_orders.php` | รับ return_complete/return_claim จาก payload, SET ใน return flow, CLEAR ใน undo flow |
| `api/Orders/get_return_orders.php` | เพิ่ม return_complete, return_claim ใน SELECT query |
| `pages/ReturnManagementPage.tsx` | เพิ่ม UI: checkbox จบเคส (good), input เคลม (damaged/lost), badge ใน VerifiedListTable |

### Bulk Import: Extra Column Support
- **Import สภาพดี (good)**: เพิ่มคอลัมน์ B สำหรับกำหนด "จบเคส" (dropdown: ยังไม่จบ / จบเคส)
  - รองรับ Paste ค่า: `1`, `true`, `yes`, `จบ`, `จบเคส`, `y` = จบเคส | อื่นๆ = ยังไม่จบ
- **Import เสียหาย/สูญหาย (damaged/lost)**: เพิ่มคอลัมน์ B สำหรับจำนวนเงินเคลม (number input)
- **Paste Support**: วาง 2 คอลัมน์ (Tab/Comma separated) → คอลัมน์ A = Tracking, คอลัมน์ B = Extra value

#### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `components/BulkReturnImport.tsx` | เพิ่ม extraValue, Column B UI, parseReturnComplete helper, enriched payload |

## 19. อัปเดตล่าสุด (Change Log - 09/03/2026 - Part 2)

### UI Renovation — ปรับปรุง UI ทั้งหน้า Return Management

ปรับปรุง UI ครั้งใหญ่เพื่อให้ดูทันสมัย สวยงาม ใช้งานง่ายขึ้น ไม่มีการแก้ไข API หรือ logic ใดๆ (ยกเว้น backend fix `cod_amount`)

#### 1. Header Card (Title)
- เปลี่ยนเป็น **White/Light Theme** (`bg-white`, `border-gray-200`, `shadow-sm`)
- Icon badge สี sky-blue (`bg-sky-100`)
- Search input ใช้ `bg-gray-50` กับ `rounded-xl`

#### 2. Export Bar → Dropdown Button
- **ลบ** แถบ Export bar เดิม (อยู่แยกแถวของตัวเอง)
- **ย้าย** ไปเป็นปุ่ม **Export** สีฟ้า (`bg-sky-600`) ข้างปุ่ม Import ใน header
- กดแล้วเปิด **popup dropdown** (`absolute`, `z-50`, `w-[380px]`) ให้เลือกช่วงเวลา + กด Export CSV
- ปุ่ม Import ย่อข้อความเป็น "Import" (จาก "Import Tracking")

#### 3. Tab Bar
- เปลี่ยนเป็น **Pill-shaped buttons** ใน container `bg-gray-100 rounded-xl`
- แต่ละ tab มี emoji icon: ⏳ 🚚 ✅ ⚠️ ❌
- Active tab fill สีตามสถานะ (orange, emerald, rose, gray)
- Count badges ใช้ `bg-white/30` บน active state
- Loading state แสดง spinner เล็กข้าง label

#### 4. Filter Bar
- Consolidated เป็น compact inline row
- Date pickers อยู่ข้างกัน คั่นด้วย vertical divider
- Checkbox label ย่อเป็น "ทั้งหมด"

#### 5. Table (VerifiedListTable) — คอลัมน์ใหม่
- Order cards มี **sky-blue left accent bar** (`bg-sky-500`)
- **ลบ** badge "ยอดบิล" ออก (เพราะ `orders.total_amount` ไม่ reliable)

| คอลัมน์ | แหล่งข้อมูล | หมายเหตุ |
|---|---|---|
| Tracking No. | `otn.tracking_number` | font-mono |
| Sub Order | `ob.sub_order_id` | font-mono |
| **ราคากล่อง** (ใหม่) | `ob.cod_amount as return_amount` | จัดชิดขวา, แสดง ฿xxx |
| สถานะ | `ob.return_status` | Pill badge + emoji |
| **รายละเอียด** (ใหม่) | หลายฟิลด์ | แสดงเป็น inline badges: |
| | `ob.return_complete` | ✅ จบเคส (สีเขียว) |
| | `ob.return_claim` | 💰 เคลม ฿xxx (สีเหลือง) |
| | `ob.return_note` | 📝 หมายเหตุ |
| วันที่อัปเดต | `ob.updated_at` | |
| จัดการ | — | ปุ่ม "ตรวจสอบ" |

- Empty state: 📦 + ข้อความ + คำแนะนำ
- Pagination: sky-blue page number, modern controls

#### 6. Manage Modal — Card-Based Layout (ปรับ layout ใหม่ทั้งหมด)
- เปลี่ยนจาก **Table layout** → **Card-based layout** (แยกราย Sub Order ID)
- **Header**: Light theme สีขาว + subtitle "แยกราย Sub Order ID"
- **Order info bar**: badges แสดง Order ID, รวม ฿0, Sub Orders count, จำนวนรายการ
- **แต่ละ Card**:
  - Left border accent color ตามสถานะ: orange(returning), emerald(good), rose(damaged), gray(lost), blue(delivered)
  - Header: Tracking No. (font-mono bold) + Sub Order ID badge + **ราคากล่อง badge** (`bg-sky-50 text-sky-700`) + จบเคส badge + เคลม badge
  - Product items แสดงเป็น rounded chips
  - **Status selection**: Pill-style buttons (ไม่ใช่ radio) — กดเพื่อเลือกสถานะ
  - Note input inline ใต้ status pills
  - Claim input แสดงเมื่อเลือก damaged/lost
- **Footer**: แสดงจำนวนรายการเปลี่ยนแปลง + ปุ่ม ยกเลิก/บันทึก

#### 7. Backend Fix — ราคากล่อง
- **`get_return_orders.php`**: เปลี่ยนจาก `ob.collected_amount` → `ob.cod_amount` as `return_amount`
- **เหตุผล**: `collected_amount` จะถูกอัปเดตเป็น 0 เมื่อ import tracking ว่ากล่องตีกลับ ทำให้ราคาแสดงเป็น 0
- `cod_amount` คือราคา COD ดั้งเดิมของกล่อง ไม่ถูกเปลี่ยนแปลง

#### 8. ManageRow Interface — เพิ่ม `boxPrice`
- เพิ่ม field `boxPrice?: number` ใน `ManageRow` interface
- Merge logic ดึงค่าจาก `verified.return_amount` หรือ `matchedBox.cod_amount`
- แสดงเป็น badge สีฟ้าบน modal cards

#### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `pages/ReturnManagementPage.tsx` | UI renovation ทั้งหน้า: header, tabs, filters, table, modal, export dropdown |
| `api/Orders/get_return_orders.php` | เปลี่ยน `collected_amount` → `cod_amount` สำหรับ return_amount |

## 20. อัปเดต (Change Log - 10/03/2026)

### VerifiedListTable — เปลี่ยนจาก Grouped Cards → Single Flat Table

เปลี่ยน layout ตารางแสดงรายการตีกลับจาก **Card แยกตาม Order** เป็น **ตารางเดียว (Flat Table)** ทุกรายการรวมอยู่ในตารางเดียวกัน

#### Checkbox + Bulk Case-Closed
- เพิ่มคอลัมน์ **Checkbox** ทุกแถว + **Check-all** ที่ header (รองรับ indeterminate state)
- **แสดงเฉพาะ Tab "✅ สภาพดี" (`good`)** เท่านั้น — tab อื่นไม่แสดง checkbox
- State: `selectedIds: Set<number>`, `bulkSaving: boolean`
- เมื่อเลือกรายการ → แสดง **Bulk Action Bar** ข้าง pagination:
  - จำนวนที่เลือก + ปุ่ม "ยืนยันจบเคส" (สีเขียว) + ปุ่ม "ยกเลิก"
- `handleBulkCaseClosed()` → เรียก `saveReturnOrders` พร้อม `return_complete: 1` ทุกรายการที่เลือก
- หลัง save สำเร็จ → clear selection + refresh data

#### เพิ่มคอลัมน์ Order ID
- เพิ่มคอลัมน์ **Order ID** (ใช้ `main_order_id`) — คลิกเพื่อเปิด Order Detail Modal
- แสดงวันที่สั่งซื้อ (`order_date`) เป็นข้อความเล็กใต้ Order ID

#### Row Highlight
- แถวที่ถูก check จะ highlight พื้น `bg-sky-50/60`

### Pending Tab — แก้สี Active State
- เปลี่ยน `activeBg` จาก `bg-white` → `bg-gray-600`
- ก่อนหน้า: active tab สีขาว + text ขาว = มองไม่เห็น

## 21. Multi-Tracking Same Box — Backend Dedup (10/03/2026)

### สาเหตุปัญหา
1 กล่อง (`order_boxes`) สามารถมี **2+ tracking numbers** ได้ (เช่น ย้ายรอบส่ง)
ใน `order_tracking_numbers` tracking หลายเลขอาจ `box_number` เดียวกัน

### แก้ไข: `save_return_orders.php`
เพิ่ม **deduplication** — เมื่อ 2 tracking resolve ไป `box_id` เดียวกัน จะ update **แค่ครั้งเดียว** (row แรกชนะ):

```php
$processedBoxIds = []; // Track already-processed box IDs

// ภายใน loop:
if (in_array($boxRow['id'], $processedBoxIds)) {
    continue; // Already updated this box
}
$processedBoxIds[] = $boxRow['id'];
```

- ป้องกัน redundant UPDATE บน row เดียวกัน
- `updatedCount` นับถูกต้อง (ไม่นับซ้ำ)

#### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `pages/ReturnManagementPage.tsx` | เปลี่ยน grouped cards → flat table, เพิ่ม checkbox/check-all, bulk case-closed, fix pending tab color |
| `api/Orders/save_return_orders.php` | เพิ่ม `$processedBoxIds` dedup logic สำหรับ multi-tracking same box |

## 22. Return Image Upload (10/03/2026)

เพิ่มความสามารถอัปโหลดรูปพัสดุตีกลับ (เช่น เสียหาย) ผูกกับ `sub_order_id`

### Database
- ตาราง `return_images` (id, sub_order_id, filename, url, created_at)
- Migration: `api/Database/20260310_create_return_images.sql`

### Backend APIs
| ไฟล์ | Method | หน้าที่ |
|---|---|---|
| `api/Orders/upload_return_image.php` | POST (FormData) | อัปโหลดรูป → `api/uploads/returns/` + INSERT DB |
| `api/Orders/get_return_images.php` | GET | ดึงรูปตาม sub_order_id |
| `api/Orders/delete_return_image.php` | POST | ลบรูป (file + DB) |

### Frontend
- **API functions** (`services/api.ts`): `uploadReturnImage`, `getReturnImages`, `deleteReturnImage`
- **`ReturnImageGallery`** component (inline ใน `ReturnManagementPage.tsx`)
  - แสดง thumbnail grid (56x56px) + ปุ่ม "📷 อัปโหลด"
  - Upload instant ผ่าน hidden file input (accept images)
  - Hover thumbnail → ปุ่มลบ (กากบาทแดง)
  - คลิก thumbnail → Lightbox แสดงรูปเต็ม
  - แสดงใน Manage Modal ทุก Card ที่มี subOrderId
  - **URL Resolution**: ใช้ `resolveImgUrl()` helper เพื่อแปลง relative URL จาก DB (`/CRM_ERP_V4/api/uploads/returns/...`) เป็น URL ที่ใช้งานได้ทั้งบน Vite dev server (ผ่าน proxy) และ production

## 23. Order ID Search (10/03/2026)

เพิ่มช่องค้นหา **Order ID** ข้างช่อง Tracking No. ใน Header

- ใช้ `listOrders({ orderId, companyId, pageSize: 1 })` แทน `getOrder()` (เพราะ `getOrder` ผ่าน index.php router ที่ return format ไม่ตรง)
- กด Enter หรือคลิกปุ่ม 🔍 → เปิด Manage Modal ทันที
- ปุ่ม search กลาง: ถ้ามี tracking ค้น tracking ก่อน, ถ้าว่างค้น order_id

#### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `pages/ReturnManagementPage.tsx` | เพิ่ม `searchOrderId` state + `handleSearchByOrderId()` + UI input |

## 24. Page Size Selector + Backend Limit (10/03/2026)

### Frontend
- เพิ่ม dropdown เลือก page size: **50, 100, 200, 500, 1000, 2000**
- อยู่ข้าง pagination buttons (< page >)
- เปลี่ยน size → reset page = 1 + re-fetch อัตโนมัติ
- เพิ่ม `pagination.limit` ใน useEffect dependency array

### Backend
- `get_return_orders.php`: เพิ่ม limit cap จาก `min(100)` → `min(2000)`, default จาก 20 → 50

## 25. Advanced Filters (10/03/2026)

เพิ่มระบบตัวกรองเพิ่มเติม (collapsible panel) ใต้แถบวันที่

### ตัวกรอง 6 รายการ
| ตัวกรอง | Param | ค่า |
|---|---|---|
| สถานะเคส | `caseStatus` | `''` / `'open'` / `'closed'` |
| การเคลม | `hasClaim` | `''` / `'yes'` / `'no'` |
| ยอดเคลม (฿) | `claimMin`, `claimMax` | ตัวเลข |
| ราคากล่อง (฿) | `amountMin`, `amountMax` | ตัวเลข |
| รูปภาพ | `hasImage` | `''` / `'yes'` / `'no'` (subquery return_images) |
| หมายเหตุ | `hasNote` | `''` / `'yes'` / `'no'` |

### UI
- ปุ่ม "ตัวกรองเพิ่มเติม" + badge จำนวน filter ที่ active
- แผง collapsible: dropdowns + number inputs + ปุ่ม "กรอง" / "ล้างตัวกรอง"

#### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `api/Orders/get_return_orders.php` | เพิ่ม WHERE conditions สำหรับ 6 filters |
| `services/api.ts` | เพิ่ม params ใน `getReturnOrders()` |
| `pages/ReturnManagementPage.tsx` | เพิ่ม state `advFilters`, UI panel, wire to API |

## 26. Case-Closed Business Rule (10/03/2026)

### กฎ: จบเคส (`return_complete=1`) ทำได้เฉพาะสถานะ `good` เท่านั้น

- `save_return_orders.php`: ก่อน UPDATE จะเช็ค `if ($status !== 'good') → $returnComplete = 0`
- ผล: หากเปลี่ยนจาก `good` → `damaged`/`lost`/`returning` → `return_complete` ถูก reset เป็น 0 อัตโนมัติ
- undo flow (pending/delivered) ก็ reset เป็น 0 เช่นกัน (logic เดิม)

## 27. Git Ignore Uploads (10/03/2026)

- สร้าง `api/uploads/.gitignore` เพื่อ ignore ไฟล์อัปโหลดทั้งหมด (slips, returns)
- เก็บเฉพาะ `.gitignore` ไว้เพื่อรักษาโครงสร้างโฟลเดอร์ใน repo

## 28. Import Notes Column — หมายเหตุทุกสถานะ (11/03/2026)

### การเปลี่ยนแปลง
เพิ่มคอลัมน์ **หมายเหตุ (Note)** ในหน้า Bulk Import ให้ใช้ได้ทุก mode (returning, returned, good, damaged, lost)

### รูปแบบคอลัมน์ใหม่

| Column | เดิม | ใหม่ |
|--------|------|------|
| A | เลข Tracking | เลข Tracking |
| B | extra value (เฉพาะ good/damaged/lost) | **หมายเหตุ** (ทุก mode) |
| C | — | extra value (เฉพาะ good/damaged/lost) |

### Paste Support
- วาง 2 คอลัมน์: `Tracking [TAB/,] หมายเหตุ`
- วาง 3 คอลัมน์: `Tracking [TAB/,] หมายเหตุ [TAB/,] extra`
- หมายเหตุจะถูกส่งในฟิลด์ `note` ของ payload

### ไฟล์ที่แก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `components/BulkReturnImport.tsx` | เพิ่ม `note` ใน RowData, คอลัมน์หมายเหตุหลัง Tracking, ปรับ paste/import logic |

## 29. Export ตีกลับใน ReportsPage (หน้ารายงาน)

### ภาพรวม
นอกจาก Export ใน `ReturnManagementPage` แล้ว ยังมี **Export ตีกลับ** อีกจุดหนึ่งในหน้า **รายงาน** (`pages/ReportsPage.tsx`) — report card ชื่อ **"รายงานตีกลับเข้าคลัง"** (`return-summary`)

### ไฟล์ที่เกี่ยวข้อง
| ไฟล์ | บทบาท |
|---|---|
| `pages/ReportsPage.tsx` | UI Dashboard + Export CSV |
| `api/Orders/get_return_summary.php` | สรุปจำนวนออเดอร์/กล่องตีกลับตามสถานะ |
| `api/Orders/export_return_orders.php` | **API เดียวกัน** กับหน้า ReturnManagement |

### Dashboard Summary (แสดงเมื่อเลือก report card)
ดึงข้อมูลจาก `get_return_summary.php` พร้อม date filter

| Card | ข้อมูล |
|---|---|
| ออเดอร์ทั้งหมด | `allOrders` |
| ออเดอร์ตีกลับ | `totalOrders` |
| % ตีกลับ | `totalOrders / allOrders × 100` |
| จำนวนกล่องทั้งหมด | `totalBoxes` |
| กำลังตีกลับ | `returning` |
| เข้าคลัง (รวม) | `good + damaged` |
| สภาพดี | `good` |
| ชำรุด | `damaged` |
| สูญหาย | `lost` |

### Export CSV
- กดปุ่ม **"ดาวน์โหลด CSV"** → เรียก `export_return_orders.php` (API เดียวกับ ReturnManagement)
- Group rows ตาม `order_id + box_number` — แถวแรกของกลุ่มแสดงข้อมูล box, แถวถัดไปแสดงเฉพาะ items
- **สถานะตีกลับ แสดงทุกแถว** (ไม่ใช่เฉพาะแถวแรก)

| คอลัมน์ CSV | แหล่งข้อมูล | แสดง |
|---|---|---|
| Order ID | `r.order_id` | แถวแรก |
| Sub Order ID | `r.sub_order_id` | แถวแรก |
| วันที่สั่งซื้อ | `r.order_date` | แถวแรก |
| ชื่อลูกค้า | `r.customer_first_name + last_name` | แถวแรก |
| เบอร์โทร | `r.customer_phone` | แถวแรก |
| ที่อยู่ | `r.shipping_street` | แถวแรก |
| แขวง/ตำบล | `r.shipping_subdistrict` | แถวแรก |
| เขต/อำเภอ | `r.shipping_district` | แถวแรก |
| จังหวัด | `r.shipping_province` | แถวแรก |
| รหัสไปรษณีย์ | `r.shipping_postal_code` | แถวแรก |
| Tracking No. | `r.tracking_number` | แถวแรก |
| สถานะตีกลับ | `r.return_status` (ไทย) | **ทุกแถว** |
| หมายเหตุ | `r.return_note` | แถวแรก |
| ราคากล่อง | `r.cod_amount` | แถวแรก |
| ยอดเก็บได้ | `r.collection_amount` | แถวแรก |
| ชื่อสินค้า | `r.item_product_name` | ทุกแถว |
| จำนวน | `r.item_quantity` | ทุกแถว |
| ผู้ขาย | `r.item_creator_first_name` (item-level) | ทุกแถว |
| วันที่บันทึก | `r.return_created_at` | แถวแรก |
| ช่องทางชำระ | `r.payment_method` | แถวแรก |

### ข้อแตกต่างจาก Export ใน ReturnManagementPage

| | ReturnManagementPage | ReportsPage |
|---|---|---|
| API | `export_return_orders.php` | **เดียวกัน** |
| CSV format | สร้างจาก Backend (PHP) | สร้างจาก **Frontend** (JS) |
| คอลัมน์ | 22 คอลัมน์ | 20 คอลัมน์ (รวมที่อยู่+สินค้า+ผู้ขาย) |
| Grouping | ไม่ group | Group ตาม order_id+box_number |
| Date filter | DateRangePicker component | Preset dropdown (วันนี้/สัปดาห์/เดือน/custom) |
