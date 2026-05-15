# คู่มือการทำงานหน้า Marketplace (MarketplacePage.tsx)

หน้า `MarketplacePage.tsx` เป็นศูนย์กลางการจัดการและการวิเคราะห์ข้อมูลสำหรับช่องทางการขายบน E-commerce Marketplace (เช่น Shopee, Lazada, TikTok Shop) โดยถูกออกแบบมาให้ทำงานเป็น 4 โหมดย่อย (Views) ตามที่ถูกส่งผ่าน Prop `view`

## โครงสร้างและโหมดการทำงาน (Views)

หน้านี้รับ Prop สำคัญคือ `view: "dashboard" | "adsInput" | "salesImport" | "settings"` ซึ่งจะสลับการแสดงผลตามโหมดที่เลือก:

### 1. Dashboard (`view === "dashboard"`)
หน้าจอสรุปผลสถิติเปรียบเทียบ **ค่าโฆษณา (Ads Cost)** กับ **ยอดขาย (Total Sales)** ของแต่ละร้านค้า
- **ฟีเจอร์หลัก:**
  - ตัวกรองวันที่ (Date Range Picker) พร้อมปุ่ม Preset (เช่น วันนี้, สัปดาห์นี้, 30 วันย้อนหลัง)
  - ตัวกรองแยกร้านค้า (Store Filter)
  - คำนวณสัดส่วนค่าแอดเทียบกับยอดขาย (`%Ads = (Ads Cost / Total Sales) * 100`)
  - รองรับการ Export ข้อมูลออกเป็น CSV และ Excel (XLSX)
- **API ที่เกี่ยวข้อง:** `Marketplace/dashboard_data.php`

### 2. กรอกค่า Ads (`view === "adsInput"`)
หน้าสำหรับให้พนักงานหรือแอดมินเข้ามากรอกงบโฆษณาที่ใช้ไปในแต่ละวันของแต่ละร้านค้า
- **ฟีเจอร์หลัก:**
  - เลือกวันที่ที่ต้องการกรอก (1 ร้านค้า 1 วัน ลงได้ 1 ครั้ง)
  - โหลดรายการร้านค้าที่เปิดใช้งาน (Active) มาแสดงเป็นตารางอัตโนมัติ
  - ระบบ **Lock ข้อมูล:** หากเคยบันทึกค่าแอดของวันนั้นไปแล้วและไม่มีการแก้ไข จะแสดงสถานะ "✅ บันทึกแล้ว" ป้องกันการส่ง Data ซ้ำซ้อน
  - ส่งบันทึกเฉพาะบรรทัดที่มีการเปลี่ยนแปลง (Delta Save)
- **API ที่เกี่ยวข้อง:** 
  - `Marketplace/ads_log_list.php` (ดึงประวัติ)
  - `Marketplace/ads_log_upsert.php` (บันทึก/อัปเดต)

### 3. นำเข้ายอดขาย CSV (`view === "salesImport"`)
ระบบสำหรับอัปโหลดไฟล์ CSV ที่ดึงมาจากหลังบ้านของ Marketplace เพื่อแปลงเป็นออเดอร์ในระบบ
- **ฟีเจอร์หลัก:**
  - มีปุ่มดาวน์โหลด CSV Template
  - ระบบ Preview ไฟล์ (อ่าน 11 บรรทัดแรกจากเครื่อง Client เพื่อดูตัวอย่างก่อนอัปโหลด)
  - **Auto-create Store:** หากใน CSV มีชื่อร้านค้าที่ยังไม่มีในระบบ Backend จะสร้างร้านใหม่ให้อัตโนมัติและแจ้งเตือนในหน้า UI
  - **Error Handling:** แจ้งเตือนรายการ SKU ที่ไม่รู้จักพร้อมบรรทัดที่เกิดปัญหา
  - **Batch Management:** ประวัติการอัปโหลดไฟล์ สามารถดูรายการออเดอร์ในแต่ละ Batch และกดลบ (Rollback) Batch นั้นๆ ได้หากอัปโหลดผิดพลาด
- **API ที่เกี่ยวข้อง:** 
  - `Marketplace/sales_csv_import.php`
  - `Marketplace/sales_csv_template.php`
  - `Marketplace/import_batches_list.php` (ดูประวัติ)
  - `Marketplace/sales_orders_list.php` (ดูออเดอร์ใน Batch)
  - `Marketplace/import_batch_delete.php` (ลบ Batch)

### 4. จัดการร้านค้า (`view === "settings"`)
หน้าจอตั้งค่าข้อมูลร้านค้าต่างๆ (Store Master Data)
- **ฟีเจอร์หลัก:**
  - สร้างและแก้ไขร้านค้า (ชื่อร้าน, แพลตฟอร์ม: Shopee/Lazada/TikTok/Line/FB, URL)
  - **การกำหนดผู้ดูแล (Managers):** สามารถเลือกพนักงานดูแลร้านได้หลายคน (Multi-select) โดย UI จะจัดกลุ่มพนักงานตามแผนก (Role) เพื่อให้เลือกง่ายขึ้น
  - การเปิด/ปิดใช้งานร้านค้า (Toggle Active Status) 
- **API ที่เกี่ยวข้อง:** 
  - `Marketplace/stores_list.php`
  - `Marketplace/users_list.php`
  - `Marketplace/stores_upsert.php`

---

## Technical Details ที่น่าสนใจ

1. **State Management สำหรับ Ads Input:**
   มีการใช้ `adsOriginalRows` แยกกับ `adsRows` เพื่อทำหน้าที่เปรียบเทียบ (Diffing) ว่าผู้ใช้มีการแก้ไขช่องไหนไปบ้าง หากไม่แก้ จะไม่ส่ง Request เปลือง Traffic ไปที่ Server
   
2. **Client-side CSV Parsing:**
   ในหน้า Sales Import มีการใช้ `FileReader` ของ HTML5 เพื่อแกะข้อมูล CSV เบื้องต้นมาแสดงผลเป็นตาราง Preview แบบเรียลไทม์ โดยมีการจัดการเรื่องเครื่องหมาย Quote (`"`) ภายในไฟล์ CSV อย่างถูกต้อง

3. **User Filtering:**
   ในหน้าจัดการร้านค้า จะดึงรายชื่อผู้ใช้มาแสดงให้เลือกเป็น Manager โดยกรองเฉพาะพนักงานที่มี Role ID = 5 หรือเป็น System Admin (`is_system = 1`) เท่านั้น

4. **Dynamic Rendering:**
   คอมโพเนนต์นี้ใช้ `view` prop เพื่อควบคุมเนื้อหาอย่างสมบูรณ์ ทำให้สามารถนำหน้าเพจนี้ไปฝังหรือ Routing จาก Sidebar ได้โดยใช้ Component เดียวกันแค่เปลี่ยนค่า `view`
