---
name: jst-inventory-guide
description: คู่มือระบบดึงข้อมูลสินค้าคงคลัง JST และสถิติเชิงลึก (JST Inventory & Analytics System)
---

# คู่มืออธิบายการทำงานระบบ JST Inventory & Analytics

## ภาพรวม (Overview)
ระบบแสดงข้อมูลสินค้าคงคลัง JST ออกแบบมาเพื่อแสดงจำนวนสต็อกที่มีอยู่ในคลังสินค้าต่างๆ ที่ผูกกับบัญชี JST ERP ของแต่ละบริษัท (Company) โดยระบบถูกออกแบบให้ซิงค์ข้อมูลลง Local Database แทนการยิง API แบบสด (Real-time) เพื่อแก้ปัญหา Request Limits, ป้องกัน Session โดนแบน และเพิ่มความเร็วในการโหลดข้อมูลหน้าเว็บ

นอกจากนี้ ระบบยังถูกขยายความสามารถเพื่อเก็บ **ข้อมูลเชิงลึก (Analytics)** เช่น ยอดขายย้อนหลัง, ของมีตำหนิ, ทยอยรับเข้า, ของตีกลับ เพื่อแสดงผลเป็นกราฟในหน้า Dashboard อีกด้วย

## สถาปัตยกรรมและการไหลของข้อมูล (Architecture & Data Flow)

1. **Database Table (`jst_inventory`)**
   - ตารางที่ใช้จัดเก็บข้อมูลสินค้าคงคลังที่ถูกดูดมาจาก JST ERP 
   - รองรับการแยกบริษัทโดยใช้ `company_id`
   - ใช้ `sku_id` และ `warehouse_name` ในการระบุความแตกต่างของแถวข้อมูล
   - **Extended Fields (Analytics):** มีการจัดเก็บฟิลด์เชิงลึก เช่น `defective_qty`, `in_qty`, `return_qty`, `purchase_qty`, ข้อมูลแบรนด์/ซัพพลายเออร์, และยอดขายย้อนหลัง `day_sale_3` ถึง `day_sale_90`

2. **Cron Job / Background Worker (`api/cron/sync_jst_inventory.php`)**
   - สคริปต์นี้จะถูกตั้งให้ทำงานทุกๆ N นาที (เช่น 15 นาที) ผ่านระบบ Task Scheduler (Windows) หรือ Cron Job (Linux)
   - สคริปต์จะหาบริษัททั้งหมดที่มีการตั้งค่า `JST_ACCOUNT_ID` ไว้ และเรียกใช้คำสั่งอัปเดตข้อมูลทีละบริษัท

3. **JstErpService (`api/Services/JstErpService.php`)**
   - **Login**: จำลองการเข้าสู่ระบบผ่านเว็บเพื่อขอรับ Cookie และเก็บ Cache Cookie ไว้ใช้งาน 12 ชั่วโมง
   - **`syncInventoryToDb()`**: ทำหน้าที่ไล่ดึงข้อมูลจาก API ทุกหน้า และใช้ **Database Transactions (`beginTransaction`)** ห่อหุ้มการทำ Bulk UPSERT เพื่อให้เขียนข้อมูลหลักพันรายการได้ในเสี้ยววินาที จากนั้นลบข้อมูลเก่าทิ้ง (Data Integrity)
   - **`getAllInventory()`**: ดึงข้อมูลจากฐานข้อมูลมาแสดงผล หากมีการสั่ง Force Refresh จากหน้าจอ จะเรียกใช้ `syncInventoryToDb()` ก่อน 1 ครั้ง

4. **Frontend (`pages/InventoryPage.tsx`)**
   - ผู้ใช้งานเข้าหน้า "สินค้าคงคลัง JST" เพื่อดูตารางสินค้า
   - **Expandable Rows & ApexCharts:** สามารถคลิกที่แถวสินค้าเพื่อขยายดู "รายละเอียดสต็อกเบื้องลึก" (Stock Breakdown) และดูกราฟแท่ง (Bar Chart) ยอดขายสะสมย้อนหลัง 3 ถึง 90 วันได้
   - หากต้องการอัปเดตข้อมูล ณ เวลานั้นโดยไม่รอ Cron Job สามารถกดปุ่ม **"ดึงข้อมูลล่าสุด"** ได้

## การตั้งค่าที่จำเป็น (Configuration)
1. **ในระบบ CRM ERP**: ไปที่เมนู "ตั้งค่าบริษัท" และตั้งค่ารหัส JST (JST_ACCOUNT_ID) และรหัสผ่าน (JST_PASSWORD) ให้ถูกต้อง
2. **ในฝั่ง Server/OS**: 
   - ตั้งค่า Task Scheduler ให้เรียก `php C:\laragon\www\CRM_ERP_V4\api\cron\sync_jst_inventory.php` ตามรอบเวลาที่ต้องการ
   - ไฟล์บันทึกการทำงานของ Cron จะอยู่ที่ `storage/logs/cron_jst_sync_YYYY-MM.log`
