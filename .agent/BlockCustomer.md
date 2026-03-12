---
description: คู่มืออธิบายการทำงานระบบบล็อคลูกค้า (Customer Blocking System)
---

# ระบบบล็อคลูกค้า (Customer Blocking System)

## ภาพรวม

ระบบบล็อคลูกค้าใช้สำหรับ **ระงับลูกค้าที่มีปัญหา** เช่น ลูกค้าที่สั่งแล้วไม่จ่าย, ลูกค้าที่ใช้ข้อมูลปลอม ฯลฯ เมื่อบล็อคแล้ว ลูกค้าจะ:
- ถูกถอดออกจากการดูแลของ Telesale (assigned_to = NULL)
- ไม่ถูกแจกงานให้ Telesale
- ไม่ถูกย้ายตะกร้าจาก cron หรือ event-driven
- ถูกย้ายไปอยู่ตะกร้า **55 (block_customer)**

---

## Database Schema

### ตาราง `customer_blocks`
```sql
CREATE TABLE customer_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  blocked_by INT NOT NULL,          -- user.id ที่บล็อค
  blocked_at DATETIME NOT NULL,
  unblocked_by INT NULL,            -- user.id ที่ปลดบล็อค
  unblocked_at DATETIME NULL,
  active TINYINT(1) DEFAULT 1       -- 1=ยังบล็อคอยู่, 0=ปลดแล้ว
);
```

### คอลัมน์ใน `customers`
| คอลัมน์ | ประเภท | คำอธิบาย |
|---------|--------|---------|
| `is_blocked` | TINYINT(1) | 0=ปกติ, 1=ถูกบล็อค |
| `bucket_type` | VARCHAR(16) GENERATED | คำนวณอัตโนมัติ: `'blocked'` เมื่อ `is_blocked=1` |
| `current_basket_key` | INT | = 55 เมื่อถูกบล็อค |

### ตาราง `basket_config` (ID 55)
| id | basket_key | basket_name | target_page |
|----|-----------|-------------|-------------|
| 55 | block_customer | ลูกค้าติดบล็อค | distribution |

---

## Flow การบล็อค

### บล็อค (Block)
```
หน้า CustomerDetailPage → กดปุ่ม "บล็อค" → ใส่เหตุผล (≥5 ตัวอักษร)
  ↓
services/api.ts → createCustomerBlock({ customerId, reason, blockedBy })
  ↓
POST /api/customer_blocks
  ↓
api/index.php → handle_customer_blocks()
  ├─ INSERT INTO customer_blocks (..., active=1)
  ├─ UPDATE customers SET
  │    assigned_to = NULL,
  │    is_blocked = 1,
  │    current_basket_key = 55,
  │    basket_entered_date = NOW()
  └─ INSERT INTO basket_transition_log (type='blocked')
```

### ปลดบล็อค (Unblock)
```
หน้า CustomerDistributionPage → modal "ลูกค้าที่ถูกบล็อค" → กดปุ่ม "ปลดบล็อค"
  ↓
services/api.ts → unblockCustomerBlock(id, unblockedBy)
  ↓
PATCH /api/customer_blocks/{id}  body: { active: false, unblockedBy }
  ↓
api/index.php → handle_customer_blocks()
  ├─ UPDATE customer_blocks SET active=0, unblocked_by, unblocked_at
  ├─ UPDATE customers SET
  │    is_blocked = 0,
  │    current_basket_key = 52 (ถ้าอยู่ 55),  ← ลูกค้าใหม่ Distribution
  │    basket_entered_date = NOW()
  └─ INSERT INTO basket_transition_log (type='unblocked')
```

---

## ไฟล์ที่เกี่ยวข้อง

### Frontend
| ไฟล์ | หน้าที่ |
|------|--------|
| `pages/CustomerDetailPage.tsx` | ปุ่ม "บล็อค" (line ~1796-1829) |
| `pages/CustomerDistributionPage.tsx` | Modal ดู/ปลด blocked, นับจำนวน blocked, กรอง blocked ออกจากรายชื่อแจก |
| `pages/CustomerPoolsPage.tsx` | Tab "blocked" แยก, กรอง blocked ออกจาก ready/basket/assigned |
| `services/api.ts` | `createCustomerBlock()`, `unblockCustomerBlock()` |
| `services/syncService.ts` | เช็ค `mapped.isBlocked` เมื่อ sync |
| `utils/customerMapper.ts` | Map `is_blocked` → `isBlocked` |
| `types.ts` | `Customer.isBlocked`, `Customer.bucketType` |

### Backend
| ไฟล์ | หน้าที่ |
|------|--------|
| `api/index.php` | `handle_customer_blocks()` — CRUD สำหรับ block/unblock |
| `api/get_blocked_customers.php` | API ดึงรายชื่อ blocked ทั้งหมด (ใช้ใน Distribution modal) |
| `api/Services/BasketRoutingServiceV2.php` | Guard: skip routing ถ้า `is_blocked=1` |
| `api/cron_basket_transition.php` | กรอง `is_blocked=0` (3 จุด) |
| `api/customer/bulk_distribute.php` | กรอง blocked ก่อนแจกงาน |
| `api/customer/distribution_helper.php` | กรอง `is_blocked=0` ทุก query (4 จุด) |
| `api/customer/customer_stats.php` | นับ blocked แยกสถิติ |
| `api/recreate_events.php` | กรอง blocked ออกจาก events |

### Database Migration
| ไฟล์ | คำอธิบาย |
|------|---------|
| `api/Database/29_10_25_1_create_customer_blocks.sql` | สร้างตาราง + เพิ่ม is_blocked, bucket_type |

---

## Guard ที่ป้องกัน blocked customer

### 1. ไม่ถูกแจกงาน
- `bulk_distribute.php` → `WHERE is_blocked = 0`
- `distribution_helper.php` → `WHERE COALESCE(c.is_blocked,0) = 0`

### 2. ไม่ถูกย้ายตะกร้าจาก Cron
- `cron_basket_transition.php` → `AND COALESCE(is_blocked, 0) = 0`
- `BasketRoutingServiceV2::processAgingCustomers()` → `AND COALESCE(c.is_blocked, 0) = 0`

### 3. ไม่ถูกย้ายตะกร้าจาก Order Events
- `BasketRoutingServiceV2::handleOrderStatusChange()` → early return ถ้า `is_blocked=1`

### 4. ไม่แสดงในรายชื่อแจก/ดูแล
- `CustomerDistributionPage` → กรอง `isBlocked` ออก
- `CustomerPoolsPage` → กรอง `isBlocked` ออกจากทุก tab ยกเว้น "blocked"
