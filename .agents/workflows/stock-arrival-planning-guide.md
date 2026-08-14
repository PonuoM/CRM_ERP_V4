# คู่มือระบบวางแผนรับสินค้า (Stock Arrival Planning System)

**TARGET AUDIENCE:** AI Agents และ Human Developers ที่ต้องการเข้ามาดูแลหรือต่อยอดระบบ Stock Arrival Planning

---

## 1. 🏗️ ภาพรวมของระบบ (System Overview)

ระบบวางแผนรับสินค้าถูกออกแบบมาเพื่อให้โกดัง (Warehouse) วางแผนล่วงหน้าได้ว่า สินค้ารายการใดจะเข้าในสัปดาห์ใด/วันใด และมีฟีเจอร์สำหรับตรวจสอบความคืบหน้าว่ารับเข้าจริงแล้วกี่ชิ้น หรือค้างรับอีกเท่าไหร่

### องค์ประกอบหลัก (Core Components)
1. **Calendar View (ปฏิทินแบบสัปดาห์เริ่มวันจันทร์)**: แสดงรายการสินค้าที่จะเข้าในแต่ละวัน โดยมีการคำนวณวันหยุดโรงงานเพื่อหักลบออกจากสัปดาห์
2. **Report View (หน้ารายงาน)**: สรุปภาพรวมรายเดือน เป็นยอดรวมชิ้น และคำนวณเป็น "ตัน" อัตโนมัติ 
3. **Settings View (หน้าตั้งค่า 3 แท็บ)**:
   - **แคตตาล็อกสินค้า**: จัดการรายการสินค้าที่อนุญาตให้เลือกได้ในแพลน (แยกจาก `products` หลักของระบบ เพื่อป้องกันความสับสน)
   - **วันหยุดโรงงาน**: สามารถเปิด/ปิดวันหยุดได้จากปฏิทิน เพื่อไม่ให้มีการนัดหมายรับของในวันหยุด
   - **ตั้งค่าตัวหารตัน**: กำหนดสัดส่วนการคำนวณน้ำหนัก (ชิ้น -> ตัน) เช่น 40 แกลลอน = 1 ตัน

---

## 2. 🗄️ โครงสร้างฐานข้อมูล (Database Schema)

ระบบนี้ใช้ตารางที่ทำงานร่วมกัน 5 ตารางหลัก:
- `stock_arrival_plans`: เก็บข้อมูลแพลนหลัก (รหัสอ้างอิง, สถานะ, ผู้รับผิดชอบ)
- `stock_arrival_plan_items`: เก็บรายการสินค้าในแพลน (product_id, จำนวนที่คาดหวัง, จำนวนที่รับจริง)
- `stock_arrival_products`: **แคตตาล็อกเฉพาะของระบบแพลน** (แยกอิสระจากตาราง `products` หลัก)
- `stock_arrival_factory_holidays`: จัดเก็บวันที่และชื่อของวันหยุดโรงงาน
- `stock_arrival_ton_divisor_history`: ประวัติตัวหารตันของสินค้าแต่ละตัว เพื่อรองรับการเปลี่ยนขนาดบรรจุภัณฑ์ในอนาคต

---

## 3. 🧠 ลอจิกสำคัญ (Critical Business Logic)

### 3.1 การเลื่อนวัน (Rescheduled) — 1 รายการ = 1 วันเท่านั้น
หากสินค้าถูกเลื่อนวันรับ รายการจะแสดงที่ **วันใหม่วันเดียว** (`display_date` = `actual_date ?? expected_date`) ไม่ค้างไว้วันเดิม

> **หมายเหตุประวัติ:** เดิมระบบใช้ "Ghost Rendering" คือเรนเดอร์สำเนาจางๆ (👻 opacity-40) ค้างไว้วันเดิมด้วย
> ถูกถอดออกแล้วเพราะผู้ใช้อ่านแล้วสับสน — เห็นของซ้ำสองวันแล้วแยกไม่ออกว่าวันไหนคือวันจริง
> ถ้าจะเอากลับมา อย่าทำเป็นสำเนาในปฏิทิน ให้ไปทำเป็นไทม์ไลน์ใน Day Panel แทน

ที่มาของรายการที่ถูกเลื่อนแสดงผ่าน `movedFromLabel()` ใน `types.ts` — เป็นข้อความบรรทัดเดียวติดอยู่กับตัวรายการ
(เช่น "เลื่อนจากแพลน 27/07/2569" / "คาดไว้ 11/08/2569") โชว์ทั้งใน tooltip ของปฏิทินและใน Day Panel

### 3.1.1 การแก้ไข: 2 ระดับ
| ระดับ | ที่ | แก้อะไรได้ | API |
|---|---|---|---|
| **แพลน** | ปุ่ม ✏️ หัวการ์ดใน Day Panel | วันที่แพลน, หมายเหตุ, เพิ่ม/ลบ/เปลี่ยนสินค้า, จำนวนแพลน | `update_stock_plan.php` |
| **สินค้ารายตัว** | ปุ่ม "แก้ไขรายการนี้" ในแต่ละแถว | วันที่คาดว่าจะเข้า (= เลื่อนวัน), จำนวน, เลข SO + ยกเลิกวันที่ | `update_stock_plan_expectation.php`, `delete_stock_plan_expectation.php` |

**เส้นแบ่งว่าอะไรแก้ได้/ไม่ได้** — ดูที่ `stock_arrival_plan_expectations.status`:
- `expected` (ยังไม่รับเข้า) = แค่ตารางนัด แก้/ลบ/เปลี่ยนสินค้าได้ตามปกติ
- `confirmed` / `closed_short` = ของเข้าคลังจริงแล้ว เป็นประวัติ **ห้ามแก้** ยกเว้น Super Admin ส่ง `force: true`

ตรรกะนี้อยู่ทั้งใน `update_stock_plan.php` (`locked_qty` / `locked_count`) และ `get_stock_plan.php`
(`open_scheduled_qty` / `locked_qty` / `locked_count`) — **แก้ที่ใดที่หนึ่งต้องแก้อีกที่ด้วย**

### 3.2 การคำนวณเลขสัปดาห์ (Week Number Calculation)
- ระบบใช้มาตรฐาน ISO 8601 (สัปดาห์เริ่มวันจันทร์)
- **วันที่ 1 ของเดือน** อาจไม่ใช่ Week 1 เสมอไป หากวันนั้นไม่ใช่เริ่มสัปดาห์
- การคำนวณจะอิงจากวันจันทร์เป็นหลัก ทำให้คอลัมน์ในปฏิทินวันเสาร์และอาทิตย์ถูกลดขนาดลง (เนื่องจากโรงงานมักไม่มีของเข้า)

### 3.3 แคตตาล็อกสินค้าแบบแยกส่วน (Decoupled Catalog)
- สินค้าที่เข้ามาในโรงงาน บางครั้งอาจเป็น Raw Material หรือ Package ที่ยังไม่มีขายใน `products` หลัก
- ระบบจึงใช้ `stock_arrival_products` โดยอาศัย `sku` เป็นตัวเชื่อมกับสินค้าจริงเมื่อมีการออกออเดอร์ในภายหลัง

---

## 4. 💻 ไฟล์ที่เกี่ยวข้อง (Relevant Files)

**Frontend:**
- `pages/StockArrivalPlanningPage.tsx` (Controller หลัก)
- `components/StockArrivalPlanning/StockPlanCalendar.tsx` (ปฏิทิน)
- `components/StockArrivalPlanning/StockPlanReport.tsx` (รายงานตัน)
- `components/StockArrivalPlanning/StockPlanSettings.tsx` (หน้าตั้งค่า 3 แท็บ)
- `components/StockPlanFormModal.tsx` (ฟอร์มเพิ่ม/แก้ไขแพลน — ระดับแพลน)
- `components/StockPlanExpectationEditModal.tsx` (แก้ไขวันที่/จำนวน/SO — ระดับสินค้ารายตัว)
- `components/StockPlanScheduleModal.tsx` (กำหนดวันที่คาดว่าจะเข้าครั้งแรก), `StockPlanReconcileModal.tsx` (ยืนยันรับเข้า)

**Backend:**
- API สำหรับรายการแพลน: `api/inventory/list_stock_plans.php`, `save_stock_plan.php`
- API ระดับสินค้ารายตัว: `update_stock_plan_expectation.php`, `delete_stock_plan_expectation.php`
- API สำหรับตั้งค่า: `list_stock_plan_products.php`, `save_factory_holiday.php`
- **Migrations:** `062_stock_arrival_products_catalog.sql`, `063_factory_holidays.sql`

---

## 5. 💡 Best Practice & Tips สำหรับการพัฒนาต่อ
- **ประสิทธิภาพ (Performance)**: ในไฟล์ React Component ให้ใช้ `useMemo` เสมอเมื่อต้องแปลงข้อมูล `rows` เป็นโครงสร้าง `itemsByDay` หรือการนับจำนวน 
- **Idempotency**: API อย่าง `save_factory_holiday.php` ออกแบบมารองรับ `ON DUPLICATE KEY UPDATE` ทำให้การยิง API ซ้ำไม่เกิด Error
- **Soft Delete**: เมื่อมีการลบ แนะนำให้ซ่อน (is_deleted = 1) แทนการ Drop เพื่อรักษาประวัติการทำงานของพนักงาน ยกเว้นกรณีลบแพลนที่เพิ่งสร้างผิดพลาด (Hard delete)
