---
name: คู่มือระบบทดสอบ E2E (E2E Testing Guide)
description: คู่มืออธิบายโครงสร้างและการทำงานของระบบ E2E Testing ด้วย Playwright แบบ Multi-Role (Telesale, Backoffice, Finance)
---

# คู่มือระบบทดสอบ E2E (E2E Testing Guide)

ระบบทดสอบ End-to-End (E2E) ของโปรเจกต์นี้ถูกพัฒนาด้วย **Playwright** โดยมุ่งเน้นที่การทดสอบแบบ **Multi-Role** ซึ่งจำลองสถานการณ์จริงที่มีการส่งต่องานกันระหว่างผู้ใช้งานหลายตำแหน่ง (Telesale -> Backoffice -> Finance) ใน 1 Flow การทำงาน

---

## 📂 โครงสร้างไฟล์หลัก (Directory Structure)

โค้ดที่เกี่ยวข้องกับการทดสอบ E2E ทั้งหมดจะอยู่ในโฟลเดอร์ `tests/e2e/`

- `tests/e2e/auth.setup.ts` : โค้ดสำหรับจัดการ Authentication (Global Setup)
- `tests/e2e/core-flow.spec.ts` : โค้ดทดสอบ Flow หลักของการสร้างและจัดการคำสั่งซื้อ (Core Business Flow)
- `playwright/.auth/` : โฟลเดอร์ที่ใช้เก็บ Storage State (Cookies/Local Storage) หลังจากการ Login ของแต่ละ Role (ถูกสร้างอัตโนมัติเมื่อรันเทส)

---

## 🔐 การจัดการ Authentication (`auth.setup.ts`)

ระบบถูกออกแบบมาให้ **Login เพียงครั้งเดียว** ก่อนเริ่มการทดสอบหลัก เพื่อลดความซ้ำซ้อนและประหยัดเวลา

1. **Role-Based Setup**: วนลูปเพื่อ Login 3 ตำแหน่ง ได้แก่ `telesale`, `backoffice`, และ `finance`
2. **Handle Common Modals**: ระบบจะจัดการกับ Modal แจ้งเตือนทั่วไปให้อัตโนมัติในตอน Login เช่น:
   - ป๊อปอัป "เริ่มงานวันนี้ไหม?" (Clock In)
   - ป๊อปอัป "รับทราบ" แจ้งเตือนต่างๆ
3. **Storage State**: เมื่อ Login สำเร็จและรอจนแถบเมนูด้านข้าง (Sidebar) โหลดขึ้นมา ระบบจะเซฟ Session ไว้ที่ `playwright/.auth/<role>.json`

---

## 🔄 Core Business Flow (`core-flow.spec.ts`)

ไฟล์นี้ทดสอบ Flow ตั้งแต่สร้างคำสั่งซื้อจนถึงการจัดการหลังบ้าน โดยใช้เทคนิค **Data-Driven Testing** และ **Multi-Context**

### 1. Data-Driven Testing (รูปแบบการชำระเงิน)
เทสเคสจะถูกรันซ้ำ 3 รอบ ตามวิธีการชำระเงินที่แตกต่างกัน:
- **โอนเงิน (Transfer)**: มีขั้นตอนการสร้างภาพจำลอง (Dummy Base64 Image) เพื่ออัปโหลดเป็นสลิปโอนเงิน และดึงยอดสุทธิมากรอก
- **เก็บเงินปลายทาง (COD)**: มีขั้นตอนการกดแบ่งยอดเท่าๆ กัน
- **รับสินค้าก่อน (PayAfter)**: โฟลว์การสั่งซื้อปกติ ไม่ต้องอัปโหลดสลิป

### 2. Multi-Context (แยกหน้าต่างตามผู้ใช้งาน)
แทนที่จะ Login/Logout สลับไปมา ระบบสร้าง Context แยกอิสระ 3 หน้าต่าง:
- `telesaleContext` (ใช้ Session `telesale.json`)
- `backofficeContext` (ใช้ Session `backoffice.json`)
- `financeContext` (ใช้ Session `finance.json`)

### 3. ขั้นตอนการทดสอบ (Steps)
Flow การทำงานถูกแบ่งออกเป็น 5 ขั้นตอน:

- **STEP 1 & 2: Create Order (by Telesale)**
  - ค้นหาลูกค้าเก่าผ่านเบอร์โทรศัพท์ (ถ้าไม่เจอ จะกรอกข้อมูลใหม่)
  - จัดการที่อยู่จัดส่ง โดยจำลองการค้นหาตำบลและอำเภอ (Auto-suggest)
  - เลือกสินค้า ระบุสถานะลูกค้าและช่องทางขาย
  - เลือกการจัดส่งและวิธีการชำระเงิน (ตามรอบ Data-driven)
  - กดยืนยันออเดอร์และรอ Toast แจ้งเตือนความสำเร็จ

- **STEP 3: Manage / Export Data (by Backoffice)** *(กำลังพัฒนา)*
  - Backoffice เข้าสู่หน้า จัดการคำสั่งซื้อ (Manage Orders)
  - ตรวจสอบคำสั่งซื้อในแท็บ "รอส่งออก" และทำการ Export ข้อมูล

- **STEP 4: Tracking Setup (by Backoffice)** *(กำลังพัฒนา)*
  - Backoffice เข้าสู่หน้าผูกเลขพัสดุ (Bulk Tracking)

- **STEP 5: Bank Audit / Statement (by Finance)** *(กำลังพัฒนา)*
  - Finance เข้าสู่หน้าตรวจสอบบัญชีธนาคาร (Bank Account Audit) เพื่อเช็คยอดเงินโอน (สำหรับเคส Transfer)

---

## 🚀 คำสั่งสำหรับรันการทดสอบ (Commands)

ใช้คำสั่งเหล่านี้ใน Terminal เพื่อรัน E2E Test:

- **รันเทสทั้งหมด (โหมดซ่อน UI):**
  ```bash
  npx playwright test
  ```
- **รันเทสแบบมี UI เปิดขึ้นมาให้ดู (UI Mode):**
  ```bash
  npx playwright test --ui
  ```
- **รันเฉพาะเทส Core Flow:**
  ```bash
  npx playwright test tests/e2e/core-flow.spec.ts
  ```
- **ดูรายงานผลการทดสอบ (HTML Report):**
  ```bash
  npx playwright show-report
  ```

> [!TIP]
> หากพบปัญหา Test ไม่ผ่านเพราะ State เก่า ให้ลองลบไฟล์ในโฟลเดอร์ `playwright/.auth/` เพื่อบังคับให้ระบบทำ Authentication Setup ใหม่
