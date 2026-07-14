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
- **เวลาทำงาน (Working Hours):** 
  > [!IMPORTANT]
  > การคำนวณเวลาทำงานรายวันในโหมดนี้ อ้างอิงจากตาราง `user_daily_attendance` คอลัมน์ `attendance_value` โดยมีสูตรการคำนวณคือ:
  > **เวลาทำงาน (ชั่วโมง) = attendance_value * 8** 
  > (เช่น ถ้าบันทึก 0.5 จะแสดงผลเป็น 4.0 ชม.)
- **ยอดขายรายวัน:** ดูรายละเอียดออเดอร์และยอดขายที่เกิดขึ้นในแต่ละวัน

---

## ⚙️ โครงสร้างฟีเจอร์ "เวลาทำงานรายวัน"

เพื่อแสดงคอลัมน์ "เวลาทำงาน" ในหน้าเจาะลึก KPI (Daily View) ระบบมีการทำงานดังนี้:

**Backend (`telesale_daily_performance.php`)**
1. คิวรีข้อมูลเข้างานด้วย SQL:
   ```sql
   SELECT DATE(work_date) AS work_day, user_id, SUM(attendance_value) AS working_days
   FROM user_daily_attendance
   WHERE DATE(work_date) BETWEEN ? AND ?
   GROUP BY DATE(work_date), user_id
   ```
2. นำไปคำนวณ `workingHours = working_days * 8` และเพิ่มเข้าไปใน `metrics` ของแต่ละคน/วัน

**Frontend (`TelesalePerformancePage.tsx`)**
- มี Checkbox เพื่อเปิด/ปิด (Toggle) การแสดงผลคอลัมน์ "เวลาทำงาน" ในหน้าจอ (ผูกกับ State `visibleCols.kpi_workingHours`)
- ในแถวท้ายสุดของตาราง (Summary Row) จะมีการบวกตัวเลข `workingHours` รวมของพนักงานทุกคนมาแสดงผล

---

## 🚀 โครงสร้างฐานข้อมูลที่เกี่ยวข้อง
- `users`: ข้อมูลพนักงานและสายบังคับบัญชา (Supervisor)
- `orders` & `order_items`: ข้อมูลยอดขายและออเดอร์
- `call_import_logs`: ข้อมูลสถิติการโทรศัพท์ (เวลา, ความยาวการคุย, สถานะ)
- `user_daily_attendance`: ข้อมูลการบันทึกเวลาทำงานรายวัน (`attendance_value`)
