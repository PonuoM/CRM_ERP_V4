# กฎเกณฑ์และขั้นตอนการทำงานของระบบจัดการการตีกลับ (Return Management)

## 1. ภาพรวม
โมดูลจัดการการตีกลับ (Return Management) ออกแบบมาเพื่อติดตาม ตรวจสอบ และกระทบยอดคำสั่งซื้อที่ถูกตีกลับ โดยเปรียบเทียบข้อมูลในระบบ (คำสั่งซื้อที่มีสถานะ 'Returned') กับรายงานภายนอก (เช่น รายงานการตีกลับจากขนส่ง)

## 2. กฎเกณฑ์หลัก (Core Rules)

### 2.1 สิทธิ์ของคำสั่งซื้อ
- **ข้อกำหนดสถานะ**: เฉพาะคำสั่งซื้อที่มี `order_status = 'Returned'`
- **แหล่งข้อมูล**: ดึงข้อมูลจากตาราง `orders` และสถานะการคืนจาก `order_boxes` ในระบบ

### 2.2 ระบบแท็บ (Tabs System)
- **ยังไม่ตรวจสอบ (Pending)**: แสดงรายการสถานะ `Returned` ที่ยังไม่มีการระบุสถานะการคืนใน `order_boxes` (`return_status` IS NULL)
  - มีปุ่ม **"จัดการ" (Manage)** ในแต่ละแถว
- **ตรวจสอบแล้ว (Verified)**: แสดงรายการที่มีบันทึกสถานะการคืนใน `order_boxes` แล้ว (`return_status` IS NOT NULL)
  - **New Feature**: มีปุ่ม **"จัดการ"** เพื่อแก้ไขข้อมูล (สถานะ/หมายเหตุ) ภายหลังได้ โดยระบบจะดึงข้อมูล Order กลับมาให้แก้ไขใน Modal เดิม
  - **Grouping Display**: รายการจะถูกจัดกลุ่มตาม **Order ID** เดียวกัน เพื่อไม่ให้แสดงซ้ำซ้อน
    - คอลัมน์แรกแสดง **Order ID** (Main)
    - คอลัมน์ Tracking แสดงรายการ Tracking ทั้งหมดที่เกี่ยวข้อง พร้อมสถานะราย Tracking

### 2.3 ฟีเจอร์ "จัดการ" (Manage Feature) และการค้นหา
- **การค้นหา (Search)**:
  - มีช่องค้นหา **Tracking No.** ด้านบน เพื่อค้นหาและจัดการรายการแบบเจาะจง
  - เมื่อค้นพบ ระบบจะเปิด Modal จัดการของ Order นั้นทันที
- **Modal จัดการ (Manage Modal)**:
  - **การแสดงผล**: แสดงแถวข้อมูลสำหรับจัดการตาม **Tracking Number** ที่ผูกไว้เท่านั้น
  - **Condition**: หากกล่องสินค้านั้นไม่มี Tracking Number จะไม่แสดงแถวให้จัดการ
  - **New: แสดงรายการสินค้า (Products)**: แสดงชื่อและจำนวนสินค้าที่อยู่ในกล่อง/Tracking นั้นๆ (อ้างอิงจาก Sub Order ID / Box Number)
  - **ดำเนินการรายบรรทัด**:
    - **Pending**: รอดำเนินการ
    - **Returning**: อยู่ระหว่างตีกลับ (กำลังเดินทางกลับ)
      - บันทึกลง `order_boxes` (Status: returning)
      - **Auto-Update**: ระบบจะอัปเดต `order_boxes.status` = 'RETURNED' ทันที
    - **Returned**: รับของคืนแล้ว (เข้าคลัง)
      - บันทึกลง `order_boxes` (Status: returned)
      - **Auto-Update**: ระบบจะอัปเดต `order_boxes.status` = 'RETURNED' ทันที
    - **Note**: ช่องกรอกหมายเหตุ (Optional)

### 2.4 ข้อกำหนดของไฟล์นำเข้า (Import & Paste)
- รองรับ Import File (Excel/CSV) และ Paste Data (Ctrl+V)
- **รูปแบบข้อมูล**:
  - **Column A**: Order/Tracking Number
  - **Column B**: Amount (เดิมใช้ตรวจสอบยอดเงิน ปัจจุบันใช้เพื่ออ้างอิงเท่านั้น)
  - **Column C**: Note
  - **New Feature**: เมื่อเลือกไฟล์ Import ระบบจะให้เลือกสถานะที่ต้องการนำเข้าทันที:
    - **Import ตีกลับ (Returning)**: สถานะเท่ากับ "อยู่ระหว่างตีกลับ"
    - **Import เข้าคลังแล้ว (Returned)**: สถานะเท่ากับ "รับของคืนแล้ว"

### 2.5 ตรรกะการจับคู่และการบันทึก (Matching & Saving Logic)
1. **จับคู่ด้วย Tracking Number**: ความแม่นยำสูงสุด (รวมถึง Sub-tracking)
2. **การบันทึกทับ (Upsert)**: หากมีข้อมูล Tracking ID หรือ Sub Order ID เดิมอยู่ในระบบแล้ว ระบบจะทำการ **อัปเดตข้อมูล (Replace)** ด้วยข้อมูลใหม่จากไฟล์ทันที (เช่น เปลี่ยนสถานะ หรือแก้ไข Note)
3. **จับคู่ด้วย Order ID / Sub Order ID**: ถ้าตรงกับ Sub Order ID จะบันทึกได้แม่นยำรายกล่อง

## 3. ขั้นตอนการทำงาน (Workflow)
1. **ค้นหาหรือเลือกรายการ**: ใช้ช่องค้นหา Tracking หรือเลือกจากรายการ Pending
2. **ตรวจสอบสินค้า**: ใน Modal ให้ดู Column "Products" ว่าสินค้าในกล่องนั้นคืออะไร ตรงกับของจริงหรือไม่
3. **กำหนดสถานะ**: เลือก Return หรือ Delivered ราย Tracking
4. **บันทึก (Save)**: กดบันทึก
   - ระบบจะเก็บข้อมูลลงตาราง `order_boxes` (Update `return_status`, `return_note`, `return_created_at`)
   - **Crucial**: ระบบจะอัปเดตสถานะของ **Box** (`order_boxes.status`) เป็น **'RETURNED'** โดยอัตโนมัติ
   - **Important**: ระบบจะอัปเดตสถานะของ **Main Order** ในตาราง `orders` ให้เป็น **'Returned'** โดยอัตโนมัติ (หากมีการบันทึกสถานะใดๆ ก็ตามใน Modal นี้)

## 4. โครงสร้างฐานข้อมูล (Database Schema)

### ตาราง `order_boxes` (Updated for Return Management)
ใช้ตาราง `order_boxes` เดิมที่มีอยู่ แล้วเพิ่มคอลัมน์สำหรับจัดการการคืน เพื่อให้ข้อมูลผูกติดกับกล่องสินค้าโดยตรง

```sql
ALTER TABLE `order_boxes`
ADD COLUMN `return_status` varchar(50) COLLATE utf8mb4_unicode_ci NULL COMMENT 'สถานะการคืน: returning, returned, delivering, delivered',
ADD COLUMN `return_note` text COLLATE utf8mb4_unicode_ci NULL COMMENT 'หมายเหตุการคืน',
ADD COLUMN `return_created_at` datetime NULL COMMENT 'วันที่บันทึกการคืน';
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
  - ปรับปรุง Logic "Pending" ให้กรองจาก `order_boxes.return_status IS NULL`
  - ปรับปรุง Logic "Verified" ให้ดึงจาก `order_boxes.return_status IS NOT NULL`

## 8. อัปเดตล่าสุด (Change Log - 26/01/2026 - Part 2)
- **Status Options Cleanup**: ลบตัวเลือก "อยู่ระหว่างจัดส่ง" (Delivering) และ "จัดส่งสำเร็จ" (Delivered) ออกจากหน้า Modal
- **Auto Status Update**: เพิ่ม Logic ให้ระบบอัปเดตฟิลด์ `status` ในตาราง `order_boxes` เป็น **'RETURNED'** โดยอัตโนมัติ เมื่อมีการบันทึกสถานะการคืน (Returning/Returned) ผ่านหน้า Return Management
- **Confirmation Modal**: เพิ่มระบบยืนยัน (Confirmation Dialog) ก่อนทำการบันทึกข้อมูล เพื่อแจ้งสรุปจำนวนรายการที่จะถูกบันทึกและป้องกันการกดบันทึกโดยไม่ตั้งใจ
