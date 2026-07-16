# แผนการปรับปรุงระบบ (Implementation Plan)

## 1. การแก้ไขปัญหา `MIME type "text/html"` ตอน Deploy
**สาเหตุ:** ปัญหานี้เกิดจากไฟล์ `appBasePath.ts` ถูกตั้งค่าเป็น `const APP_BASE_PATH = '/testweb1/';` ทำให้ตอนที่รัน `npm run host:build` ระบบ Vite ไปสร้าง link อ้างอิงไฟล์ `.js` และ `.css` ชี้ไปที่ `/testweb1/assets/...` แต่พอคุณนำไปวางบน Server จริง (Production) URL ของคุณอาจจะอยู่ที่ Root (เช่น `https://your-domain.com/`) หรือ Path อื่น ทำให้ Server หาไฟล์ไม่เจอ และส่งคืนหน้า `index.html` กลับมาแทนเบราว์เซอร์จึงฟ้อง Error MIME Type
**วิธีแก้ (แจ้งผู้ใช้):** คุณต้องเปลี่ยนค่าในไฟล์ `appBasePath.ts` ให้ตรงกับ Path ของ Server จริง (เช่น `/` ถ้าอยู่หน้าสุด) แล้วสั่ง `npm run host:build` ใหม่
*ปล. เรื่อง Batch Export ที่ยังแสดงแต่ ID Basket ก็เป็นเพราะโค้ด Frontend ตัวใหม่ยังไม่ถูก Build ไปที่โฟลเดอร์ host เนื่องจากปัญหาข้างต้นครับ ถ้า Build ผ่านแล้วจะแสดงชื่อตะกร้า (ถังกลาง 6-9 เดือน) ถูกต้องทันทีครับ*

## 2. การเพิ่มฟังก์ชันแก้ไข Session Tag ย้อนหลัง (Retroactive Session Tag)
**การปรับปรุง Backend (`api/Distribution/index.php`):**
- เพิ่ม Action `update_session_tag` ที่รับ `session_id` และ `session_tag` เพื่ออัปเดตลงในตาราง `distribution_sessions`

**การปรับปรุง Frontend (`pages/CustomerDistributionV2.tsx`):**
- เพิ่มปุ่มไอคอน "ดินสอ" (Edit) ขนาบข้าง Session Tag เดิมในตารางประวัติการแจกงาน (Distribution History)
- เมื่อกดจะเปลี่ยนเป็นช่อง Input เพื่อพิมพ์ Tag ใหม่ และมีปุ่ม Save / Cancel
- เมื่อกด Save จะยิง API ไปอัปเดตและแสดงผลทันที

## 3. การวางแผนระบบแยก Company ในประวัติแจกงาน/ดึงคืน (Best Practice)
**ข้อเท็จจริง:** ระบบ Database ปัจจุบัน **มีคอลัมน์ `company_id` ในตาราง `distribution_sessions` เรียบร้อยแล้ว** (ผมได้เพิ่มเข้าไปในการอัปเดตครั้งก่อนๆ และระบบก็เก็บข้อมูล Company ผูกกับ Session มาตลอด)
**การปรับปรุง (Frontend UI):**
- เพิ่ม Dropdown "เลือกบริษัท (Company Filter)" ในแท็บ **ประวัติแจกงาน** (ขวาบน หรือใกล้ๆ ปุ่ม Export) สำหรับ Super Admin เท่านั้น
- ผูกค่า Dropdown นี้กับ API `list_sessions` เพื่อให้ดึงเฉพาะ Session ของบริษัทที่เลือก (ปัจจุบัน API รองรับตัวแปร `companyId` อยู่แล้ว)
- สิ่งนี้จะทำให้ Super Admin สามารถดูและตรวจสอบประวัติการแจกงานแบบแยกบริษัทได้อย่างเป็นระเบียบและเป็น Best Practice

## User Review Required
> [!IMPORTANT]
> **เกี่ยวกับข้อ 1:** รบกวนคุณตรวจสอบไฟล์ `appBasePath.ts` ว่าปัจจุบันตั้งค่าเป็นอะไร และ URL บน Production ของคุณคืออะไรครับ (เช่น ถ้าเว็บคือ `crm.com/` ก็ต้องตั้งเป็น `/` ครับ)
> **สำหรับข้อ 2 และ 3:** แผนการด้านบนตรงกับความต้องการไหมครับ? ถ้ายืนยัน ผมจะดำเนินการเขียนโค้ดเพื่อเพิ่มฟังก์ชันใส่ Tag ย้อนหลัง และตัวกรองบริษัทในหน้าประวัติให้ทันทีครับ
