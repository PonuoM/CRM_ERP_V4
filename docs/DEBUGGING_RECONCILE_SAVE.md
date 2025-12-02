# วิธี Debug ปัญหา Reconciliation Save

## 🔍 ขั้นตอนการ Debug

### 1. ตรวจสอบ Error Log

ดู error log ของ PHP:
- Windows: `C:\AppServ\php\logs\php_error.log` หรือ
- ดูใน console ที่รัน PHP

### 2. ตรวจสอบ Connection Collation

รัน:
```bash
php migrations/test_reconcile_insert.php
```

Script นี้จะตรวจสอบ:
- Connection collation
- Table/Column collations
- String comparison
- INSERT statement syntax

### 3. ตรวจสอบ Error Message เต็ม

เมื่อเกิด error ให้ดู:
- Error message เต็ม (มี `SQLSTATE`, `COLLATION`, etc.)
- SQL State code (เช่น `1267` = collation mismatch)
- ตำแหน่งที่เกิด error (INSERT, UPDATE, หรือ WHERE)

### 4. ตรวจสอบ Collation ของ Columns

ตรวจสอบว่า columns ใช้ collation ตรงกัน:
```sql
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('orders', 'statement_reconcile_logs', 'statement_reconcile_batches')
  AND COLUMN_NAME IN ('id', 'order_id', 'document_no', 'bank_display_name');
```

ควรเห็นว่า **ทุก column ใช้ `utf8mb4_unicode_ci`**

### 5. ทดสอบ INSERT โดยตรง

ลอง INSERT ข้อมูลทดสอบ:
```sql
-- ทดสอบ INSERT statement_reconcile_logs
INSERT INTO statement_reconcile_logs
  (batch_id, statement_log_id, order_id, statement_amount, confirmed_amount, auto_matched)
VALUES
  (1, 1, 'TEST-001', 100.00, 100.00, 0);
```

ถ้า error → ปัญหาอยู่ที่ INSERT statement
ถ้า success → ปัญหาอาจมาจาก validation หรือ logic อื่น

## 🛠️ วิธีแก้ไข

### ถ้า Error เป็น Collation Mismatch:

1. **ตรวจสอบ Connection Collation**
   - ต้องเป็น `utf8mb4_unicode_ci`
   - ตั้งค่าใน `db_connect()` และ `reconcile_save.php`

2. **ตรวจสอบ Column Collations**
   - ใช้ `utf8mb4_unicode_ci` ทั้งหมด
   - แก้ไขด้วย migration scripts

3. **เพิ่ม COLLATE ใน Queries**
   - ทุก string comparison ต้องมี `COLLATE utf8mb4_unicode_ci`
   - ใช้ CAST สำหรับ parameters

### ถ้า Error เป็น Foreign Key Constraint:

1. **ตรวจสอบว่า Columns มี Collation ตรงกัน**
   - `statement_reconcile_logs.order_id` = `orders.id`
   - ต้องมี collation ตรงกัน

2. **ตรวจสอบว่า Data มีอยู่จริง**
   - Order ID ที่จะ INSERT ต้องมีใน `orders` table
   - Batch ID ต้องมีใน `statement_reconcile_batches` table

## 📋 Checklist

- [ ] Connection collation เป็น `utf8mb4_unicode_ci`
- [ ] Tables ใช้ `utf8mb4_unicode_ci`
- [ ] Columns ใช้ `utf8mb4_unicode_ci`
- [ ] INSERT statements ใช้ CAST
- [ ] WHERE clauses ใช้ COLLATE
- [ ] Foreign keys มี collation ตรงกัน
- [ ] Error log แสดง error message เต็ม

