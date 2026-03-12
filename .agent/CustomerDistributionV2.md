# ระบบแจกรายชื่อ V2 (Customer Distribution V2)

## 1. ภาพรวม (Overview)
ระบบ "แจกรายชื่อ V2" ออกแบบมาเพื่อบริหารจัดการและกระจายรายชื่อลูกค้า (Leads/Customers) จาก "ถังกลาง" (Baskets) ไปยังพนักงานขาย (Telesale) เพื่อให้เกิดการติดต่อและสร้างยอดขาย รวมถึงมีความสามารถในการ "ดึงคืน" (Reclaim) รายชื่อกลับเข้าถังกลาง

## 2. องค์ประกอบหลัก (Core Components)

### 2.1 ถังลูกค้า (Baskets)
- **Concept**: ลูกค้าจะถูกจัดกลุ่มลงใน "ถัง" (Baskets) ตามเงื่อนไขต่างๆ (เช่น ลูกค้าใหม่, ลูกค้าเก่า 1-2 เดือน, Upsell ฯลฯ)
- **Configuration**: ข้อมูลถังถูกดึงมาจาก `basket_config.php`
- **Dashboard Baskets**: ชุดถังที่แสดงในตารางพนักงาน ใช้สำหรับดูภาพรวมว่าพนักงานแต่ละคนถือครองรายชื่อในถังหลักๆ เท่าไหร่

### 2.2 บทบาทผู้ใช้งาน (User Roles)
- **Supervisor/Admin**: ผู้ใช้งานที่จะเข้ามาทำการแจกรายชื่อ
- **Telesale**: พนักงานขายที่เป็น "ผู้รับ" รายชื่อ (Target Agents)

## 3. ขั้นตอนการแจกรายชื่อ (Distribution Workflow)

กระบวนการแจกรายชื่อแบ่งออกเป็นขั้นตอนดังนี้:

### ขั้นตอนที่ 1: ตั้งค่าการแจก (Distribution Settings)
1. **เลือกสถานะการแจก (Source Basket)**: เลือกถังต้นทางที่มีลูกค้าพร้อมแจก (Available Pool)
2. **ระบุจำนวนรวม (Total Amount)**: ใส่จำนวนลูกค้าทั้งหมดที่ต้องการแจกในรอบนี้
   - ระบบจะคำนวณจำนวนเฉลี่ยต่อคนให้อัตโนมัติ (Average per Person)
   - *ตัวอย่าง*: มีรายชื่อ 1000, เลือก 5 คน -> แจกคนละ 200

### ขั้นตอนที่ 2: เลือกพนักงานเป้าหมาย (Select Target Agents)
- แสดงตารางรายชื่อพนักงาน Telesale ทั้งหมด
- **ข้อมูลในตาราง**: แสดงจำนวนลูกค้าที่พนักงาน "ถือครองอยู่" ในปัจจุบัน แยกรายถัง (Dashboard Baskets)
- **การเลือก**: ติ๊กเลือกพนักงานที่ต้องการให้ได้รับงาน (สามารถ Select All ได้)

### ขั้นตอนที่ 3: ดูตัวอย่างและตรวจสอบ (Preview & Logic)
- กดปุ่ม **"ดูตัวอย่างก่อนแจก" (Preview)** ระบบจะจำลองการแจกรายชื่อโดยใช้ **Conflict-Aware Smart Allocation**:
   1. **ดึง Conflict Data** (async): เรียก API `Distribution/index.php?action=get_assign_checks` เพื่อดึงประวัติว่าลูกค้าแต่ละคนเคยอยู่กับ agent ใดบ้างจากตาราง `customer_assign_check`
   2. **Most Constrained First**: เรียงลูกค้าตามจำนวน conflict มากสุดก่อน เพราะมีตัวเลือก agent น้อยกว่า ต้องจัดก่อนจึงจะเหลือตัวเลือกให้
   3. **Greedy Assignment (Pass 1)**: วนลูกค้าทีละคน → หา agent ที่ดีที่สุด (ไม่ซ้ำ + ได้ลูกค้าน้อยสุดในรอบนี้ + ยังมี quota)
   4. **Fallback (Pass 2)**: ลูกค้าที่ conflict ครบทุก agent แล้ว → ยอมให้ agent ที่ได้น้อยสุด (allow conflict)
   5. **Shortfall Alert**: หากแจกไม่ครบ ระบบจะแจ้งเตือนว่าพนักงานคนไหนได้น้อยกว่าโควต้า

### ขั้นตอนที่ 4: ยืนยันการแจก (Execute)
- เมื่อกดแจก ระบบจะเรียก API `Distribution/index.php?action=distribute`
- **ผลลัพธ์**: ลูกค้าจะถูกย้ายจากถังกลาง และบันทึกประวัติลง `customer_assign_check`

## 4. ระบบการดึงคืน (Reclaim System)

ฟีเจอร์สำหรับดึงรายชื่อลูกค้าจากมือพนักงานกลับเข้าถังกลาง

### วิธีใช้งาน
1. กดที่ปุ่ม **"ดึงคืน" (Reclaim)** ในแถวของพนักงานที่ต้องการจัดการ
2. **Modal ดึงคืน**:
   - ระบบจะแสดงรายการถังต่างๆ ที่พนักงานคนนั้นถือครองอยู่
   - ช่องกรอกจำนวน: ระบุจำนวนที่ต้องการดึงคืนจากแต่ละถัง
   - *ข้อจำกัด*: สามารถดึงคืนได้เฉพาะถังที่มีการผูกกับ Distribution Basket เท่านั้น (Linked Basket)
3. **ยืนยัน**: เมื่อกดยืนยัน ระบบจะปลด `agent_id` ของลูกค้าเหล่านั้นออก และย้ายกลับเข้าถังกลาง

## 5. ระบบโอนรายชื่อ (Transfer System) [NEW]

ฟีเจอร์สำหรับโอนรายชื่อลูกค้าจากพนักงานคนหนึ่งไปยังพนักงานอีกคน

### วิธีใช้งาน
1. กดปุ่ม **"ดึงคืน"** ในแถวของพนักงานต้นทาง
2. ในแต่ละถัง จะมีปุ่ม **"โอน"** สีฟ้า (ข้างปุ่ม "คืนหมด")
3. กดปุ่ม "โอน" → **Transfer Modal** จะเปิดขึ้นมา
4. เลือกพนักงานปลายทางจากรายการ
5. กด **"ยืนยันโอน"**

### เงื่อนไขการโอน
| ประเภทถัง | คืนหมด | โอน |
|-----------|--------|-----|
| มี linked_basket_key | ✅ ได้ | ✅ ได้ |
| ไม่มี linked_basket_key (เช่น ส่วนตัว 1-2 เดือน) | ❌ ไม่ได้ | ✅ ได้ |

### การทำงานในฐานข้อมูล
- อัปเดต `assigned_to` เป็น agent ปลายทาง
- อัปเดต `date_assigned` เป็นวันที่โอน
- เพิ่ม agent ปลายทางลงใน `previous_assigned_to` (JSON array)
- บันทึก log ใน `basket_transition_log` (transition_type = 'transfer')
- **หมายเหตุ**: ไม่มีการป้องกันโอนซ้ำ - เป็นการบังคับโอน

### API Endpoint
- **POST** `basket_config.php?action=transfer_customers`
  - Body: `{ from_agent_id, to_agent_id, basket_key, count }`

## 6. ระบบล้างรอบ (Manual Round Reset) [NEW]

ฟีเจอร์สำหรับ "ล้างประวัติการถือครอง" เพื่อให้สามารถแจกซ้ำพนักงานเดิมได้อีกครั้ง (เริ่มนับรอบใหม่)

### วิธีใช้งาน
1. กดปุ่ม **"Manual Reset"** มุมขวาบน
2. **เลือกรอบ**: ระบุจำนวนครั้งที่ลูกค้าถูกแจกไปแล้ว (Target Count) เช่น "รอบที่ 1 (ลูกค้า 67,329 รายชื่อ)"
3. **Filter** (ค้นหา/กรอง):
   - **ค้นหา (ชื่อ/เบอร์/รหัส)**: พิมพ์ข้อความแล้วกด Enter หรือกดปุ่ม "🔄 กรอง" — ค้นจาก first_name, last_name, phone, customer_id
   - **กรองตาม Agent**: dropdown แสดง agent ทั้งหมดที่เคยรับงาน — เลือกเพื่อแสดงเฉพาะลูกค้าที่เคยแจกให้ agent นั้น
4. **ผลลัพธ์**: ตารางแสดงรายชื่อพร้อม **Pagination** (50 ต่อหน้า)
   - **คอลัมน์**: รหัส, ชื่อ-นามสกุล, **เบอร์โทร**, **เคยแจกให้** (รายชื่อ agent), จำนวน
   - **ดูประวัติ**: กดไอคอนรูปตา (Eye) เพื่อดูประวัติการแจก
5. **Action**:
   - **Reset Selected**: เลือกติ๊กถูกรายบุคคลแล้วกด Reset (ยืนยันด้วย Modal สีส้ม)
   - **Reset All**: กดปุ่มแดงเพื่อล้าง *ทั้งหมด* ตามจำนวนที่ค้นหาเจอ (ยืนยันด้วย Modal สีแดง)


## 8. ตะกร้าลูกค้าบล็อค (Blocked Customer Modal) [NEW]

ตะกร้า **block_customer** (basket 55) จะไม่เข้า flow แจกปกติ → เปิด Modal พิเศษแทน

### UI Components
- **Basket Card**: แสดง 🚫 + ตัวอักษรสีแดง, จำนวนดึงจาก `get_blocked_customers.php` (ไม่ใช่ `basket_customers`)
- **BlockedCustomersModal** (`components/BlockedCustomersModal.tsx`)
  - Header: จำนวนลูกค้าบล็อค + ปุ่ม "🔍 ตรวจสอบ Sync"
  - Filter: ค้นหาชื่อ/เบอร์/รหัส + dropdown กรองสาเหตุ
  - Table: checkbox, ชื่อ, เบอร์, สาเหตุบล็อค, บล็อคโดย, วันที่
  - Footer: badge "เลือก N คน" + dropdown ตะกร้าปลายทาง (เฉพาะ target_page='distribution') + ปุ่ม "ปลดบล็อค"

### ปลดบล็อค (Batch Unblock)
1. เลือก checkbox หลายรายชื่อ
2. เลือกตะกร้าปลายทาง (dropdown)
3. กด "✅ ปลดบล็อค" → POST `customer_blocks` body: `{ action: 'batch_unblock', block_ids, target_basket_key, unblockedBy }`
4. ผลลัพธ์: `customer_blocks.active=0` + `customers.is_blocked=0` + `current_basket_key={target}`

### ตรวจสอบ Sync
- กดปุ่ม "🔍 ตรวจสอบ Sync" → เรียก `get_blocked_customers.php?action=check_mismatched`
- ค้นหาลูกค้า `is_blocked=1` ที่ `current_basket_key ≠ 55`
- แสดงชื่อ, ตะกร้าปัจจุบัน, ประเภท (target_page)
- ปุ่มยืนยัน "📦 ย้ายทั้งหมดเข้าตะกร้าบล็อค" → POST `get_blocked_customers.php?action=fix_mismatched`

## 9. สรุปผลการแจก (Summary Modal)
หลังการแจกระบบจะแสดง Modal สรุปผล:
- **ยอดรวม**: สำเร็จ / ล้มเหลว
- **รายพนักงาน**: ตารางแสดงยอดที่พนักงานแต่ละคนได้รับจริง
- **Retry Loop**: หากแจกไม่ครบโควต้า (Shortfall) จะมีปุ่ม **"แจกเพิ่มส่วนที่ขาด"** เพื่อให้ระบบค้นหาลูกค้าใหม่มาเติมให้ครบโดยอัตโนมัติ

## 10. การทำงานเชิงเทคนิค (Technical Implementation)

### 8.1 Main Component
- **File**: `pages/CustomerDistributionV2.tsx`
- **State Management**: ใช้ `useState` และ `useEffect` จัดการข้อมูล Baskets, Agents, และ Customers
- **UI Components**: ใช้ Modal ที่เขียนขึ้นเองแทน `window.confirm` เพื่อความสวยงาม (ConfirmationModal)

### 10.2 Key API Endpoints
- **GET** `basket_config.php`: ดึงการตั้งค่าถัง
- **GET** `Distribution/index.php?action=get_assign_checks`: ดึงข้อมูล conflict (ลูกค้าเคยอยู่กับ agent ใดบ้าง) สำหรับ preview
- **POST** `Distribution/index.php?action=distribute`: Logic การแจกใหม่ + เช็คซ้ำ + บันทึก `customer_assign_check`
- **POST** `Distribution/reset.php`:
  - `get_candidates`: ดึงรายชื่อสำหรับ Reset (support pagination)
  - `manual_reset`: สั่งล้างข้อมูล (`mode='selected'` หรือ `'all'`)
  - `get_assign_history`: ดึงประวัติการแจกของลูกค้า
- **GET** `get_blocked_customers.php`: ดึงรายชื่อ blocked (active=1, MAX(id))
- **GET** `get_blocked_customers.php?action=check_mismatched`: หาลูกค้า is_blocked=1 ที่ basket ≠ 55
- **POST** `get_blocked_customers.php?action=fix_mismatched`: ย้ายลูกค้า is_blocked=1 เข้า basket 55
- **POST** `customer_blocks` body `{action:'batch_unblock'}`: ปลดบล็อคหลายคน + เลือกตะกร้าปลายทาง

### 8.3 Data Logic
- **Conflict-Aware Allocation** (Frontend — `handleGeneratePreview`):
  1. เรียก API `get_assign_checks` ดึง conflict map: `{ customer_id: [agent_ids] }`
  2. Merge กับ `previous_assigned_to` จากข้อมูลลูกค้า (fallback)
  3. เรียงลูกค้าตาม conflict มากสุดก่อน (Most Constrained First)
  4. Pass 1: Greedy assign — หา agent ที่ไม่ซ้ำ + ได้น้อยสุด
  5. Pass 2: Fallback — ยอมให้ agent ที่ได้น้อยสุด (ถ้า conflict ทุก agent)
- **Backend Safety Net** (`Distribution/index.php?action=distribute`):
  - ใช้ตาราง `customer_assign_check` (เก็บประวัติการแจกในรอบปัจจุบัน)
  - ใช้ฟิลด์ `current_round` ในตาราง `customers` (นับรอบการวน)
  - **Pruning**: เช็ค `customer_assign_check` ว่าเคยแจกพนักงานคนนี้หรือยัง → skip ถ้าซ้ำ
  - **Auto Increment**: เมื่อแจกครบทุก agent → เคลียร์ `customer_assign_check` + เพิ่ม `current_round`

### 8.4 Database Schema Changes
- **Tables**: `customer_assign_check`
- **Columns**: `customers.current_round` (INT DEFAULT 1)

## 11. ข้อควรระวัง (Notes)
- **Upsell Basket**: ถัง Upsell มักจะมี Logic พิเศษที่เชื่อมโยงกับถังหลัก
- **Concurrency**: ข้อมูลจำนวนลูกค้า "พร้อมแจก" อาจเปลี่ยนแปลงได้ถ้ามี Admin หลายคนทำงานพร้อมกัน
- **Blocked Basket Count**: ตะกร้า block_customer ดึงจำนวนจาก `get_blocked_customers.php` (ไม่ใช่ `basket_customers` ซึ่งกรอง is_blocked=0)
