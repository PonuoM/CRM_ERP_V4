---
description: คู่มืออธิบายการทำงานระบบ Customer Audit Log (ติดตามการเปลี่ยนแปลง assigned_to และ current_basket_key)
---

# Customer Audit Log Guide

## ภาพรวม

ระบบ Audit Log ใช้ **MySQL BEFORE UPDATE Trigger** บนตาราง `customers` เพื่อติดตามการเปลี่ยนแปลงฟิลด์ `assigned_to` และ `current_basket_key` อัตโนมัติ ไม่ว่าจะ UPDATE จาก API ใดหรือจาก database โดยตรง

## สถาปัตยกรรม

```
PHP API → set_audit_context($pdo, 'api_name')
         (auto-detect user จาก auth token)
       → UPDATE customers SET assigned_to = ...
       → MySQL TRIGGER (BEFORE UPDATE)
       → INSERT INTO customer_audit_log
```

### การแยกแหล่งที่มา (api_source) — 3 ระดับ

| กรณี | api_source | changed_by |
|---|---|---|
| PHP API + เรียก `set_audit_context()` | ชื่อที่ตั้งไว้ เช่น `basket_config/distribute` | user_id จาก auth token |
| PHP API + **ลืม** `set_audit_context()` | `unknown_api` | NULL |
| UPDATE จาก phpMyAdmin / MySQL CLI | `direct_db` | NULL |
| Cron job + เรียก `set_audit_context()` | ชื่อ cron เช่น `cron/monthly_basket_transfer` | NULL (ไม่มี auth) |

### หลักการทำงาน

1. **INIT_COMMAND:** ทุก PHP connection ตั้ง `@audit_api_source = 'unknown_api'` ตอน connect ผ่าน `MYSQL_ATTR_INIT_COMMAND`
2. **set_audit_context():** ถ้า API เรียกฟังก์ชันนี้ → overwrite เป็นชื่อจริง + auto-detect user จาก auth token
3. **direct_db:** connection จาก phpMyAdmin/CLI ไม่มี INIT_COMMAND → `@audit_api_source = NULL` → trigger เขียน `'direct_db'` ผ่าน `IFNULL()`

## ไฟล์ที่เกี่ยวข้อง

### SQL Migration
- `api/Order_DB/create_customer_audit_log.sql` — CREATE TABLE + CREATE TRIGGER

### Config (Helper Function + INIT_COMMAND)
- `api/config.php` — ฟังก์ชัน `set_audit_context()` + `MYSQL_ATTR_INIT_COMMAND`
- `config.php` (root) — เหมือนกัน
- `host/api/config.php` — copy สำหรับ production (ต้อง `npm run host:build` ทุกครั้งที่แก้ไข)

### API ที่ตั้ง audit context แล้ว

| ไฟล์ | api_source | ทำอะไร |
|---|---|---|
| `api/index.php` | `index/customer_update` | แก้ไขลูกค้าทั่วไป |
| `api/basket_config.php` | `basket_config/distribute` | แจกงาน (bulk assign) |
| `api/basket_config.php` | `basket_config/reclaim` | ดึงงานคืน |
| `api/basket_config.php` | `basket_config/transfer` | โอนงานระหว่าง agent |
| `api/customer/bulk_distribute.php` | `bulk_distribute` | แจกงานแบบ bulk (เก่า) |
| `api/Distribution/index.php` | `distribution_v2` | แจกงาน Distribution V2 |
| `api/Services/BasketRoutingServiceV2.php` | `basket_routing_v2/{type}` | routing อัตโนมัติเมื่อ order เปลี่ยนสถานะ |
| `api/Services/BasketRoutingServiceV2.php` | `basket_routing_v2/assign_owner` | กำหนดเจ้าของลูกค้า |
| `api/Services/UpsellService.php` | `upsell/clear_on_picking` | ย้ายตะกร้าเมื่อ picking |
| `api/Services/UpsellService.php` | `upsell/sale` | ขายสำเร็จ |
| `api/Services/UpsellService.php` | `upsell/no_sale` | ขายไม่ได้ |
| `api/cron_basket_transition.php` | `cron/basket_transition` | cron ย้ายตะกร้าอัตโนมัติ |
| `api/cron/monthly_basket_transfer.php` | `cron/monthly_basket_transfer` | cron ย้ายรายเดือน |
| `api/cron/basket_reevaluate_api.php` | `cron/basket_reevaluate` | ประเมินตะกร้าใหม่ |

## ตาราง customer_audit_log

```sql
CREATE TABLE customer_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,          -- customers.customer_id
  field_name VARCHAR(50) NOT NULL,   -- 'assigned_to' หรือ 'current_basket_key'
  old_value VARCHAR(255),            -- ค่าเดิม
  new_value VARCHAR(255),            -- ค่าใหม่
  api_source VARCHAR(100),           -- API ที่ทำการเปลี่ยน
  changed_by INT,                    -- user_id (auto-detect จาก auth token)
  created_at DATETIME DEFAULT NOW()
);
```

## วิธีใช้งาน

### เพิ่ม audit context ใน API ใหม่

```php
require_once __DIR__ . '/config.php';
$pdo = db_connect();

// เรียกก่อน UPDATE customers
// changed_by จะถูก auto-detect จาก auth token อัตโนมัติ
set_audit_context($pdo, 'my_api/action_name');

// หรือระบุ user_id เอง (กรณี cron หรือ internal)
set_audit_context($pdo, 'my_api/action_name', $userId);

// UPDATE customers SET assigned_to = ...
```

### Query ดู audit log

```sql
-- ดูการเปลี่ยนแปลงลูกค้าคนหนึ่ง
SELECT * FROM customer_audit_log
WHERE customer_id = 12345
ORDER BY created_at DESC;

-- ดูการเปลี่ยนแปลงจาก API ที่ระบุ
SELECT * FROM customer_audit_log
WHERE api_source = 'basket_config/distribute'
ORDER BY created_at DESC
LIMIT 100;

-- ดูการเปลี่ยนแปลงจาก database โดยตรง
SELECT * FROM customer_audit_log
WHERE api_source = 'direct_db'
ORDER BY created_at DESC;

-- ดู API ที่ลืมตั้ง set_audit_context
SELECT * FROM customer_audit_log
WHERE api_source = 'unknown_api'
ORDER BY created_at DESC;

-- ดูการเปลี่ยนแปลงโดย user คนหนึ่ง
SELECT * FROM customer_audit_log
WHERE changed_by = 1655
ORDER BY created_at DESC;
```

### Deploy

1. รัน `api/Order_DB/create_customer_audit_log.sql` ที่ฐานข้อมูล
   - ส่วน CREATE TABLE รันผ่าน phpMyAdmin ได้เลย
   - ส่วน CREATE TRIGGER ต้องรันผ่าน MySQL CLI หรือแยกรันใน phpMyAdmin (เพราะ DELIMITER)
2. Deploy PHP files ที่แก้ไข: `npm run host:build`

### เพิ่มฟิลด์ที่ต้องการติดตาม

แก้ไข trigger ใน `create_customer_audit_log.sql` เพิ่ม IF block:
```sql
IF NOT (OLD.new_field <=> NEW.new_field) THEN
  INSERT INTO customer_audit_log (...)
  VALUES (OLD.customer_id, 'new_field', ...);
END IF;
```
จากนั้น DROP trigger เดิม แล้วสร้างใหม่