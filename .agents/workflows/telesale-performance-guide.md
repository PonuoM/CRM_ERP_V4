---
description: คู่มืออธิบายการทำงานหน้า Telesale Performance (สรุปผลงานและ KPI)
---

# 📊 คู่มือหน้า Telesale Performance

**เป้าหมาย:** หน้าจอนี้ถูกออกแบบมาเพื่อให้หัวหน้า (Supervisor) ผู้บริหาร หรือพนักงาน Telesale สามารถดูสรุปผลการทำงาน (KPI) และยอดขายได้อย่างละเอียด ทั้งในมุมมองภาพรวมรายเดือนและเจาะลึกรายวัน

**ไฟล์ที่เกี่ยวข้อง:**
- **Frontend:** `pages/TelesalePerformancePage.tsx`
- **Backend:** 
  - รายเดือน: `api/User_DB/telesale_performance.php`
  - รายวัน: `api/User_DB/telesale_daily_performance.php`

---

## 🔍 โหมดการทำงาน (2 View Modes)

หน้าต่างนี้แบ่งการดูข้อมูลออกเป็น 2 มุมมองหลัก:

### 1. 📅 สรุปภาพรวมรายเดือน (Monthly View Mode - `old`)
โหมดนี้จะแสดงผลรวมผลงานของพนักงานแต่ละคนในเดือนที่เลือก:
- **ยอดขาย:** Gross, ยกเลิก, ตีกลับ, Net
- **สัดส่วนยอดขายตามหมวดหมู่:** ชีวภัณฑ์, ปุ๋ย, อื่นๆ
- **จำนวนออเดอร์:** ออเดอร์ลูกค้าใหม่, ลูกค้าเก่า, ลูกค้าขุด, Upsell
- **การเข้างาน (Working Days):** ระบบจะดึงข้อมูลจากตาราง `user_daily_attendance` โดยบวกผลรวมของ `attendance_value` ในเดือนนั้นมาแสดงเป็น "วันทำงาน"

### 2. 📝 เจาะลึก KPI & หมวดหมู่ (Daily View Mode - `new`)
โหมดนี้จะแสดงผลงานแบบเจาะลึกรายวันของพนักงานในช่วงวันที่เลือก โดยมีข้อมูลที่สำคัญ ได้แก่:
- **Daily KPI:** สายที่โทร, นาทีที่คุย, รับสาย, ได้คุยเกิน 30 วิ, ไม่ได้รับ, %รับสาย
- **วันทำงาน (Working Days):**
  > [!IMPORTANT]
  > หน้า Attendance บันทึก `attendance_value = hours / 8` ทุกวัน จึงต้องแปลงตอนแสดง KPI:
  > `raw = min(attendance_value, 1.0)` → `clockHours = raw * 8` → `workingDays = min(clockHours / hoursPerDay, 1.0)`
  > **จ–ศ (ทุก role):** 1 วัน = 8 ชม. ค่าเกิน 1 ใน DB ถูกตัดเหลือ 1.0 วัน (เช่น 1.3 → `1.0 วัน (8 ชม.)`)
  > **เสาร์–อาทิตย์ role 6/7 (Supervisor / Telesale):** 1 วัน = 6 ชม. ดังนั้น 0.75 ใน DB → `1.0 วัน (6 ชม.)` / ค่า 1.0 → `1.0 วัน (8 ชม.)` ไม่ใช่ 1.3 วัน
  > **เสาร์–อาทิตย์ role 3 (Admin Page):** ใช้ 8 ชม./วันเหมือนวันอื่น (0.75 ใน DB ยังเป็น `0.75 วัน (6 ชม.)`)
- **ยอดขายรายวัน:** ดูรายละเอียดออเดอร์และยอดขายที่เกิดขึ้นในแต่ละวัน

---

## ⚙️ โครงสร้างฟีเจอร์ "วันทำงานรายวัน"

เพื่อแสดงคอลัมน์ "วันทำงาน" ในหน้าเจาะลึก KPI (Daily View) ระบบมีการทำงานดังนี้:

**Backend (`telesale_daily_performance.php`)**
1. คิวรีข้อมูลเข้างานด้วย SQL:
   ```sql
   SELECT DATE(work_date) AS work_day, user_id, SUM(attendance_value) AS working_days
   FROM user_daily_attendance
   WHERE DATE(work_date) BETWEEN ? AND ?
   GROUP BY DATE(work_date), user_id
   ```
2. ตัด `attendance_value` ที่เกิน 1 เหลือ 1.0 แล้วกู้ชั่วโมง `clockHours = raw * 8`
3. แปลงเป็นวัน: จ–ศ หาร 8; ส–อา หาร 6 เฉพาะ `role_id` 6 และ 7 (Admin Page / role 3 ใช้ 8 ทุกวัน) แล้วตัด `workingDays` ไม่เกิน 1.0
4. ส่ง `workingDays` และ `workingHours = clockHours` เข้า `metrics` ของแต่ละคน/วัน

**Frontend (`TelesalePerformancePage.tsx`)**
- มี Checkbox เพื่อเปิด/ปิด (Toggle) การแสดงผลคอลัมน์ "วันทำงาน" ในหน้าจอ (ผูกกับ State `visibleCols.kpi_workingHours`)
- เซลล์แสดง `formatWorkingTime(hours, days)` เช่น Telesale เสาร์ที่บันทึก 6 ชม. `1.0 วัน (6 ชม.)` / Admin Page เสาร์ `0.75 วัน (6 ชม.)`
- แถวสรุปบวกทั้ง `workingDays` และ `workingHours` ที่แปลงแล้ว (เช่น 5 วันธรรมดา + 1 เสาร์ Telesale = `6.0 วัน (46 ชม.)`)
- ค่าเฉลี่ยต่อวันหารด้วย `workingDays` ไม่หารชั่วโมงด้วย 8 เพื่อไม่ให้เสาร์–อาทิตย์เพี้ยน

---

## 🚀 โครงสร้างฐานข้อมูลที่เกี่ยวข้อง
- `users`: ข้อมูลพนักงานและสายบังคับบัญชา (Supervisor)
- `orders` & `order_items`: ข้อมูลยอดขายและออเดอร์
- `call_import_logs`: ข้อมูลสถิติการโทรศัพท์ (เวลา, ความยาวการคุย, สถานะ)
- `user_daily_attendance`: ข้อมูลการบันทึกเวลาทำงานรายวัน (`attendance_value`)
