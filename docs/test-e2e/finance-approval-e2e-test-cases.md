# แนวทางการทดสอบ E2E (Playwright) สำหรับระบบ Finance Approval & Reconciliation

เอกสารฉบับนี้ใช้เป็นไกด์ไลน์สำหรับทีม QA หรือ Automated Tester (Playwright) ในการเขียน Test Script สำหรับหน้า **ระบบอนุมัติการเงิน (Finance Approval)** 
อ้างอิงจาก `pages/FinanceApprovalPage.tsx` และคู่มือ `.agents/workflows/finance-approval-guide.md`

> **🔥 หัวใจสำคัญ (Core Philosophy): Context-Rich Assertions & DB Verification**
> การทดสอบหน้านี้เกี่ยวข้องกับการเงิน (Finance) โดยตรง **ห้ามเชื่อถือการแจ้งเตือนบนหน้า UI เพียงอย่างเดียว** (เช่น ข้อความ "บันทึกสำเร็จ") ทุก Test Case ต้องมีการเขียนสคริปต์ไป `Query` เช็คในฐานข้อมูลจริงเพื่อยืนยันเสมอ และควรแนบข้อมูลที่เช็คลงใน `test.step()` และ Annotations ของ Playwright ให้อ่านง่าย

---

## 🏗️ 1. เตรียมข้อมูลทดสอบ (Test Data Preparation - Database Seeding)
- **ห้าม Mock API** ให้ใช้วิธี **Database Seeding** ผ่านไฟล์ `tests/e2e/utils/db-setup.php` แทน เพื่อให้การเทสต์ครอบคลุม Logic ฝั่ง Backend อย่างสมบูรณ์
- **User Role:** ต้องล็อกอินด้วยสิทธิ์ Finance หรือ Admin
- **Data (Transfers):** 
  - สร้าง Order ลง DB ที่มีสถานะชำระเงินเป็น `PreApproved` และช่องทางเป็น `Transfer`
  - สร้าง Statement Logs จำลองลงตาราง `statement_logs` ที่มีทั้งยอด/เวลาตรงเป๊ะ และยอด/เวลาคลาดเคลื่อน
- **Data (COD):**
  - สร้าง Order ลง DB ที่ส่งแบบ `COD` (เก็บปลายทาง)
  - สร้างเอกสาร COD ใน `cod_documents` สถานะ `pending` หรือ `unmatched` ที่เชื่อมกับออเดอร์
  - สร้าง Statement Logs จำลองลงตารางสำหรับใช้ตรวจสอบเก็บปลายทาง

---

## 🧪 2. Test Cases (แบ่งตาม Tabs)

### Tab 1: โอนเงิน (Transfers)

#### TC1.1: Auto Match & Batch Save (Happy Path)
- **Action:** 
  1. เข้าหน้า Finance Approval ไปที่แท็บ "โอนเงิน"
  2. เลือกบัญชีธนาคาร และช่วงวันที่ที่มี Statement ตรงกับ Order แบบเป๊ะๆ
  3. ระบบต้องแสดง Statement ขึ้นมาและสถานะเป็น `Auto Match` อัตโนมัติ (ยอดเงินต่างกัน <= 1 บาท, เวลาต่างกัน <= 3 นาที)
  4. เลือกติ๊ก Checkbox หลายรายการพร้อมกัน (Bulk)
  5. กดปุ่ม "บันทึก"
- **Expected (UI):** ออเดอร์ที่ถูกบันทึก ต้องหายไปจากตาราง และมี Toast แจ้งเตือนความสำเร็จ
- **Expected (Database - บังคับเช็ค):** 
  - `orders` table: ออเดอร์นั้นต้องมี `payment_status = 'Paid'`, `amount_paid` ต้องตรงกับยอดโอนจริง, และ `bank_account_id` ต้องถูกตั้งค่า
  - `statement_logs` table: รายการยอดโอนนั้นต้องมีการอัปเดต `matched_order_id` ผูกกับบิลเรียบร้อยแล้ว
  - **ตัวอย่างการรายงานใน Playwright:** `[Assert] ออเดอร์ ID XXX สถานะใน DB เปลี่ยนเป็น Paid พร้อมยอดจ่ายจริง 500 บาท เรียบร้อยแล้ว`

#### TC1.2: Candidates Selection & Scoring System
- **Action:**
  1. ตรวจสอบออเดอร์ที่ **ไม่เข้าเงื่อนไข Auto Match**
  2. กดปุ่ม "ค้นหา" ในคอลัมน์ Statement
  3. ตรวจสอบ Modal ที่ป๊อปอัปขึ้นมาว่ามีรายการแนะนำ (Candidates) หรือไม่
- **Expected (UI):**
  - ต้องเห็น Badge แบ่งกลุ่มคะแนน (เช่น `ตรงกัน (Exact)`, `ใกล้เคียง (Close)`, `แนะนำ (Suggestion)`)
  - สามารถคลิกเลือก Candidate และกดยืนยันเพื่อนำยอดมาผูกกับออเดอร์ได้

#### TC1.3: Prevent Duplicate Match (Negative Case)
- **Action:** 
  1. นำ Statement Log `A` ไปจับคู่กับออเดอร์ `Order 1` และบันทึก
  2. นำ Statement Log `A` (ที่ถูกใช้ไปแล้ว) ไปพยายามจับคู่กับ `Order 2`
- **Expected (UI & DB):**
  - ระบบไม่ควรแสดง Statement Log `A` ให้เลือกอีก
  - หากจงใจยิง API ด้วย ID เดิม Backend ต้องปฏิเสธและแจ้ง Error ว่า "Statement ถูกจับคู่ไปแล้ว"

---

### Tab 2: เก็บปลายทาง (COD)

#### TC2.1: View COD Document Details
- **Action:** 
  1. เปลี่ยนไปที่แท็บ "เก็บปลายทาง"
  2. หา COD Document ที่อยู่ในรายการ
  3. กดดูรายละเอียด/ไอคอนตา เพื่อดูรายการออเดอร์ข้างใน
- **Expected (UI):** ต้องแสดงรายการ Tracking Number และยอดเงิน COD ของออเดอร์ย่อยในเอกสารนั้นถูกต้อง

#### TC2.2: Shortage Reason Validation (Negative Case - สำคัญ)
- **Action:**
  1. ในหน้าต่างรายละเอียด COD ให้ค้นหา/เลือก Statement Candidate
  2. **จงใจเลือก Statement** ที่ยอดเงิน `amount` **ไม่เท่ากับ** `total_input_amount` ของเอกสาร COD (ต่างกัน >= 0.01 บาท)
  3. **ปล่อยว่าง** ช่อง "สาเหตุที่ยอดเงินไม่ตรงกัน"
  4. กดปุ่มจับคู่ (Confirm Match)
- **Expected (UI):**
  - ระบบ **ต้องขัดขวางการบันทึก** (ไม่ส่ง API)
  - ต้องแสดงข้อความ Error สีแดง ใต้ช่องกรอกสาเหตุว่า `"กรุณาระบุสาเหตุก่อนกดบันทึก"` (ตรวจจับ Text บน UI แทน Popup Alert)

#### TC2.3: Shortage Reason Submission & Success (Happy Path)
- **Action:**
  1. เลือก Statement ที่ยอดไม่ตรงกับยอด COD Document เหมือนข้อด้านบน
  2. พิมพ์ข้อความในช่องสาเหตุ เช่น `"ขนส่งหักค่าธรรมเนียมโอน"`
  3. กดปุ่มจับคู่ (Confirm Match)
- **Expected (UI):** แสดงแจ้งเตือนบันทึกสำเร็จ และรีเฟรชหน้า
- **Expected (Database - บังคับเช็ค):**
  - `cod_documents` table: ต้องคิวรีมาตรวจสอบว่าคอลัมน์ `shortage_reason` มีการบันทึกข้อความ `"ขนส่งหักค่าธรรมเนียมโอน"` ลงไปจริงๆ
  - `orders` table: ออเดอร์ลูกทุกบิลภายใต้เอกสารนี้ต้องเปลี่ยนสถานะเป็น `Paid`
  - **ตัวอย่างการรายงานใน Playwright:** `[Assert] เอกสาร COD ID XXX บันทึกเหตุผล "ขนส่งหักค่าธรรมเนียมโอน" ลงใน DB สำเร็จ`

#### TC2.4: Exact Match COD
- **Action:**
  1. เลือก Statement ที่ยอดตรงกับยอด COD Document แบบเป๊ะๆ (ผลต่าง = 0)
- **Expected (UI & DB):**
  - ช่องกรอก "สาเหตุที่ยอดเงินไม่ตรงกัน" **ต้องไม่แสดงขึ้นมา**
  - กดจับคู่ได้สำเร็จ และสถานะออเดอร์ใน Database ต้องถูกอัปเดตเป็น `Paid` สมบูรณ์โดยไม่มี Error บังคับให้กรอกเหตุผล

---

## 🚀 3. คำแนะนำเพิ่มเติมสำหรับการเขียน Script (Best Practices Tips)
1. **การแสดงผลลัพธ์ (Reporting):** ให้ดึงค่ายอดเงินจริงหรือคำเตือนจาก Database มาใส่ใน `test.info().annotations.push()` และเอาไปใส่เป็นชื่อใน `test.step()` ด้วย เพื่อให้รีพอร์ต E2E อ่านง่ายและช่วยบอกใบ้เวลาเทสต์พังได้ทันที
2. **เลี่ยงความเปราะบาง (Flakiness):** ให้เตรียม `seed_finance_data` ฟังก์ชันเฉพาะใน `tests/e2e/utils/db-utils.ts` เพื่อเคลียร์ Database และเตรียมข้อมูลใหม่สำหรับรันเทสต์ระบบการเงินทุกครั้ง
3. **ตรวจสอบ Validation Message อย่างเข้มงวด:** โดยเฉพาะเรื่อง **Shortage Reason** ในระบบ COD เพราะเป็น Requirement สำคัญที่มีผลกระทบทางบัญชีสูงสุดของบริษัท
