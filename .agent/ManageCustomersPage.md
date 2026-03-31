# ระบบจัดการข้อมูลลูกค้า (Manage Customers Page)

## 1. ภาพรวม (Overview)
ไฟล์ `pages/ManageCustomersPage.tsx` เป็นหน้าจอส่วนกลางที่ใช้สำหรับดูแลและค้นหารายชื่อลูกค้าทั้งหมดในระบบ (คล้ายกับฐานข้อมูล DO Dashboard หรือ All Customers View) รองรับการแสดงสถิติภาพรวมบริษัท, ระบบค้นหาด้วยข้อความ, ระบบตัวกรองข้อมูลขั้นสูง (Advanced Filters), และตารางฐานข้อมูลลูกค้าที่แสดงผลแบบทำงานพร้อมกับฝั่ง Server (Server-side Pagination)

## 2. องค์ประกอบหลัก (UI Components)

### 2.1 สถิติภาพรวม (Stats Cards)
ส่วนบนสุดของหน้าจอจะมีการ์ดสรุปยอด 4 กล่อง ซึ่งประมวลผลแยกจากตารางลูกค้า:
- **ลูกค้าทั้งหมด (Total Customers):** ดึงข้อมูลจาก API `getCustomerStats`
- **ยอดขายรวม (Total Revenue):** ดึงข้อมูลยอดขายสุทธิจาก API `getOrderStats`
- **ออเดอร์ทั้งหมด (Total Orders):** นับจำนวนบิลทั้งหมดจาก API `getOrderStats`
- **ผลการค้นหา (Search Results):** แสดงจำนวนบรรทัดของรายชื่อลูกค้าปัจจุบันที่ผ่านการ Filter (มีประโยชน์มากเมื่อต้องการดูยอด Volume ดิบจากการรัน Advanced Filter)

### 2.2 ระบบตัวกรองและค้นหา (Search & Filters)
ระบบ Filter แบ่งเป็น 2 โซน เพื่อให้หน้าจอไม่รก แต่รองรับเงื่อนไขลึกๆ ได้
- **Basic Search (แถบค้นหาตื้น):** พิมพ์ ชื่อ, นามสกุล หรือโทรศัพท์ แล้วระบบจะค้นหาให้อัตโนมัติ (ใส่ `setTimeout` หน่วง 300ms เพื่อทำ Debounce ป้องกัน API ทำงานหนักเกินไป)
- **Advanced Filters (ตัวกรองระดับลึก):** ปรากฏเมื่อกดปุ่ม "Advanced Filters" มีตัวเลือกเช่น:
  - สถานะผู้ดูแล (Telesale/Supervisor)
  - ข้อมูล Demographic (ชื่อ, เบอร์โทร, จังหวัด)
  - สถานะความสัมพันธ์ (Lifecycle: New, Old, FollowUp ฯลฯ)
  - เกรดลูกค้า (Behavioral status & Grade A-E)
  - ประวัติซื้อ (มีออเดอร์ หรือ ไม่มีออเดอร์)
  - เงื่อนไขกรอบเวลา (วันที่เริ่มมอบหมาย - วันหมดสิทธิ์ Ownership)
  *หมายเหตุ:* เมื่อกรอกข้อมูลใน Advanced Filter เสร็จ ต้องกดปุ่ม **"ค้นหา"** สีฟ้า ระบบจึงจะบันทึก State ลงในชุดตัวแปรประเภท `ap(X)` เช่น `apName`, `apProvince` เพื่อสั่งยิง API ใหม่อีกครั้ง

### 2.3 ปุ่มพิเศษ: รวมข้อมูลลูกค้า (Customer Merge)
อยู่บริเวณเดียวกับแถบ Advanced Filters (ปุ่มสีม่วง) ใช้สำหรับรวมประวัติของลูกค้าที่มีมากกว่า 1 โปรไฟล์ให้กลายเป็นคนเดียวกัน

#### ขั้นตอนการทำงาน
1. พนักงานพิมพ์ค้นหาลูกค้า 2 คนจากช่องค้นหาซ้าย-ขวาใน Modal (`MergeCustomersModal.tsx`)
2. ผลลัพธ์จาก API จะถูก map ผ่าน `mapCustomerFromApi()` เพื่อแปลง snake_case → camelCase ให้แสดงชื่อ-นามสกุลได้ถูกต้อง
3. **คลิกที่ชื่อลูกค้า** จะเปิดแท็บใหม่ไปที่ `?page=Customers&customerId={customer_id}` เพื่อดูรายละเอียดเชิงลึกก่อนตัดสินใจ
4. เลือกว่าโปรไฟล์ใดเป็น **ข้อมูลหลัก (Main Record)** โดยคลิกที่การ์ด
5. กด **ยืนยันรวมประวัติ** → ระบบจะโอนบิล (`orders`) และประวัติโทร (`call_history`) จากโปรไฟล์สำรองไปให้ข้อมูลหลัก

#### รายละเอียดทางเทคนิค
- **Customer ID:** ใช้ `customer.customer_id` (PK จริงในฐานข้อมูล, ตรงกับ `customers.customer_id` INT) ไม่ใช่ `customer.id` (ซึ่งเป็น string ที่ mapper สร้างขึ้น)
- **Backend:** `api/customer/merge.php` — อัปเดต `orders.customer_id` (มี `company_id` filter) และ `call_history.customer_id` (ไม่มี `company_id` เพราะตารางนี้ไม่มีคอลัมน์ดังกล่าว)
- ระบบจงใจไม่ลบโปรไฟล์สำรองทิ้ง (แต่บิลและประวัติโทรจะหายไปอยู่กับเบอร์หลักแทน) เพื่อให้ยังใช้สืบย้อนหลังได้

### 2.4 ตารางลูกค้ารวม (Customer Table)
เรนเดอร์ผ่านการเรียกใช้ Component แยกคือ `<CustomerTable />`  
- **Server-Side Pagination:** หน้าจอนี้จะไม่โหลดลูกค้า 10,000 คนมาไว้ในแรม แต่จะส่งตัวเลข `currentPage` และ `itemsPerPage` แนบไปอัปเดต Query เสมอ
- **พ่วง Callback Actions:** เวลากดปุ่มดูรายละเอียด, เปลี่ยนตัวผู้ดูแล, หรือทำ Upsell จะส่งคำสั่งเหล่านั้นต่อขึ้นไปยัง Props ของ Page (เช่น `onViewCustomer`, `onChangeOwner`) ให้ Component ชั้นบนรับช่วงต่อ

## 3. กลไกการทำงานเบื้องหลัง (Under the Hood)

### 3.1 การจัดเตรียมข้อมูลสำหรับตาราง (Data Fetching)
1. เมื่อ Component โหลด, ตัวกรองแปรเปลี่ยน หรือสลับหน้า ตัว `useEffect` จะสั่งยิง `listCustomers(...)` API
2. ฟังก์ชันนี้จะรวมพารามิเตอร์ทุกตัวที่ Active อยู่ในขณะนั้นส่งไปหลังบ้าน
3. เมื่อได้ Response เป็น `{ total, data }` 
4. ข้อมูลดิบ (data) จะถูกนำมาวิ่งผ่าน `mapCustomerFromApi(r)` เสมอ เพื่อยึดรูปแบบ Data ให้ตรงกับ Typescript `Customer` Type ของระบบฝั่ง Front-end (เพื่อป้องกันบัค Data ทะลุแบบผิดโครงสร้าง)

### 3.2 ระบบโต้ตอบกึ่งเรียลไทม์ (Auto-Refresh / Data Sync)
ผู้พัฒนามีการออกแบบ UX เผื่อให้ Telesale หรือ Admin ทำงานหลายหน้าต่าง ระบบจึงใส่ "ตัวทริกเกอร์แอบโหลดข้อมูล" (`refreshTrigger`) ไว้ 2 สถานการณ์:
1. **Window Visibility Event (`visibilitychange`):** ถ้าผู้ใช้งานสลับแท็บไปเช็ค Facebook เล็กน้อย เมื่อกดสลับแท็บกลับมาหน้า CRM ระบบจะสั่งชุบชีวิตตัวแปร `refreshTrigger + 1` เป็นผลให้การดึงสถิติและตารางลูกค้าแอบทำงานอัปเดตตัวเองอัตโนมัติ 
2. **Global Sync Event (`DATA_SYNC_EVENTS.CUSTOMERS_REFRESH`):** ใช้ Event Listener คอยดักจับสัญญาณจากจุดอื่นในแอป (เช่น หากเปิด Modal เติมออเดอร์เสร็จแล้ว หน้าต่างนั้นสั่งยิง Event นี้ออกมา หน้า ManageCustomer ก็จะพาตัวเองรีเฟรชตารางใหม่เช่นกัน)

## 4. โค้ดเก่า (Legacy Elements)
ในซอร์สโค้ดไฟล์ออริจินัล `ManageCustomersPage.tsx` ยังมีซากอารยธรรม HTML สำหรับเรนเดอร์ตารางลูกค้าตัวเก่าสุด (Legacy Table) รวมถึง Popup Modal รุ่นคลาสสิกฝังอยู่ด้านล่าง แต่ถูกครอบซ่อนปิดการทำงานไว้ด้วยตรรกะ `{false && ...}` และ `className="hidden"` เพื่อใช้เป็น Reference ในการพอร์ตฟีเจอร์ลง `<CustomerTable>` ตัวสมบูรณ์ครับ
