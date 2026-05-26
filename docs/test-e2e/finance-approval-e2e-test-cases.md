# แนวทางการทดสอบ E2E (Playwright) สำหรับระบบ Finance Approval & Reconciliation

เอกสารฉบับนี้ใช้เป็นไกด์ไลน์สำหรับทีม QA หรือ Automated Tester (Playwright) ในการเขียน Test Script สำหรับหน้า **ระบบอนุมัติการเงิน (Finance Approval)** 
อ้างอิงจาก `pages/FinanceApprovalPage.tsx` และคู่มือ `.agents/workflows/finance-approval-guide.md`

---

## 🏗️ 1. เตรียมข้อมูลทดสอบ (Test Data Preparation)
- **User Role:** ต้องล็อกอินด้วยสิทธิ์ Finance หรือ Admin
- **Data (Transfers):** 
  - สร้าง Order ที่มีสถานะชำระเงินเป็น `PreApproved` และช่องทางเป็น `Transfer`
  - เตรียม Statement Logs จำลองที่มีทั้งยอด/เวลาตรงเป๊ะ และยอด/เวลาคลาดเคลื่อน
- **Data (COD):**
  - สร้าง Order ที่ส่งแบบ `COD` (เก็บปลายทาง)
  - เตรียม `cod_documents` สถานะ `pending` หรือ `unmatched` ที่เชื่อมกับออเดอร์
  - เตรียม Statement Logs จำลองสำหรับใช้ตรวจสอบเก็บปลายทาง

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
- **Expected:**
  - ออเดอร์ที่ถูกบันทึก ต้องหายไปจากตาราง (หรือเปลี่ยนเป็น Paid)
  - ต้องมี Toast หรือ Alert แจ้งเตือนความสำเร็จ

#### TC1.2: Candidates Selection & Scoring System
- **Action:**
  1. ตรวจสอบออเดอร์ที่ **ไม่เข้าเงื่อนไข Auto Match**
  2. กดปุ่ม "ค้นหา" ในคอลัมน์ Statement
  3. ตรวจสอบ Modal ที่ป๊อปอัปขึ้นมาว่ามีรายการแนะนำ (Candidates) หรือไม่
- **Expected:**
  - ต้องเห็น Badge แบ่งกลุ่มคะแนน (เช่น `ตรงกัน (Exact)`, `ใกล้เคียง (Close)`, `แนะนำ (Suggestion)`)
  - สามารถคลิกเลือก Candidate และกดยืนยันเพื่อนำยอดมาผูกกับออเดอร์ได้

#### TC1.3: Prevent Duplicate Match (Negative Case)
- **Action:** 
  1. นำ Statement Log `A` ไปจับคู่กับออเดอร์ `Order 1` และบันทึก
  2. นำ Statement Log `A` (ที่ถูกใช้ไปแล้ว) ไปพยายามจับคู่กับ `Order 2`
- **Expected:**
  - ระบบไม่ควรแสดง Statement Log `A` ให้เลือกอีก หรือหากยิง API ด้วย ID เดิม ระบบต้องแจ้ง Error ว่า Statement ถูกจับคู่ไปแล้ว

---

### Tab 2: เก็บปลายทาง (COD)

#### TC2.1: View COD Document Details
- **Action:** 
  1. เปลี่ยนไปที่แท็บ "เก็บปลายทาง"
  2. หา COD Document ที่อยู่ในรายการ
  3. กดดูรายละเอียด/ไอคอนตา เพื่อดูรายการออเดอร์ข้างใน
- **Expected:**
  - ต้องแสดงรายการ Tracking Number และยอดเงิน COD ของออเดอร์ย่อยในเอกสารนั้นถูกต้อง

#### TC2.2: Shortage Reason Validation (Negative Case - สำคัญ)
- **Action:**
  1. ในหน้าต่างรายละเอียด COD ให้ค้นหา/เลือก Statement Candidate
  2. **จงใจเลือก Statement** ที่ยอดเงิน `amount` **ไม่เท่ากับ** `total_input_amount` ของเอกสาร COD (ต่างกัน >= 0.01 บาท)
  3. **ปล่อยว่าง** ช่อง "สาเหตุที่ยอดเงินไม่ตรงกัน"
  4. กดปุ่มจับคู่ (Confirm Match)
- **Expected:**
  - ระบบ **ต้องขัดขวางการบันทึก** (ไม่ส่ง API)
  - ระบบ **ต้องแสดงข้อความ Error สีแดง** ใต้ช่องกรอกสาเหตุว่า `"กรุณาระบุสาเหตุก่อนกดบันทึก"` (ตรวจจับ Text บน UI แทน Popup Alert)

#### TC2.3: Shortage Reason Submission & Success (Happy Path)
- **Action:**
  1. เลือก Statement ที่ยอดไม่ตรงกับยอด COD Document เหมือนข้อด้านบน
  2. พิมพ์ข้อความในช่องสาเหตุ เช่น `"ขนส่งหักค่าธรรมเนียมโอน"`
  3. กดปุ่มจับคู่ (Confirm Match)
- **Expected:**
  - ยิง API `/cod_reconcile_save.php` สำเร็จ
  - ระบบโชว์แจ้งเตือนบันทึกสำเร็จ และรีเฟรชหน้า
  - (หากตรวจสอบใน Database ตาราง `cod_documents` ต้องบันทึกคอลัมน์ `shortage_reason` ลงไป)

#### TC2.4: Exact Match COD
- **Action:**
  1. เลือก Statement ที่ยอดตรงกับยอด COD Document แบบเป๊ะๆ (ผลต่าง = 0)
- **Expected:**
  - ช่องกรอก "สาเหตุที่ยอดเงินไม่ตรงกัน" **ต้องไม่แสดงขึ้นมา**
  - สามารถกดจับคู่ได้ทันทีและสำเร็จ

---

## 🚀 3. คำแนะนำเพิ่มเติมสำหรับการเขียน Script (Tips)
- ในแท็บโอนเงิน (Transfers) ข้อมูลอาจมีการเปลี่ยนแปลงบ่อย ควรทำการ Mock API (`/Statement_DB/reconcile_list.php`) ในการเทสเพื่อให้ได้ข้อมูลที่คงที่
- เช็ค Validation Message ให้ละเอียด โดยเฉพาะเรื่อง **Shortage Reason** เนื่องจากเป็น Requirement สำคัญทางการเงิน
