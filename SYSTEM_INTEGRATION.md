
# เอกสารประกอบการพัฒนาระบบ Mini ERP (Frontend-Backend Integration)

เอกสารนี้จัดทำขึ้นเพื่ออธิบายแนวทางการเชื่อมต่อระหว่างแอปพลิเคชันฝั่ง Frontend (ที่พัฒนาด้วย React) กับระบบ Backend ที่จะถูกสร้างขึ้น เพื่อให้ทีมพัฒนาเข้าใจภาพรวมและสามารถทำงานร่วมกันได้อย่างมีประสิทธิภาพ

## 1. ภาพรวมสถาปัตยกรรม (System Architecture)

- **Frontend**: Single Page Application (SPA) พัฒนาด้วย React และ TypeScript
- **Backend**: (สมมติฐาน) RESTful API ที่พัฒนาด้วย Node.js/Express.js หรือเทคโนโลยีอื่น ๆ ที่เหมาะสม
- **Database**: (สมมติฐาน) MySQL หรือ MariaDB ตาม Schema ที่ได้ออกแบบไว้
- **การสื่อสาร**: Frontend จะสื่อสารกับ Backend ผ่าน HTTP requests โดยใช้ JSON เป็นรูปแบบในการรับส่งข้อมูล

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

ฐานข้อมูลถูกออกแบบมาเพื่อรองรับการทำงานของระบบทั้งหมด โดยมีตารางหลัก ๆ ดังนี้:

| ชื่อตาราง (Table Name) | คำอธิบาย (Description) |
| :--- | :--- |
| `companies` | จัดการข้อมูลบริษัท (รองรับ Multi-company) |
| `users` | จัดการข้อมูลผู้ใช้, สิทธิ์การใช้งาน (Role), และการเข้าสู่ระบบ |
| `customers` | ตารางหลักสำหรับเก็บข้อมูลลูกค้าทั้งหมด, ผู้รับผิดชอบ, สถานะ, และเกรด |
| `products` | จัดการข้อมูลสินค้าทั้งหมด (Product Catalog) |
| `orders` | จัดการข้อมูลคำสั่งซื้อ, เชื่อมโยงลูกค้าและผู้ขาย |
| `order_items` | จัดการรายการสินค้าในแต่ละคำสั่งซื้อ |
| `call_history` | บันทึกประวัติการโทรติดต่อลูกค้าของฝ่าย Telesale |
| `appointments` | จัดการการนัดหมายต่าง ๆ กับลูกค้า |
| `activities` | บันทึกประวัติการเปลี่ยนแปลงที่สำคัญของลูกค้า (Audit Trail) |
| `tags` | ตารางเก็บ Tag ที่กำหนดโดยระบบและผู้ใช้ |
| `customer_tags` | ตารางเชื่อมความสัมพันธ์ระหว่างลูกค้าและ Tag (Many-to-Many) |
| `notifications` | จัดการการแจ้งเตือนต่าง ๆ ภายในระบบ |

*หมายเหตุ: นี่คือตารางหลักๆ จาก Schema ที่ได้ออกแบบไว้ก่อนหน้านี้*

---

## 3. การออกแบบ API (Backend API Design)

Backend ควรมี RESTful API endpoints ต่างๆ เพื่อให้ Frontend เรียกใช้งาน โดยแบ่งตาม Resource หลักๆ ดังนี้

**Base URL**: `/api`

### 3.1. การยืนยันตัวตน (Authentication) - `POST /api/auth/login`
- **Request**: `{ username, password }`
- **Response**: `{ token, user: { id, firstName, role, companyId, ... } }`
- **การทำงาน**: รับ username/password, ตรวจสอบข้อมูล, และส่งคืน JWT (JSON Web Token) พร้อมข้อมูลผู้ใช้เบื้องต้น

### 3.2. ลูกค้า (Customers) - `/api/customers`
- `GET /`: ดึงรายชื่อลูกค้าทั้งหมด สามารถกรองข้อมูลผ่าน Query Parameters ได้ เช่น `?assignedTo=2`, `?status=ลูกค้าใหม่`, `?search=มานะ`
- `GET /:id`: ดึงข้อมูลลูกค้า 1 ราย พร้อมข้อมูลที่เกี่ยวข้องทั้งหมด (ประวัติการสั่งซื้อ, การโทร, นัดหมาย, กิจกรรม)
- `POST /`: สร้างลูกค้ารายใหม่
- `PUT /:id`: อัปเดตข้อมูลลูกค้า
- `POST /:id/take`: สำหรับให้ Telesale กดรับลูกค้าที่ยังไม่มีผู้ดูแล (Unassigned)
- `POST /:id/calls`: บันทึกประวัติการโทร (Log Call)
- `POST /:id/appointments`: สร้างนัดหมายใหม่

### 3.3. คำสั่งซื้อ (Orders) - `/api/orders`
- `GET /`: ดึงรายการคำสั่งซื้อทั้งหมด สามารถกรองข้อมูลได้
- `POST /`: สร้างคำสั่งซื้อใหม่ (Endpoint นี้มีความซับซ้อน อาจจะรับข้อมูลลูกค้าใหม่และข้อมูลออเดอร์พร้อมกันใน Request เดียว)
- `PUT /:id`: อัปเดตสถานะคำสั่งซื้อ, สถานะการชำระเงิน, หรือเพิ่มเลข Tracking
- `POST /bulk-tracking`: สำหรับอัปเดตเลข Tracking จำนวนมากพร้อมกัน

### 3.4. ผู้ใช้ (Users) & สินค้า (Products)
- มี CRUD endpoints พื้นฐาน (GET, POST, PUT, DELETE) สำหรับการจัดการผู้ใช้และสินค้า

### 3.5. การนำเข้า/ส่งออกข้อมูล (Data Management)
- `POST /api/import/sales`: นำเข้ายอดขายจากไฟล์ CSV
- `POST /api/import/customers`: นำเข้าเฉพาะรายชื่อลูกค้าจากไฟล์ CSV
- `GET /api/export/reports`: ส่งออกรายงานตามประเภทและช่วงเวลาที่กำหนด

---

## 4. การเชื่อมต่อ Frontend กับ Backend (Integration Mapping)

ส่วนนี้จะอธิบายว่า Component หรือ Page ใน Frontend จะเรียกใช้ API ส่วนไหน

### `App.tsx` (Component หลัก)
- **State Management**: ปัจจุบันใช้ `useState` เพื่อจำลองฐานข้อมูลในหน่วยความจำ ในระบบจริงจะเปลี่ยนเป็นการเรียก API
- **`useEffect`**: เมื่อ Component โหลด, จะต้องเรียก API เพื่อดึงข้อมูลเริ่มต้น เช่น `GET /api/users`, `GET /api/customers`, `GET /api/orders`
- **`handle...` functions**: ฟังก์ชันสำหรับจัดการข้อมูล (เช่น `handleUpdateOrder`, `handleCreateOrder`) จะเป็นส่วนที่เรียก `fetch` หรือ `axios` ไปยัง Backend API
  - **ตัวอย่าง**: `handleUpdateOrder` จะเรียก `PUT /api/orders/:id`
  - หลังจากได้รับการตอบกลับ (Response) จาก API, จะทำการอัปเดต State ใน Frontend เพื่อให้หน้าจอแสดงผลข้อมูลล่าสุด

### หน้า Dashboard ต่างๆ (`TelesaleDashboard.tsx`, `AdminDashboard.tsx`)
- จะเรียก `GET /api/customers` และ `GET /api/orders` โดยใส่ Filter ที่เหมาะสมกับ Role ของผู้ใช้ เช่น Telesale จะเห็นเฉพาะลูกค้าที่ตัวเองดูแล (`?assignedTo=me`)
- การกด Filter ต่างๆ (เช่น สถานะ, เกรด, วันที่) จะเป็นการเรียก API เดิมอีกครั้ง แต่เปลี่ยน Query Parameters

### หน้า Customer Detail (`CustomerDetailPage.tsx`)
- เมื่อผู้ใช้คลิกดูข้อมูลลูกค้า จะมีการเรียก `GET /api/customers/:id` เพื่อดึงข้อมูลเชิงลึกทั้งหมดของลูกค้ารายนั้น
- ปุ่ม Action ต่างๆ (บันทึกการโทร, สร้างนัดหมาย) จะเรียก API ที่เกี่ยวข้อง เช่น `POST /api/customers/:id/calls`

### Modal สำหรับสร้าง/แก้ไขข้อมูล (`CreateOrderModal.tsx`, `UserManagementModal.tsx`)
- เป็นส่วนที่รับผิดชอบการส่งข้อมูล `POST` (สร้างใหม่) และ `PUT` (แก้ไข)
- **`CreateOrderModal.tsx`**: เมื่อกดบันทึก, จะรวบรวมข้อมูลทั้งหมดและส่ง `POST /api/orders` ซึ่ง Backend จะต้องจัดการ Transaction การสร้างลูกค้าใหม่ (ถ้ามี) และการสร้างออเดอร์ให้สมบูรณ์
- **`UserManagementModal.tsx`**: เมื่อกดบันทึก, จะส่ง `POST /api/users` หรือ `PUT /api/users/:id`

### หน้าจัดการข้อมูล (`DataManagementPage.tsx`, `BulkTrackingPage.tsx`)
- **`BulkTrackingPage`**: ปุ่ม "ยืนยันการนำเข้า" จะส่ง `POST /api/orders/bulk-tracking` พร้อมข้อมูลที่ผ่านการตรวจสอบแล้ว
- **`DataManagementPage`**: ปุ่ม "นำเข้า" จะส่ง `POST /api/import/...` และปุ่ม "ส่งออก" จะเรียก `GET /api/export/reports` เพื่อดาวน์โหลดไฟล์

---

## 5. ตัวอย่าง Workflow: "Telesale สร้างออเดอร์ให้ลูกค้าใหม่"

1.  **Frontend**: Telesale เปิดหน้า "จัดการลูกค้า" (`TelesaleDashboard.tsx`) และกดปุ่ม "สร้างคำสั่งซื้อ" ซึ่งจะเปิด `CreateOrderModal.tsx`
2.  **Frontend**: ใน Modal, Telesale ค้นหาลูกค้าแต่ไม่พบ จึงกด "สร้างรายชื่อใหม่"
3.  **Frontend**: กรอกข้อมูลลูกค้าใหม่, ที่อยู่จัดส่ง, และรายการสินค้าจนครบถ้วน แล้วกด "บันทึกออเดอร์"
4.  **Frontend**: `handleCreateOrder` ใน `App.tsx` ถูกเรียก และทำการส่ง Request `POST /api/orders`
5.  **Backend**:
    -   รับ Request ที่มีทั้งข้อมูล `newCustomer` และ `order`
    -   เริ่ม Database Transaction
    -   `INSERT` ข้อมูลลูกค้าใหม่ลงในตาราง `customers`
    -   `INSERT` ข้อมูลออเดอร์ลงในตาราง `orders` โดยใช้ `customer_id` ที่เพิ่งสร้าง
    -   `INSERT` รายการสินค้าลงใน `order_items`
    -   `INSERT` กิจกรรม "สร้างออเดอร์ใหม่" ลงในตาราง `activities`
    -   Commit Transaction
    -   ส่ง Response `201 Created` กลับไปพร้อมข้อมูล Order ที่สร้างขึ้นใหม่
6.  **Frontend**:
    -   เมื่อได้รับ Response สำเร็จ จะทำการอัปเดต State (เพิ่มลูกค้าใหม่, เพิ่มออเดอร์ใหม่)
    -   ปิด Modal และแสดงข้อความแจ้งเตือนว่า "สร้างออเดอร์สำเร็จ"
    -   หน้าจอ Dashboard จะแสดงข้อมูลล่าสุดโดยอัตโนมัติ
