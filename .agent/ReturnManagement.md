# กฎเกณฑ์และขั้นตอนการทำงานของระบบจัดการการตีกลับ (Return Management)

## 1. ภาพรวม
โมดูลจัดการการตีกลับ (Return Management) ออกแบบมาเพื่อติดตาม ตรวจสอบ และกระทบยอดคำสั่งซื้อที่ถูกตีกลับ โดยเปรียบเทียบข้อมูลในระบบ (คำสั่งซื้อที่มีสถานะ 'Returned') กับรายงานภายนอก (เช่น รายงานการตีกลับจากขนส่ง)

## 2. กฎเกณฑ์หลัก (Core Rules)

### 2.1 สิทธิ์ของคำสั่งซื้อ
- **ข้อกำหนดสถานะ**: เฉพาะคำสั่งซื้อที่มี `order_status = 'Returned'`
- **แหล่งข้อมูล**: ดึงข้อมูลจากตาราง `orders` ในระบบ

### 2.2 ระบบแท็บ (Tabs System)
- **ยังไม่ตรวจสอบ (Pending)**: แสดงรายการสถานะ `Returned` ที่ยังไม่มีในตาราง `order_returns`
  - มีปุ่ม **"จัดการ" (Manage)** ในแต่ละแถว
- **ตรวจสอบแล้ว (Verified)**: แสดงรายการที่มีบันทึกใน `order_returns` แล้ว
  - **New Feature**: มีปุ่ม **"จัดการ"** เพื่อแก้ไขข้อมูล (สถานะ/หมายเหตุ) ภายหลังได้ โดยระบบจะดึงข้อมูล Order กลับมาให้แก้ไขใน Modal เดิม
  - **Grouping Display**: รายการจะถูกจัดกลุ่มตาม **Order ID** เดียวกัน เพื่อไม่ให้แสดงซ้ำซ้อน
    - คอลัมน์แรกแสดง **Order ID** (Main)
    - คอลัมน์ Tracking แสดงรายการ Tracking ทั้งหมดที่เกี่ยวข้อง พร้อมสถานะราย Tracking

### 2.3 ฟีเจอร์ "จัดการ" (Manage Feature) และการค้นหา
- **การค้นหา (Search)**:
  - มีช่องค้นหา **Tracking No.** ด้านบน เพื่อค้นหาและจัดการรายการแบบเจาะจง
  - เมื่อค้นพบ ระบบจะเปิด Modal จัดการของ Order นั้นทันที
- **Modal จัดการ (Manage Modal)**:
  - แสดงรายการ Tracking Number ทั้งหมดใน Order นั้น
  - **New: แสดงรายการสินค้า (Products)**: แสดงชื่อและจำนวนสินค้าที่อยู่ในกล่อง/Tracking นั้นๆ (อ้างอิงจาก Sub Order ID / Box Number)
  - **ดำเนินการรายบรรทัด**:
    - **Pending**: รอดำเนินการ
    - **Returning**: อยู่ระหว่างตีกลับ (กำลังเดินทางกลับ)
      - บันทึกลง `order_returns` (Status: returning)
    - **Returned**: ยืนยันการตีกลับ (ถึงร้านค้าแล้ว)
      - บันทึกลง `order_returns` (Status: returned)
    - **Delivering**: อยู่ระหว่างจัดส่ง (กำลังเดินทางไปหาลูกค้าใหม่/ส่งซ่อม)
      - บันทึกลง `order_returns` (Status: delivering)
    - **Delivered**: จัดส่งสำเร็จ (ถึงมือลูกค้าแล้ว)
      - บันทึกลง `order_returns` (Status: delivered)
    - **Note**: ช่องกรอกหมายเหตุ (Optional)

### 2.4 ข้อกำหนดของไฟล์นำเข้า (Import & Paste)
- รองรับ Import File (Excel/CSV) และ Paste Data (Ctrl+V)
- **รูปแบบข้อมูล**:
  - **Column A**: Order/Tracking Number
  - **Column B**: Amount (เดิมใช้ตรวจสอบยอดเงิน ปัจจุบันใช้เพื่ออ้างอิงเท่านั้น)
  - **Column C**: Note
  - **New Feature**: เมื่อเลือกไฟล์ Import ระบบจะให้เลือกสถานะที่ต้องการนำเข้าทันที:
    - **Import ตีกลับ (Returning)**: สถานะเท่ากับ "อยู่ระหว่างตีกลับ"
    - **Import เข้าคลังแล้ว (Returned)**: สถานะเท่ากับ "ยืนยันการตีกลับ"

### 2.5 ตรรกะการจับคู่และการบันทึก (Matching & Saving Logic)
1. **จับคู่ด้วย Tracking Number**: ความแม่นยำสูงสุด (รวมถึง Sub-tracking)
2. **การบันทึกทับ (Upsert)**: หากมีข้อมูล Tracking ID หรือ Sub Order ID เดิมอยู่ในระบบแล้ว ระบบจะทำการ **อัปเดตข้อมูล (Replace)** ด้วยข้อมูลใหม่จากไฟล์ทันที (เช่น เปลี่ยนสถานะ หรือแก้ไข Note)
2. **จับคู่ด้วย Order ID / Sub Order ID**: ถ้าตรงกับ Sub Order ID จะบันทึกได้แม่นยำรายกล่อง

## 3. ขั้นตอนการทำงาน (Workflow)
1. **ค้นหาหรือเลือกรายการ**: ใช้ช่องค้นหา Tracking หรือเลือกจากรายการ Pending
2. **ตรวจสอบสินค้า**: ใน Modal ให้ดู Column "Products" ว่าสินค้าในกล่องนั้นคืออะไร ตรงกับของจริงหรือไม่
3. **กำหนดสถานะ**: เลือก Return หรือ Delivered ราย Tracking
4. **บันทึก (Save)**: กดบันทึก
   - ระบบจะเก็บข้อมูลลงตาราง `order_returns`
   - **Important**: ระบบจะอัปเดตสถานะของ **Main Order** ในตาราง `orders` ให้เป็น **'Returned'** โดยอัตโนมัติ (หากมีการบันทึกสถานะใดๆ ก็ตามใน Modal นี้)

## 4. โครงสร้างฐานข้อมูล (Database Schema)

### ตาราง `order_returns`
ตารางสำหรับเก็บข้อมูลการตีกลับที่ตรวจสอบแล้ว (ตัด Field `return_amount` ออกแล้ว)

```sql
CREATE TABLE `order_returns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sub_order_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'รหัสคำสั่งซื้อย่อย (Main Key)',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'returned' COMMENT 'สถานะ: returned, delivered',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุ',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sub_order_id` (`sub_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

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
