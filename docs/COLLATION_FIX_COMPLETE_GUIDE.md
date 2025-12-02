# คู่มือแก้ไข Collation Mismatch Error แบบสมบูรณ์

## ปัญหา
```
SQLSTATE[HY000]: General error: 1267 Illegal mix of collations 
(utf8mb4_unicode_ci,COERCIBLE) and (utf8mb4_0900_ai_ci,COERCIBLE) for operation '='
```

## สาเหตุ
ปัญหานี้เกิดจากการเปรียบเทียบ string ที่มี collation ต่างกัน:
- `utf8mb4_unicode_ci` - collation ที่ใช้ในฐานข้อมูล
- `utf8mb4_0900_ai_ci` - collation default ของ MySQL 8.0

## วิธีแก้ไขที่สมบูรณ์

### 1. ตั้งค่า Connection Collation ใน `api/config.php`

ในฟังก์ชัน `db_connect()` ให้ตั้งค่า collation ตั้งแต่เริ่มต้น:

```php
$pdo->exec("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");
$pdo->exec("SET SESSION character_set_connection = 'utf8mb4'");
$pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("SET CHARACTER SET utf8mb4");
```

### 2. เพิ่ม COLLATE ในทุก String Comparison

ในทุก SQL query ที่เปรียบเทียบ string ให้เพิ่ม `COLLATE utf8mb4_unicode_ci`:

```sql
-- ตัวอย่าง WHERE clause
WHERE column_name COLLATE utf8mb4_unicode_ci = :parameter

-- ตัวอย่าง JOIN
JOIN table2 t2 ON t1.column COLLATE utf8mb4_unicode_ci = t2.column COLLATE utf8mb4_unicode_ci
```

### 3. ใช้ CAST ใน INSERT/UPDATE สำหรับ String Values

เมื่อ INSERT หรือ UPDATE string values ให้ใช้ CAST:

```sql
INSERT INTO table (string_column)
VALUES (CAST(:value AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci)
```

### 4. ตรวจสอบ Tables และ Columns

รัน script ตรวจสอบ:
```bash
php migrations/verify_all_unicode_ci.php
```

และถ้ายังมีปัญหาก็รัน:
```bash
php migrations/fix_remaining_collations.php
```

## Checklist การแก้ไข

- [x] ตั้งค่า connection collation ใน `db_connect()`
- [x] เพิ่ม COLLATE ใน WHERE clauses
- [x] เพิ่ม COLLATE ใน JOIN conditions
- [x] ใช้ CAST ใน INSERT/UPDATE statements
- [x] ตรวจสอบว่า tables ใช้ utf8mb4_unicode_ci
- [x] ตรวจสอบว่า columns ใช้ utf8mb4_unicode_ci

## Scripts ที่เกี่ยวข้อง

1. `migrations/verify_all_unicode_ci.php` - ตรวจสอบ collation
2. `migrations/fix_remaining_collations.php` - แก้ collation ที่เหลือ
3. `migrations/force_fix_collation_complete.php` - แก้ปัญหา collation แบบสมบูรณ์

## หากยังมีปัญหา

1. ตรวจสอบ error log ของ PHP
2. ตรวจสอบว่า connection collation ถูกตั้งค่าหรือไม่
3. ตรวจสอบว่า parameters ที่ bind เข้า query มี collation ถูกต้อง
4. ลองรัน `migrations/force_fix_collation_complete.php`

