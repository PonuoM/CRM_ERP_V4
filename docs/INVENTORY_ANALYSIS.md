# 📦 การวิเคราะห์ระบบคลังสินค้าสำหรับธุรกิจปุ๋ย

## 🎯 ปัญหาและความต้องการหลัก

### 1. ปัญหาที่ต้องแก้
- ✅ สินค้าแต่ละตัวมีต้นทุนไม่เท่ากัน → ต้องมี **Lot/Batch Management**
- ✅ สินค้าเก็บหลายคลัง → ต้องมี **Multi-Warehouse Stock**
- ✅ การซื้อขายไม่สม่ำเสมอ → ต้องมี **Reorder Point Calculation**
- ✅ ยอดสั่งซื้อไม่รู้จะคำนวณยังไง → ต้องมี **Demand Forecasting**

## 📋 สถานะตารางในระบบ

### ✅ ตารางที่มีอยู่แล้ว (จาก mini_erp.sql)
1. **warehouses** ✓ - คลังสินค้า (มี 4 คลัง)
2. **warehouse_stocks** ✓ - สต๊อกแต่ละคลัง (มีข้อมูล lot_number, quantity, reserved_quantity)
3. **stock_movements** ✓ - ประวัติการเคลื่อนไหว (IN/OUT/TRANSFER/ADJUSTMENT)
4. **stock_reservations** ✓ - การจองสต๊อก (ACTIVE/RELEASED/EXPIRED)
5. **orders** ✓ - มี warehouse_id แล้ว
6. **companies** ✓ - บริษัท
7. **products** ✓ - สินค้า (ต้องเพิ่ม fields)
8. **users** ✓ - ผู้ใช้งาน

### ❌ ตารางที่ยังขาดและต้องเพิ่ม

### 🔴 1. PRODUCT_LOTS (สำคัญที่สุด - ยังไม่มี!)
**ทำไมต้องมี:** ติดตาม cost ของสินค้าแต่ละ lot ที่ซื้อเข้ามา

**⚠️ ปัญหา:** ตอนนี้ `warehouse_stocks` มี `lot_number` เป็น VARCHAR แต่ไม่มีตาราง `product_lots` เพื่อเก็บรายละเอียด lot

**ตารางที่ต้องเพิ่ม:**
```sql
-- ข้อมูล Lot/Batch แต่ละ lot ที่ซื้อเข้ามา
CREATE TABLE product_lots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lot_number VARCHAR(128) NOT NULL UNIQUE,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NULL,
    quantity_received DECIMAL(12,2) NOT NULL,
    quantity_remaining DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL,          -- ต้นทุนต่อหน่วยของ lot นี้
    supplier_id INT NULL,
    supplier_invoice VARCHAR(128) NULL,
    status ENUM('Active','Depleted','Expired') DEFAULT 'Active',
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    INDEX idx_lot_status (status),
    INDEX idx_lot_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**วิธีใช้:**
- เมื่อซื้อสินค้าเข้า 100 กระสอบ ราคากิโลกรัมละ 20 บาท → สร้าง lot ใหม่
- เมื่อขายออก → ตัดจาก lot ที่เก่าที่สุดก่อน (FIFO) หรือตามนโยบาย
- lot_number ต้องเชื่อมกับ warehouse_stocks.lot_number

---

### 🔴 2. SUPPLIERS (ยังไม่มี - ต้องเพิ่ม!)
**ทำไมต้องมี:** ติดตามว่าซื้อจากที่ไหน ราคาเท่าไหร่

**ตารางที่ต้องเพิ่ม:**
```sql
CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(128) NULL,
    phone VARCHAR(64) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    province VARCHAR(128) NULL,
    tax_id VARCHAR(32) NULL,
    payment_terms VARCHAR(128) NULL,           -- เช่น "30 days", "COD"
    credit_limit DECIMAL(12,2) NULL,
    company_id INT NOT NULL,                   -- เชื่อมกับบริษัท
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    INDEX idx_suppliers_company (company_id),
    INDEX idx_suppliers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 🔴 3. PURCHASES + PURCHASE_ITEMS (ยังไม่มี - ต้องเพิ่ม!)
**ทำไมต้องมี:** บันทึกการซื้อสินค้าเข้า

**ตารางที่ต้องเพิ่ม:**
```sql
CREATE TABLE purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_number VARCHAR(64) UNIQUE NOT NULL,
    supplier_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    company_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    expected_delivery_date DATE NULL,
    received_date DATE NULL,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status ENUM('Draft','Ordered','Partial','Received','Cancelled') DEFAULT 'Draft',
    payment_status ENUM('Unpaid','Partial','Paid') DEFAULT 'Unpaid',
    payment_method VARCHAR(64) NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_purchases_supplier (supplier_id),
    INDEX idx_purchases_warehouse (warehouse_id),
    INDEX idx_purchases_status (status),
    INDEX idx_purchases_date (purchase_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    total_cost DECIMAL(12,2) AS (quantity * unit_cost) STORED,
    received_quantity DECIMAL(12,2) DEFAULT 0,
    lot_number VARCHAR(128) NULL,              -- เชื่อมกับ lot ที่สร้างเมื่อรับของ
    notes TEXT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_purchase_items_purchase (purchase_id),
    INDEX idx_purchase_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```


---

## 📈 คำนวณยอดสั่งซื้อ (Reorder Point Calculation)

### วิธีที่ 1: Reorder Point สูตรพื้นฐาน
```
Reorder Point = (Average Daily Usage × Lead Time) + Safety Stock
```

**ตัวอย่าง:**
- ขายเฉลี่ย 50 กระสอบ/วัน
- Lead time (เวลารอของมา) = 7 วัน
- Safety stock (สต๊อกสำรอง) = 100 กระสอบ
- **Reorder Point = (50 × 7) + 100 = 450 กระสอบ**

### วิธีที่ 2: Economic Order Quantity (EOQ)
```
EOQ = √(2 × D × S / H)
```
- D = Demand ต่อปี
- S = Order Cost (ค่าใช้จ่ายต่อครั้งในการสั่งซื้อ)
- H = Holding Cost (ค่าเก็บรักษาต่อหน่วยต่อปี)

### วิธีที่ 3: ABC Analysis + Min-Max
**A-items (20% ของรายการ 80% ของมูลค่า):**
- ติดตามแบบ real-time
- Min = 7 days demand
- Max = 14 days demand

**B-items (30% ของรายการ 15% ของมูลค่า):**
- ตรวจสอบสัปดาห์ละครั้ง
- Min = 14 days demand
- Max = 30 days demand

**C-items (50% ของรายการ 5% ของมูลค่า):**
- ตรวจสอบเดือนละครั้ง
- Min = 30 days demand
- Max = 60 days demand

---

## 🔄 Workflow ที่เสนอ

### 1. รับสินค้าเข้า (Purchase Receiving)
```
1. สร้าง Purchase Order → supplier, warehouse, items
2. เมื่อสินค้ามาถึง → สร้าง Lot ใหม่ (lot_number, unit_cost)
3. อัปเดต warehouse_stocks.quantity += received_quantity
4. บันทึก stock_movements (type='IN')
5. อัปเดต purchase_items.received_quantity
```

### 2. ขายสินค้าออก (Order Fulfillment)
```
1. สร้าง Order
2. ตรวจสอบ available_quantity ในคลังที่ใกล้ที่สุด
3. สร้าง stock_reservations (status='Reserved')
4. อัปเดต warehouse_stocks.reserved_quantity
5. เมื่อจัดส่งจริง:
   - ตัด lot_id ที่เก่าสุด (FIFO) หรือตามนโยบาย
   - อัปเดต product_lots.quantity_remaining
   - อัปเดต warehouse_stocks.quantity
   - บันทึก stock_movements (type='OUT')
   - อัปเดต stock_reservations.status = 'Shipped'
```

### 3. ย้ายคลัง (Transfer)
```
1. ตรวจสอบ available_quantity ที่คลังต้นทาง
2. ลด warehouse_stocks.quantity ที่คลังต้นทาง
3. เพิ่ม warehouse_stocks.quantity ที่คลังปลายทาง
4. บันทึก stock_movements (type='TRANSFER', from_warehouse_id, to_warehouse_id)
```

---

## 🎨 หน้าจอที่ต้องเพิ่ม/แก้ไข

### ✅ หน้าที่มีอยู่แล้ว (เสร็จแล้ว)
1. **Companies Management** ✓ - เชื่อมต่อ API แล้ว
2. **Warehouses Management** ✓ - เชื่อมต่อ API แล้ว
3. **Products Management** ✓ - มีแล้ว (ต้องเพิ่ม fields สำหรับ lot tracking)
4. **Orders** ✓ - มีแล้ว (มี warehouse_id)

### 🔴 Phase 1: หน้าใหม่ที่ต้องสร้างก่อน (ด่วน!)
5. **Suppliers Management** - จัดการผู้จัดจำหน่าย (CRUD)
6. **Purchase Orders** - สร้างใบสั่งซื้อ
7. **Receive Stock** - รับสินค้าเข้า + สร้าง Lot

### 🟡 Phase 2: หน้าที่ต้องสร้างตามมา
8. **Warehouse Stock View** - ดูสต๊อกแต่ละคลัง real-time (แยกตาม lot)
9. **Lot/Batch Tracking** - ติดตาม lot แต่ละ lot (ต้นทุน, วันหมดอายุ)
10. **Stock Transfer** - ย้ายสินค้าระหว่างคลัง
11. **Stock Movements Report** - รายงานการเข้า-ออก

### 🟢 Phase 3: หน้า Advanced
12. **Low Stock Alert** - แจ้งเตือนสินค้าใกล้หมด (ต่ำกว่า reorder point)
13. **Inventory Count** - นับสต๊อกจริง (Stock Take)
14. **Cost Analysis** - วิเคราะห์ต้นทุนตาม lot, คำนวณ COGS
15. **Inventory Dashboard** - Dashboard รวม (มูลค่าสินค้า, slow moving, etc.)

---

## 🔧 การแก้ไข Products Table

### เพิ่ม fields ใน products:
```sql
ALTER TABLE products ADD COLUMN (
    unit VARCHAR(32) DEFAULT 'unit',          -- หน่วย: กก., กระสอบ, ลัง
    is_lot_tracked BOOLEAN DEFAULT TRUE,       -- ติดตาม lot หรือไม่
    default_reorder_point DECIMAL(12,2) NULL,  -- จุดสั่งซื้อเริ่มต้น
    default_safety_stock DECIMAL(12,2) NULL,   -- safety stock เริ่มต้น
    lead_time_days INT NULL,                   -- เวลารอของมา (วัน)
    shelf_life_days INT NULL,                  -- อายุสินค้า (วัน)
    abc_category ENUM('A','B','C') NULL,       -- ABC classification
    min_order_quantity DECIMAL(12,2) NULL,     -- MOQ
    is_active BOOLEAN DEFAULT TRUE
);
```

---

## 📊 Dashboard ที่ควรมี

### 1. Inventory Dashboard
- สต๊อกรวมทั้งหมด
- มูลค่าสินค้าคงเหลือ (inventory value)
- สินค้าใกล้หมด (below reorder point)
- สินค้าใกล้หมดอายุ
- Top selling products
- Slow moving items

### 2. Warehouse Dashboard
- สต๊อกในแต่ละคลัง
- Space utilization
- Pending transfers
- Recent movements

### 3. Purchase Dashboard
- Pending purchase orders
- Expected deliveries
- Supplier performance
- Cost trends

---

## 🎯 การเลือกวิธีคำนวณต้นทุน (Costing Method)

### 1. FIFO (First In First Out) - แนะนำ
**ข้อดี:**
- เหมาะกับสินค้าที่มีอายุ (ปุ๋ย)
- ป้องกันของเสีย
- ต้นทุนสะท้อนราคาตลาดปัจจุบัน

**วิธีทำ:**
- เมื่อขาย → ตัด lot ที่เก่าสุดก่อน
- cost of goods sold = unit_cost ของ lot นั้น

### 2. Weighted Average Cost
**ข้อดี:**
- ง่ายต่อการคำนวณ
- ต้นทุนเรียบ

**วิธีทำ:**
```
Average Cost = (Sum of all lot values) / (Sum of all quantities)
```

### 3. Specific Identification (ระบุเฉพาะ lot)
**ข้อดี:**
- แม่นยำที่สุด
- ติดตามได้ละเอียด

**วิธีทำ:**
- ระบุว่าขาย lot ไหนไป
- ใช้กับสินค้ามูลค่าสูง

---

## 💡 Features ที่เพิ่มมูลค่า

### 1. Barcode/QR Code
- สร้าง barcode สำหรับแต่ละ lot
- Scan เมื่อรับ-จ่าย
- ลดข้อผิดพลาด

### 2. Alert System
- สินค้าต่ำกว่า reorder point
- สินค้าใกล้หมดอายุ (30 วันก่อนหมดอายุ)
- Purchase order ค้างรับ
- Stock variance (ต่างจากการนับ)

### 3. Auto Reorder
- เมื่อสต๊อกต่ำกว่า reorder point
- สร้าง draft purchase order อัตโนมัติ
- คำนวณ quantity จาก EOQ หรือ min-max

### 4. Cost Analysis
- ต้นทุนเฉลี่ยต่อ product
- ต้นทุนแต่ละ lot
- Margin analysis
- Dead stock value

### 5. Mobile App (Future)
- นับสต๊อก
- Scan barcode
- Quick transfer

---

## 📝 สรุปลำดับความสำคัญ

### ✅ ตารางที่มีอยู่แล้ว (ไม่ต้องสร้างใหม่)
1. ✅ **warehouses** - คลังสินค้า (มีแล้ว 4 คลัง)
2. ✅ **warehouse_stocks** - สต๊อกแต่ละคลัง (มี lot_number, quantity, reserved_quantity)
3. ✅ **stock_movements** - ประวัติการเคลื่อนไหว (มีแล้ว)
4. ✅ **stock_reservations** - จองสต๊อก (มีแล้ว)
5. ✅ **companies** - บริษัท (มีแล้ว)
6. ✅ **products** - สินค้า (มีแล้ว แต่ต้องเพิ่ม fields)
7. ✅ **orders** - ออเดอร์ (มี warehouse_id แล้ว)

### 🔴 Phase 1: ตารางที่ต้องสร้าง (ด่วนที่สุด!)
1. ❌ **product_lots** - แยก lot/batch พร้อมต้นทุนแต่ละ lot
2. ❌ **suppliers** - ผู้จัดจำหน่าย/ซัพพลายเออร์
3. ❌ **purchases** - ใบสั่งซื้อสินค้า
4. ❌ **purchase_items** - รายการสินค้าในใบสั่งซื้อ

### 🟡 Phase 2: ปรับปรุง Products Table
- เพิ่ม `is_lot_tracked`, `default_reorder_point`, `default_safety_stock`
- เพิ่ม `lead_time_days`, `shelf_life_days`, `abc_category`
- เพิ่ม `min_order_quantity`

### 🟡 Phase 3: ปรับปรุง warehouse_stocks
- เพิ่ม `reorder_point`, `safety_stock`, `max_stock`
- เพิ่ม `last_counted_date`
- เชื่อม lot_number กับ product_lots table

### 🟢 Phase 4: Features ขั้นสูง
- Low stock alerts - แจ้งเตือนสินค้าใกล้หมด
- Inventory reports - รายงานสต๊อก
- Cost analysis - วิเคราะห์ต้นทุน
- ABC classification - จัดกลุ่มสินค้า
- Demand forecasting - พยากรณ์ความต้องการ
- Auto reorder - สั่งซื้ออัตโนมัติ
- Barcode system - ระบบบาร์โค้ด

---

## 🚀 แผนการพัฒนาที่แนะนำ

### สัปดาห์ที่ 1: Phase 1 - Database Schema (ด่วนที่สุด!)
**เป้าหมาย:** สร้างตารางหลักที่ขาด

1. ✅ **สร้างตาราง product_lots**
   - Migration script
   - ทดสอบการเชื่อม foreign keys
   
2. ✅ **สร้างตาราง suppliers**
   - เพิ่ม company_id เพื่อแยกตามบริษัท
   
3. ✅ **สร้างตาราง purchases + purchase_items**
   - เชื่อม suppliers, warehouses, products
   
4. ✅ **ปรับปรุงตาราง products**
   - ALTER TABLE เพิ่ม fields: is_lot_tracked, default_reorder_point, etc.
   
5. ✅ **ปรับปรุง warehouse_stocks**
   - เชื่อม lot_number กับ product_lots
   - เพิ่ม reorder_point, safety_stock

### สัปดาห์ที่ 2: Phase 1 - API & Backend
**เป้าหมาย:** สร้าง API endpoints

1. **API สำหรับ Suppliers**
   - GET /suppliers
   - POST /suppliers
   - PATCH /suppliers/:id
   - DELETE /suppliers/:id

2. **API สำหรับ Purchases**
   - GET /purchases
   - POST /purchases (สร้างใบสั่งซื้อ)
   - PATCH /purchases/:id
   - POST /purchases/:id/receive (รับสินค้า + สร้าง lot)

3. **API สำหรับ Product Lots**
   - GET /product_lots
   - GET /product_lots/:id
   - PATCH /product_lots/:id (อัปเดตสต๊อก)

### สัปดาห์ที่ 3: Phase 1 - UI Pages
**เป้าหมาย:** สร้างหน้าจอพื้นฐาน

1. **หน้า Suppliers Management**
   - ตาราง suppliers
   - Form เพิ่ม/แก้ไข supplier
   
2. **หน้า Purchase Orders**
   - สร้างใบสั่งซื้อ
   - เลือก supplier, warehouse, สินค้า
   - คำนวณยอดรวม
   
3. **หน้า Receive Stock**
   - เลือก purchase order
   - ระบุ lot number, วันหมดอายุ
   - บันทึกเข้า warehouse_stocks

### สัปดาห์ที่ 4: Phase 2 - Stock Tracking
**เป้าหมาย:** ดูและติดตามสต๊อก

1. **หน้า Warehouse Stock View**
   - แสดงสต๊อกแต่ละคลัง
   - แยกตาม lot
   - แสดงวันหมดอายุ, ต้นทุน
   
2. **หน้า Lot Tracking**
   - รายละเอียด lot
   - ประวัติการเข้า-ออก
   
3. **Low Stock Alerts**
   - Query หา products ที่ต่ำกว่า reorder_point
   - แสดงใน dashboard

### สัปดาห์ที่ 5-6: Phase 3 - Advanced Features
**เป้าหมาย:** Features ขั้นสูง

1. **Stock Transfer**
2. **Inventory Reports**
3. **Cost Analysis**
4. **ABC Classification**

---

## 📋 Checklist สำหรับเริ่มต้น

### ด้าน Database
- [ ] สร้างตาราง product_lots
- [ ] สร้างตาราง suppliers  
- [ ] สร้างตาราง purchases, purchase_items
- [ ] ALTER products table (เพิ่ม fields)
- [ ] ใส่ข้อมูล seed สำหรับทดสอบ

### ด้าน API (PHP)
- [ ] API CRUD suppliers
- [ ] API CRUD purchases
- [ ] API receive stock (สร้าง lot + อัปเดตสต๊อก)
- [ ] API product lots
- [ ] อัปเดต products API (fields ใหม่)

### ด้าน Frontend (React)
- [ ] SuppliersManagementPage.tsx
- [ ] PurchaseOrdersPage.tsx
- [ ] ReceiveStockPage.tsx
- [ ] WarehouseStockViewPage.tsx
- [ ] LotTrackingPage.tsx

### ด้าน Types (TypeScript)
- [ ] Supplier interface
- [ ] Purchase interface
- [ ] PurchaseItem interface
- [ ] ProductLot interface
- [ ] อัปเดต Product interface
- [ ] อัปเดต WarehouseStock interface

---

## ❓ คำถามสำคัญที่ต้องตัดสินใจ

1. **Costing Method:** ใช้ FIFO, Average, หรือ Specific Identification?
   - **แนะนำ:** FIFO เพราะปุ๋ยมีอายุ
   
2. **Lot Numbering:** ใช้ระบบอะไร?
   - **แนะนำ:** `LOT-{PRODUCT_CODE}-{YYYYMMDD}-{SEQ}` เช่น `LOT-FERT001-20251009-001`
   
3. **Reorder Point:** คำนวณอัตโนมัติหรือกำหนดเอง?
   - **แนะนำ:** กำหนดเองตอนเริ่มต้น ค่อยทำ auto-calculation ทีหลัง
   
4. **Supplier Credit:** ต้องติดตามเครดิตหรือไม่?
   - **แนะนำ:** มี แต่ไม่บังคับใช้ตอนเริ่มต้น

---

**พร้อมเริ่มพัฒนาเลยไหมครับ?** 🚀

