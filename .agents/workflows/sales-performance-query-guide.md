---
description: คู่มืออธิบายการดึงข้อมูลและสรุปยอดขายรายบุคคลแบบเจาะจง (Top Sales Performers by SKU, Month, Company, Role)
---

# Sales Performance Query Workflow

เมื่อคุณ (AI Agent) ได้รับคำสั่งจากผู้ใช้ให้ตรวจสอบยอดขายรายบุคคลตามเงื่อนไข (เช่น รุ่น/รหัสสินค้า, ประจำเดือน, บริษัทเรท, แผนก) ให้ปฏิบัติตามขั้นตอนต่อไปนี้อย่างเคร่งครัด เพื่อความรวดเร็ว แม่นยำ และรักษาความถูกต้องของการเข้ารหัสตัวอักษรภาษาไทย (UTF-8)

## 📌 ขั้นตอนที่ 1: วิเคราะห์พารามิเตอร์ของ User
คุณจะต้องแยกตัวแปรเหล่านี้จากคำขอเสมอเพื่อนำไปใช้ในการ Query:
1. **รุ่น/สินค้าที่จะหา (Search Keyword):** ผู้ใช้อาจให้เป็นชื่อหรือรหัสบางส่วน เช่น `6-3-18`, `20-20-20` (นำไปใช้กับ `$search_product`)
2. **เดือน/ช่วงเวลา (Date Range):** หากผู้ใช้ระบุเดือน ให้แปลงเป็น `YYYY-MM-DD` เช่น "มีนา 2569" จะเป็น 1 มีนาคม 2026 ถึง 31 มีนาคม 2026 (นำไปใช้กับ `$start_date` และ `$end_date`)
3. **บริษัทที่จะดู (Company ID):** รหัสระบุสาขาหรือโซน (นำไปใช้กับ `$company_id`)
4. **Role ที่จะนับ (Roles Filtering):** แผนกพนักงานที่จับยอด หากไม่ได้ระบุพิเศษ มักเป็น Telesale ให้นำไปกรองด้วย `u.role IN ('Supervisor Telesale', 'Telesale', '6', '7')`

---

## 💻 ขั้นตอนที่ 2: รัน PHP Script เพื่อเชื่อมต่อ Database โดยตรง
**ห้าม** ดึงผ่าน CLI MySQL ตรงๆ เพื่อหลีกเลี่ยงปัญหา Character encoding เพี้ยนเป็นปรัศนี ให้สร้างและรัน PHP ไปเขียนไฟล์แทน

ให้ใช้ Tool สร้างไฟล์ `api/temp_sales_analyzer.php` ตามโครงสร้างนี้:

```php
<?php
$host = "202.183.192.218";
$user = "primacom_bloguser";
$pass = "pJnL53Wkhju2LaGPytw8";
$dbname = "primacom_mini_erp";
$conn = new PDO("mysql:host=\$host;dbname=\$dbname;charset=utf8mb4", $user, $pass);

// === ตั้งค่าตัวแปรจาก User Request ===
$search_product = "%6-3-18%"; // แก้ไขตามคำขอ
$company_id = 1; // แก้ไขตามคำขอ
$start_date = "2026-03-01 00:00:00"; // แก้ไขตามคำขอ
$end_date = "2026-03-31 23:59:59";  // แก้ไขตามคำขอ
// ===============================

$sql = "SELECT 
  u.first_name, 
  SUM(oi.quantity) as total_qty, 
  SUM(oi.net_total) as total_value
FROM orders o
JOIN order_items oi ON o.id = oi.parent_order_id  -- ต้อง Join ไปยัง parent_order_id
JOIN products p ON oi.product_id = p.id
JOIN users u ON o.creator_id = u.id
WHERE 
  o.company_id = :company_id
  AND (p.sku LIKE :search_product OR p.name LIKE :search_product)
  -- แก้ไข Role ตามคำขอของผู้ใช้ตรงนี้ครับ 
  AND u.role IN ('Supervisor Telesale', 'Telesale', '6', '7')
  AND o.order_status NOT IN ('Cancelled', 'Returned')
  AND o.order_date >= :start_date 
  AND o.order_date <= :end_date
GROUP BY u.id
ORDER BY total_qty DESC;";

$stmt = $conn->prepare($sql);
$stmt->execute([
    ':company_id' => $company_id,
    ':search_product' => $search_product,
    ':start_date' => $start_date,
    ':end_date' => $end_date
]);
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

// บันทึกไฟล์เพื่อให้ AI Agent อ่านกลับ
file_put_contents("temp_sales_result.txt", json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
?>
```

---

## 🚀 ขั้นตอนที่ 3: ขั้นตอนการปฏิบัติตามมาตรฐาน (Execution)
1. ติดตั้งสคริปต์ข้างต้นด้วย `write_to_file`
2. ใช้เครื่องมือ `run_command` ทำการรันคำสั่ง `php api/temp_sales_analyzer.php` 
3. ใช้เครื่องมือ `view_file` เพื่ออ่านค่าที่ Export ออกมาใน `api/temp_sales_result.txt`
4. เมื่อทราบผลข้อมูล นำไปสร้างตารางในรูปแบบ **Markdown เชิงการเมือง/ธุรกิจที่ดูเป็นมืออาชีพทันที (เพื่อให้ User แคปเจอร์หน้าจอส่งต่อผู้บริหารได้เลย)** โดยใส่เหรียญ (🥇🥈🥉) ประดับ 3 อันดับแรกเสมอ 
5. สุดท้ายใช้เครื่องมือเคลียร์การทำงาน: รันคำสั่ง `rm api/temp_sales_analyzer.php api/temp_sales_result.txt` เพื่อลบไฟล์ขยะของระบบทิ้งทันที
