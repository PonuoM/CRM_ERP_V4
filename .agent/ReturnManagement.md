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
