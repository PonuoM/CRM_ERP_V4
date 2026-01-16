# Debt Collection Table Schema

## ตาราง: `debt_collection`

ตารางนี้ใช้สำหรับบันทึกประวัติการติดตามหนี้ของแต่ละ order

## โครงสร้างตาราง

| Field | Type | Null | Key | Description |
|-------|------|------|-----|-------------|
| `id` | INT(11) | NO | PRI | Primary key, Auto increment |
| `order_id` | VARCHAR(50) | NO | MUL | รหัส order ที่ทำการติดตามหนี้ (อ้างอิงจากตาราง orders) |
| `user_id` | INT(11) | NO | MUL | รหัสผู้ใช้ที่ทำการติดตามหนี้ (อ้างอิงจากตาราง users) |
| `amount_collected` | DECIMAL(10,2) | NO | - | จำนวนเงินที่เก็บได้ในครั้งนี้ (default: 0.00) |
| `result_status` | TINYINT(1) | NO | MUL | สถานะผลลัพธ์การติดตามหนี้ |
| `is_complete` | TINYINT(1) | NO | MUL | สถานะการปิดเคส (0=กำลังติดตาม, 1=จบเคสแล้ว) |
| `note` | TEXT | YES | - | บันทึกเพิ่มเติมเกี่ยวกับการติดตามหนี้ |
| `slip_id` | INT(11) | YES | - | รหัสสลิปการชำระเงิน (อ้างอิงจากตาราง order_slips) ถ้ามีการอัพโหลดสลิป |
| `created_at` | TIMESTAMP | NO | MUL | วันที่และเวลาที่สร้างรายการ |
| `updated_at` | TIMESTAMP | NO | - | วันที่และเวลาที่อัปเดตรายการล่าสุด |

## สถานะผลลัพธ์ (result_status)

| Value | Status | Description |
|-------|--------|-------------|
| `1` | Unable to Collect | เก็บเงินไม่ได้ (ติดต่อไม่ได้, ปฏิเสธจ่าย, ฯลฯ) |
| `2` | Collected Some | เก็บเงินได้บางส่วน (จ่ายไม่ครบ) |
| `3` | Collected All | เก็บเงินได้ทั้งหมด (จ่ายครบแล้ว) |

## Indexes

- **PRIMARY KEY**: `id`
- **INDEX**: `idx_order_id` - สำหรับค้นหาประวัติการติดตามหนี้ของ order
- **INDEX**: `idx_user_id` - สำหรับค้นหาประวัติการทำงานของผู้ติดตามหนี้
- **INDEX**: `idx_result_status` - สำหรับกรองตามสถานะผลลัพธ์
- **INDEX**: `idx_is_complete` - สำหรับกรองเคสที่ปิดแล้ว/ยังไม่ปิด
- **INDEX**: `idx_created_at` - สำหรับเรียงลำดับตามวันที่

## Foreign Keys

- `user_id` → `users.id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
  - ป้องกันการลบ user ที่มีประวัติการติดตามหนี้
  - อัปเดต user_id อัตโนมัติเมื่อมีการเปลี่ยนแปลง

## Use Cases

### 1. บันทึกการติดตามหนี้
```sql
INSERT INTO debt_collection 
(order_id, user_id, amount_collected, result_status, note) 
VALUES 
('250115-00001admin1', 5, 1500.00, 2, 'ลูกค้าจ่ายมาบางส่วน 1,500 บาท จากยอดหนี้ 3,000 บาท');
```

### 2. ดูประวัติการติดตามหนี้ของ order
```sql
SELECT dc.*, u.first_name, u.last_name 
FROM debt_collection dc
LEFT JOIN users u ON dc.user_id = u.id
WHERE dc.order_id = '250115-00001admin1'
ORDER BY dc.created_at DESC;
```

### 3. สรุปผลการติดตามหนี้ของพนักงาน
```sql
SELECT 
  u.first_name, 
  u.last_name,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN dc.result_status = 3 THEN 1 ELSE 0 END) as success_count,
  SUM(dc.amount_collected) as total_collected
FROM debt_collection dc
LEFT JOIN users u ON dc.user_id = u.id
WHERE dc.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY dc.user_id;
```

### 4. หา order ที่ยังเก็บเงินไม่ได้
```sql
SELECT DISTINCT dc.order_id, dc.created_at, dc.note
FROM debt_collection dc
WHERE dc.result_status = 1
AND dc.order_id NOT IN (
  SELECT order_id FROM debt_collection WHERE result_status = 3
)
ORDER BY dc.created_at DESC;
```

## Business Rules

1. **การบันทึกประวัติ**: ทุกครั้งที่มีการติดต่อลูกค้าเพื่อเก็บหนี้ ต้องบันทึกลงในตารางนี้ (เป็น log)
2. **amount_collected**: 
   - ถ้า result_status = 1 (เก็บไม่ได้) → amount_collected = 0
   - ถ้า result_status = 2 (เก็บได้บางส่วน) → amount_collected > 0 แต่ < ยอดหนี้คงเหลือ
   - ถ้า result_status = 3 (เก็บได้ทั้งหมด) → amount_collected = ยอดหนี้คงเหลือ
3. **is_complete**: 
   - ปุ่ม "ติดตาม" → บันทึก log ใหม่ด้วย is_complete = 0 (กำลังติดตาม)
   - ปุ่ม "จบเคส" → บันทึก log ใหม่ด้วย is_complete = 1 (ปิดเคสแล้ว)
   - เคสที่ปิดแล้ว (is_complete = 1) จะไม่แสดงในหน้า DebtCollectionPage อีก
4. **slip_id**: บันทึกเฉพาะเมื่อลูกค้าจ่ายเงินและมีการอัพโหลดสลิป
5. **note**: ควรบันทึกรายละเอียดการติดต่อ เช่น วันที่นัดจ่าย, เหตุผลที่จ่ายไม่ได้, ฯลฯ

## Related Tables

- **orders**: ตารางหลักของคำสั่งซื้อ
- **users**: ตารางผู้ใช้งานระบบ (พนักงานที่ทำการติดตามหนี้)
- **order_slips**: ตารางสลิปการชำระเงิน (ถ้ามีการอัพโหลดสลิป)

## Notes

- ตารางนี้เป็น **append-only** ไม่ควรลบหรือแก้ไขข้อมูลเก่า เพื่อเก็บประวัติการติดตามหนี้ไว้ครบถ้วน
- ใช้ `created_at` เป็นตัวกำหนดลำดับเวลาของการติดตามหนี้
- สามารถมีหลายรายการสำหรับ order เดียวกัน (หลายครั้งของการติดตาม)
