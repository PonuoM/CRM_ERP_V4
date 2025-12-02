# สาเหตุและวิธีแก้ปัญหา Collation Mismatch Error

## 🚨 Error ที่เกิดขึ้น

```
SQLSTATE[HY000]: General error: 1267 Illegal mix of collations 
(utf8mb4_unicode_ci,COERCIBLE) and (utf8mb4_0900_ai_ci,COERCIBLE) 
for operation '='
```

## 📚 ความเข้าใจพื้นฐาน: Collation คืออะไร?

**Collation** คือกฎการเรียงลำดับและการเปรียบเทียบอักขระใน MySQL โดยกำหนดว่า:
- ตัวอักษรตัวพิมพ์ใหญ่และตัวพิมพ์เล็กจะถือว่าเหมือนกันหรือไม่
- ตัวอักษรพิเศษจะเรียงลำดับอย่างไร
- การเปรียบเทียบ string ทำงานอย่างไร

### ตัวอย่าง Collations ที่ใช้ในโปรเจคนี้:

1. **`utf8mb4_0900_ai_ci`** (MySQL 8.0+ default)
   - `0900` = Unicode 9.0.0
   - `ai` = Accent Insensitive (ไม่สนใจ accent เช่น á = a)
   - `ci` = Case Insensitive (ไม่สนใจตัวพิมพ์ใหญ่/เล็ก เช่น A = a)

2. **`utf8mb4_unicode_ci`** (MySQL 5.7 default)
   - ใช้ UCA (Unicode Collation Algorithm)
   - รองรับการเรียงลำดับตาม Unicode standard
   - ใช้ใน MySQL เวอร์ชันเก่ากว่า

## 🔍 สาเหตุของปัญหา

### 1. ตารางที่เกี่ยวข้องมี Collation ไม่ตรงกัน

เมื่อตรวจสอบฐานข้อมูล พบว่า:

| ตาราง | Column | Collation ที่ใช้ | ปัญหา |
|-------|--------|------------------|-------|
| `bank_account` | `bank` | `utf8mb4_unicode_ci` | ใช้ Unicode collation |
| `bank_account` | `bank_number` | `utf8mb4_unicode_ci` | ใช้ Unicode collation |
| `statement_reconcile_batches` | `bank_display_name` | `utf8mb4_0900_ai_ci` | ใช้ 0900 collation ❌ |
| `orders` | `id` | `utf8mb4_0900_ai_ci` | ใช้ 0900 collation |
| `statement_reconcile_logs` | `order_id` | `utf8mb4_0900_ai_ci` | ใช้ 0900 collation |
| `statement_logs` | `bank_display_name` | `utf8mb4_unicode_ci` | ใช้ Unicode collation |

### 2. กระบวนการที่เกิด Error

เมื่อระบบพยายามบันทึกข้อมูลการตรวจสอบ (reconciliation):

```php
// Step 1: ดึงข้อมูลจาก bank_account (utf8mb4_unicode_ci)
$bank = $bankStmt->fetch();
$bankDisplayName = trim($bank["bank"] . " - " . $bank["bank_number"]);
// $bankDisplayName ตอนนี้เป็น string ที่มี implicit collation = utf8mb4_unicode_ci

// Step 2: พยายาม INSERT เข้า statement_reconcile_batches
INSERT INTO statement_reconcile_batches 
  (bank_display_name) 
VALUES 
  (:bankName)
// Column bank_display_name ใช้ utf8mb4_0900_ai_ci
// แต่ค่าที่ส่งไปมี collation utf8mb4_unicode_ci
// MySQL ไม่สามารถเปรียบเทียบหรือแปลงได้โดยอัตโนมัติ → ERROR!
```

### 3. ทำไม MySQL ถึงไม่แปลงให้อัตโนมัติ?

MySQL มีกฎการแปลง Collation:
- ถ้า string มี collation ต่างกัน MySQL จะพยายามแปลงให้ตรงกัน
- แต่ถ้า collation แตกต่างกันมาก (เช่น `utf8mb4_unicode_ci` vs `utf8mb4_0900_ai_ci`) MySQL จะไม่อนุญาตให้เปรียบเทียบโดยตรง
- ต้องระบุ COLLATE clause หรือแปลง collation ให้ตรงกันก่อน

### 4. จุดที่เกิด Error ตามลำดับ

```
1. ✅ SELECT จาก bank_account → ได้ string (utf8mb4_unicode_ci)
2. ✅ Concatenate string → ได้ $bankDisplayName (utf8mb4_unicode_ci)
3. ❌ INSERT INTO statement_reconcile_batches (bank_display_name)
   → Column ใช้ utf8mb4_0900_ai_ci
   → Value ใช้ utf8mb4_unicode_ci
   → MySQL ไม่อนุญาต → ERROR 1267!
```

## 💡 วิธีแก้ไข

### วิธีที่ 1: Align Collation ของ Columns ให้ตรงกัน (วิธีที่ใช้)

ปรับ collation ของ `statement_reconcile_batches.bank_display_name` ให้ตรงกับ `bank_account.bank`:

```sql
-- Detect collation ของ bank_account
SELECT COLLATION_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'bank_account' AND COLUMN_NAME = 'bank';
-- Result: utf8mb4_unicode_ci

-- แก้ไข column ให้ใช้ collation เดียวกัน
ALTER TABLE statement_reconcile_batches 
MODIFY bank_display_name VARCHAR(150) 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci NULL;
```

### วิธีที่ 2: ใช้ COLLATE Clause ใน INSERT

```sql
INSERT INTO statement_reconcile_batches (bank_display_name)
VALUES (:bankName COLLATE utf8mb4_0900_ai_ci)
```

แต่วิธีนี้ต้องระบุทุกครั้งที่ INSERT

### วิธีที่ 3: ใช้ CAST/CONVERT

```sql
INSERT INTO statement_reconcile_batches (bank_display_name)
VALUES (CONVERT(:bankName USING utf8mb4) COLLATE utf8mb4_0900_ai_ci)
```

## 🔧 การแก้ไขที่ทำในโค้ด

### 1. Auto-detect และ Align Collation

ในฟังก์ชัน `ensure_reconcile_tables()`:

```php
// Detect collation ของ bank_account.bank
$bankCollationCheck = $pdo->query("
  SELECT COLLATION_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'bank_account' 
    AND COLUMN_NAME = 'bank'
  LIMIT 1
");
$bankCollation = $bankCollationCheck->fetchColumn();
// Result: utf8mb4_unicode_ci

// แก้ไข column ให้ใช้ collation เดียวกัน
$sql = "ALTER TABLE statement_reconcile_batches 
        MODIFY bank_display_name VARCHAR(150) 
        CHARACTER SET utf8mb4 
        COLLATE `{$bankCollation}` NULL";
$pdo->exec($sql);
```

### 2. Align order_id Collation

```php
// Detect collation ของ orders.id
$ordersCollation = // ... (utf8mb4_0900_ai_ci)

// แก้ไข column ให้ตรงกัน
ALTER TABLE statement_reconcile_logs 
MODIFY order_id VARCHAR(32) 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_0900_ai_ci NOT NULL;
```

### 3. เพิ่ม Error Handling และ Logging

```php
try {
  // ... INSERT operation
} catch (PDOException $e) {
  // Log error details
  error_log("reconcile_save.php PDOException: " . $e->getMessage());
  
  // Check if it's collation error
  if (strpos($e->getMessage(), "collation") !== false) {
    $errorMessage = "Collation mismatch error...";
  }
}
```

## 📋 Checklist การตรวจสอบ Collation

เมื่อพบปัญหา Collation Mismatch ให้ตรวจสอบ:

1. ✅ **ตรวจสอบ Collation ของ Source Table**
   ```sql
   SELECT COLUMN_NAME, COLLATION_NAME 
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'bank_account'
     AND COLUMN_NAME IN ('bank', 'bank_number');
   ```

2. ✅ **ตรวจสอบ Collation ของ Target Table**
   ```sql
   SELECT COLUMN_NAME, COLLATION_NAME 
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'statement_reconcile_batches'
     AND COLUMN_NAME = 'bank_display_name';
   ```

3. ✅ **ตรวจสอบ Foreign Key Relationships**
   ```sql
   SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, 
          REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
   FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'statement_reconcile_logs';
   ```

4. ✅ **Align Collations ให้ตรงกัน**

## 🎯 Best Practices

### 1. ใช้ Collation เดียวกันทั้งโปรเจค

- **แนะนำ:** ใช้ `utf8mb4_unicode_ci` สำหรับ MySQL 5.7
- **หรือ:** ใช้ `utf8mb4_0900_ai_ci` สำหรับ MySQL 8.0+

### 2. ตั้งค่า Collation ตอนสร้าง Table

```sql
CREATE TABLE example (
  id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. ตรวจสอบ Collation ก่อน JOIN หรือ Comparison

```sql
-- ตัวอย่าง: ตรวจสอบก่อน JOIN
SELECT * 
FROM table1 t1
JOIN table2 t2 
  ON t1.name COLLATE utf8mb4_unicode_ci = t2.name COLLATE utf8mb4_unicode_ci;
```

### 4. ใช้ Migration Scripts

สร้าง migration script เพื่อ align collations ทั้งหมด:

```sql
-- migration_align_collations.sql
ALTER TABLE statement_reconcile_batches 
MODIFY bank_display_name VARCHAR(150) 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

ALTER TABLE statement_reconcile_logs 
MODIFY order_id VARCHAR(32) 
CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;
```

## 🔗 อ้างอิง

- [MySQL Collation Documentation](https://dev.mysql.com/doc/refman/8.0/en/charset-collation.html)
- [MySQL Collation Error 1267](https://dev.mysql.com/doc/refman/8.0/en/charset-collation-errors.html)
- [Information Schema Tables](https://dev.mysql.com/doc/refman/8.0/en/information-schema.html)

## 📝 หมายเหตุ

- ปัญหา Collation Mismatch มักเกิดขึ้นเมื่อ:
  - อัปเกรด MySQL version
  - สร้างตารางในเวลาต่างกัน
  - Import data จากหลายแหล่ง
  - มีการ join ตารางที่สร้างจากระบบต่างกัน

- **วิธีป้องกัน:** ใช้ collation เดียวกันทั้งโปรเจคตั้งแต่เริ่มต้น

