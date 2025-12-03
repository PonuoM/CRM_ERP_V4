# MySQL Event Setup สำหรับ Waiting Basket

## ภาพรวม

MySQL Events ถูกใช้เพื่ออัพเดทสถานะลูกค้าอัตโนมัติ:
1. **evt_move_expired_to_waiting_basket**: ย้ายลูกค้าที่หมดอายุ (ownership_expires) เข้าตะกร้ารอ
2. **evt_release_from_waiting_basket**: ปล่อยลูกค้าที่อยู่ในตะกร้ารอ 30 วันแล้วกลับไปแจก

## การตั้งค่า

### 1. เปิดใช้งาน Event Scheduler

```sql
-- ตรวจสอบสถานะ
SHOW VARIABLES LIKE 'event_scheduler';

-- เปิดใช้งาน (ต้องมี SUPER privilege)
SET GLOBAL event_scheduler = ON;
```

### 2. รันสคริปต์สร้าง Events

```bash
# วิธีที่ 1: ใช้ mysql command line
mysql -u root -p mini_erp < api/Database/setup_waiting_basket_events.sql

# วิธีที่ 2: ใช้ MySQL client
mysql -u root -p
USE mini_erp;
source api/Database/setup_waiting_basket_events.sql
```

### 3. ตรวจสอบ Events

```sql
-- ดู Events ทั้งหมด
SHOW EVENTS;

-- ดูรายละเอียด Events
SELECT 
    EVENT_NAME,
    EVENT_DEFINITION,
    INTERVAL_VALUE,
    INTERVAL_FIELD,
    STATUS,
    LAST_EXECUTED,
    NEXT_EXECUTION_TIME
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = 'mini_erp'
  AND EVENT_NAME LIKE 'evt_%';
```

## SQL Query ที่ใช้

### Event 1: ย้ายลูกค้าหมดอายุเข้าตะกร้ารอ

```sql
UPDATE customers
SET is_in_waiting_basket = 1,
    waiting_basket_start_date = NOW(),
    lifecycle_status = 'FollowUp'
WHERE COALESCE(is_blocked, 0) = 0
  AND COALESCE(is_in_waiting_basket, 0) = 0
  AND ownership_expires IS NOT NULL
  AND ownership_expires <= NOW();
```

**เงื่อนไข:**
- `is_blocked = 0` (ไม่ถูกบล็อก)
- `is_in_waiting_basket = 0` (ยังไม่อยู่ในตะกร้ารอ)
- `ownership_expires IS NOT NULL` (มีวันหมดอายุ)
- `ownership_expires <= NOW()` (หมดอายุแล้ว)

### Event 2: ปล่อยลูกค้าจากตะกร้ารอ

```sql
UPDATE customers
SET is_in_waiting_basket = 0,
    waiting_basket_start_date = NULL,
    ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
    lifecycle_status = 'DailyDistribution',
    follow_up_count = 0,
    followup_bonus_remaining = 1,
    assigned_to = NULL
WHERE COALESCE(is_in_waiting_basket, 0) = 1
  AND waiting_basket_start_date IS NOT NULL
  AND TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) >= 30
  AND COALESCE(is_blocked, 0) = 0;
```

**เงื่อนไข:**
- `is_in_waiting_basket = 1` (อยู่ในตะกร้ารอ)
- `waiting_basket_start_date IS NOT NULL` (มีวันเริ่มต้น)
- `TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) >= 30` (อยู่ในตะกร้ารอ 30 วันแล้ว)
- `is_blocked = 0` (ไม่ถูกบล็อก)

## การจัดการ Events

### เปิด/ปิด Event

```sql
-- ปิด Event
ALTER EVENT evt_move_expired_to_waiting_basket DISABLE;

-- เปิด Event
ALTER EVENT evt_move_expired_to_waiting_basket ENABLE;
```

### ลบ Event

```sql
DROP EVENT IF EXISTS evt_move_expired_to_waiting_basket;
DROP EVENT IF EXISTS evt_release_from_waiting_basket;
```

### เปลี่ยนตารางเวลาการรัน

```sql
-- เปลี่ยนเป็นรันทุก 30 นาที
ALTER EVENT evt_move_expired_to_waiting_basket
ON SCHEDULE EVERY 30 MINUTE;
```

## การทดสอบ

### ทดสอบ SQL Query โดยตรง

```sql
-- ดูลูกค้าที่จะถูกย้ายเข้าตะกร้ารอ
SELECT 
    customer_id,
    first_name,
    last_name,
    ownership_expires,
    is_in_waiting_basket,
    is_blocked
FROM customers
WHERE COALESCE(is_blocked, 0) = 0
  AND COALESCE(is_in_waiting_basket, 0) = 0
  AND ownership_expires IS NOT NULL
  AND ownership_expires <= NOW()
LIMIT 10;

-- ดูลูกค้าที่จะถูกปล่อยจากตะกร้ารอ
SELECT 
    customer_id,
    first_name,
    last_name,
    waiting_basket_start_date,
    TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) AS days_in_waiting
FROM customers
WHERE COALESCE(is_in_waiting_basket, 0) = 1
  AND waiting_basket_start_date IS NOT NULL
  AND TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) >= 30
  AND COALESCE(is_blocked, 0) = 0
LIMIT 10;
```

### รัน Event ทันที (สำหรับทดสอบ)

```sql
-- เรียก Event ทันที (ไม่ต้องรอ schedule)
ALTER EVENT evt_move_expired_to_waiting_basket
ON SCHEDULE AT CURRENT_TIMESTAMP;
```

## หมายเหตุ

1. **Event Scheduler ต้องเปิดอยู่**: ถ้า MySQL restart อาจต้องเปิด Event Scheduler ใหม่ (หรือตั้งค่าใน my.cnf)
2. **Privileges**: ต้องมี `EVENT` privilege เพื่อสร้าง/แก้ไข Events
3. **Performance**: Events รันทุก 1 ชั่วโมง เพื่อลดภาระฐานข้อมูล
4. **Manual Run**: ยังสามารถใช้ `scripts/refresh_customer_buckets.sh` เพื่อรัน manual ได้

## Troubleshooting

### Event ไม่ทำงาน

```sql
-- ตรวจสอบ Event Scheduler
SHOW VARIABLES LIKE 'event_scheduler';

-- ตรวจสอบ Events
SHOW EVENTS;

-- ตรวจสอบ Error Log
SHOW EVENTS FROM mini_erp WHERE EVENT_NAME = 'evt_move_expired_to_waiting_basket';
```

### ตรวจสอบ Execution History

```sql
-- ดูเมื่อ Event รันล่าสุด
SELECT 
    EVENT_NAME,
    LAST_EXECUTED,
    NEXT_EXECUTION_TIME,
    STATUS
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = 'mini_erp';
```

