# 🧪 E2E Test Cases: Basket Settings & Advance Transfer (Isolated DB)

**Testing Strategy:** E2E Testing on Isolated Test Database (Database Integration Testing)  
**Target Environment:** Local Database `primacom_mini_erp_test`  

เอกสารนี้รวบรวม Test Cases สำหรับระบบ Basket Settings, Unified Modal UI, และฟีเจอร์ Advance Transfer (ดึงลูกค้าล่วงหน้า) โดยออกแบบตามหลักการ BDD (Given / When / Then) และทำงานร่วมกับ Test Database โดยตรง

---

## 🏗 Pre-requisites (การเตรียม Environment)
1. **Database Isolation:** เครื่องมือ Automated Testing (Playwright/Jest) ต้องต่อเข้าฐานข้อมูล `primacom_mini_erp_test`
2. **Data Seeding:** ต้องทำ Teardown และ Insert ข้อมูลจำลอง (Fixtures) เข้าตาราง `basket_config` และ `customers` ก่อนเริ่มรันแต่ละ Scenario

---

## 🎯 Test Cases (BDD Format)

### 1. หมวดหมู่ Unified Modal UI (การทำงานของหน้าต่างตั้งค่า)

**[TC-UI-01] การทำงานร่วมกันของ Form เพิ่มและแก้ไขถัง**
- **Given** ผู้ดูแลระบบเข้าสู่หน้า "ตั้งค่าถัง (Basket Settings)"
- **When** กดปุ่ม "เพิ่มถังใหม่" 
- **Then** Modal ที่ปรากฏขึ้น ต้องมีฟิลด์ **Dynamic Retention Rules** (ยอดขายขั้นต่ำ, บวกเวลาเพิ่ม) แสดงให้เห็นตั้งแต่แรก โดยไม่ต้องรอให้กรอกค่า Timeout

**[TC-UI-02] Conditional Rendering ของ Advance Transfer Field**
- **Given** ผู้ดูแลระบบเปิด Modal เพิ่ม/แก้ไขถัง
- **When** ติ๊กเครื่องหมายถูกที่ช่อง "กลับถังตามเกณฑ์อัตโนมัติ (Re-Evaluate)"
- **Then** ช่อง input สำหรับ "ดึงลูกค้าไปถังถัดไปล่วงหน้า (วัน)" (`advance_transfer_days`) ต้องแสดงขึ้นมาทันที
- **And When** นำเครื่องหมายถูกออก
- **Then** ช่อง input `advance_transfer_days` ต้องถูกซ่อนไป

### 2. หมวดหมู่ API & Database Integrity

**[TC-API-01] การบันทึกค่า Advance Transfer ลง Test Database**
- **Given** เชื่อมต่อฐานข้อมูล `primacom_mini_erp_test`
- **When** ยิง API `POST /api/basket_config.php` พร้อม Payload ตั้งค่า `on_fail_reevaluate = 1` และ `advance_transfer_days = 15`
- **Then** API ต้องตอบกลับ `201 Created`
- **And** เมื่อ Query ฐานข้อมูล `primacom_mini_erp_test` ตาราง `basket_config` แถวที่เพิ่งสร้าง ต้องมีค่า `advance_transfer_days = 15`

### 3. หมวดหมู่ Cron Job Logic (การประมวลผลย้ายถังอัตโนมัติ)
*หมวดหมู่นี้เป็นการทำ Database-Driven E2E Test กับสคริปต์ `monthly_transfer_web.php` โดยตรง*

**[TC-CRON-01] การย้ายถังแบบปกติ (ไม่เปิด Re-Evaluate)**
- **Given** จำลอง (Seed) ลูกค้า A ให้ค้างอยู่ในถัง `mid_1_3y_dash` ครบกำหนด Timeout 29 วัน ใน `primacom_mini_erp_test`
- **And** ตั้งค่าถัง `mid_1_3y_dash` ให้ `on_fail_reevaluate = 0`, ถังเป้าหมายคือ `mid_1_3y`
- **When** สั่งรันสคริปต์ `php api/cron/monthly_transfer_web.php`
- **Then** ลูกค้า A ต้องถูกย้ายไปที่ถัง `mid_1_3y` ทันที

**[TC-CRON-02] การย้ายถังด้วย Re-Evaluate (ไม่มีการดึงล่วงหน้า)**
- **Given** จำลองลูกค้า B เข้าเงื่อนไข Timeout ใน `primacom_mini_erp_test` โดยมี "อายุ Order ล่าสุด" จริงคือ `1,100` วัน
- **And** ตั้งค่าถังปัจจุบันให้ `on_fail_reevaluate = 1` และ `advance_transfer_days = 0`
- **When** สั่งรันสคริปต์ Cron Job
- **Then** ลูกค้า B ต้องถูกส่งข้ามถังปกติ ไปยังถัง `Ancient` (เนื่องจากอายุเกิน 1095 วัน)

**[TC-CRON-03] การดึงข้ามถังล่วงหน้า (Advance Transfer)**
- **Given** จำลองลูกค้า C เข้าเงื่อนไข Timeout โดยมี "อายุ Order ล่าสุด" อยู่ที่ `360` วัน
- **And** ตั้งค่าถังปัจจุบันให้ `on_fail_reevaluate = 1` และ `advance_transfer_days = 15`
- **When** สั่งรันสคริปต์ Cron Job
- **Then** ระบบต้องคำนวณอายุจำลองเป็น 360 + 15 = 375 วัน
- **And** ลูกค้า C ต้องถูกย้ายไปที่ถังที่รองรับช่วง 366-1095 วัน
- **And** ตรวจสอบตาราง `transition_logs` ต้องมีการบันทึกรูปแบบ `re-eval(...,adv:+15d)`

### 4. หมวดหมู่ Edge Cases

**[TC-EDGE-01] การบล็อกข้ามสาย (Lane Isolation)**
- **Given** จำลองลูกค้า D ที่ถึงเกณฑ์การดึงล่วงหน้า (Advance Transfer) ไปยังถัง Z
- **And** แอดมินตั้งค่า "ถังที่ห้ามย้ายไป (Blocked Targets)" ให้บล็อกถัง Z ไว้
- **When** สั่งรันสคริปต์ Cron Job
- **Then** ระบบต้องข้ามถัง Z และจับคู่ (Fallback) ลูกค้า D ไปยังถังที่อายุ Order ใกล้เคียงที่สุดลำดับถัดไปแทน
