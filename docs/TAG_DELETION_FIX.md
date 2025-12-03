# การแก้ไขปัญหาการลบ Tag

## ปัญหาที่พบ
เมื่อลบ User Tag แล้ว Tag ไม่ถูกลบออกจากตาราง `tags` ทำให้ Tag สะสมเพิ่มขึ้นเรื่อยๆ

## สาเหตุ
1. API endpoint สำหรับลบ Tag ลบตาราง `customer_tags` และ `user_tags` แต่ลบ `tags` ไม่สำเร็จ
2. Transaction อาจจะ rollback ถ้าเกิด error
3. ไม่มีการตรวจสอบว่า Tag มีอยู่จริงก่อนลบ

## การแก้ไข

### 1. ปรับปรุง API Endpoint (`api/index.php`)

```php
case 'DELETE':
    // 1. ตรวจสอบว่า tag มีอยู่จริงก่อน
    // 2. ลบ customer_tags
    // 3. ลบ user_tags  
    // 4. ลบ tags
    // 5. มี error logging และ error handling ที่ดีกว่า
```

**ตารางที่ถูกลบ:**
1. `customer_tags` - ความสัมพันธ์ระหว่าง Customer กับ Tag
2. `user_tags` - ความสัมพันธ์ระหว่าง User กับ Tag
3. `tags` - ตาราง Tag หลัก

### 2. Frontend (`App.tsx`)
- เพิ่ม callback `handleTagDeleted` เพื่อลบ Tag ออกจาก customers state ทันที
- ส่ง callback ไปยัง `TagsManagementPage`

### 3. Frontend (`pages/TagsManagementPage.tsx`)
- เรียก callback `onTagDeleted` เมื่อลบ System Tag หรือ User Tag

## ตารางที่เกี่ยวข้อง

### `tags`
- เก็บข้อมูล Tag ทั้ง System และ User Tag
- มี `id`, `name`, `type`, `color`

### `user_tags`
- เก็บความสัมพันธ์ระหว่าง User กับ Tag
- Foreign key: `tag_id` → `tags(id)` ON DELETE CASCADE
- Foreign key: `user_id` → `users(id)` ON DELETE CASCADE

### `customer_tags`
- เก็บความสัมพันธ์ระหว่าง Customer กับ Tag
- Foreign key: `tag_id` → `tags(id)` ON DELETE CASCADE
- Foreign key: `customer_id` → `customers(id)` ON DELETE CASCADE

## สิ่งที่ควรตรวจสอบ

### 1. ตรวจสอบ Foreign Key Constraints
```sql
-- ตรวจสอบ foreign key constraints ของ user_tags
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME,
    DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE TABLE_SCHEMA = 'mini_erp'
  AND TABLE_NAME = 'user_tags';

-- ตรวจสอบ foreign key constraints ของ customer_tags
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME,
    DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE TABLE_SCHEMA = 'mini_erp'
  AND TABLE_NAME = 'customer_tags';
```

### 2. ตรวจสอบ Tags ที่ถูกลบแต่ยังอยู่ในตาราง
```sql
-- หา tags ที่ไม่มีใน user_tags หรือ customer_tags อีกต่อไป
SELECT t.* 
FROM tags t
LEFT JOIN user_tags ut ON t.id = ut.tag_id
LEFT JOIN customer_tags ct ON t.id = ct.tag_id
WHERE t.type = 'USER'
  AND ut.tag_id IS NULL
  AND ct.tag_id IS NULL;

-- นับจำนวน tags แต่ละประเภท
SELECT type, COUNT(*) as count 
FROM tags 
GROUP BY type;
```

### 3. ตรวจสอบ Tags ที่ orphan (ไม่มี owner)
```sql
-- หา USER tags ที่ไม่มีใน user_tags
SELECT t.* 
FROM tags t
WHERE t.type = 'USER'
  AND NOT EXISTS (
    SELECT 1 FROM user_tags ut WHERE ut.tag_id = t.id
  );
```

## การทดสอบ

1. **ทดสอบลบ User Tag:**
   - สร้าง User Tag ใหม่
   - เพิ่ม Tag ให้กับ Customer
   - ลบ Tag
   - ตรวจสอบว่า:
     - Tag ถูกลบออกจาก `tags` table
     - ถูกลบออกจาก `user_tags` table
     - ถูกลบออกจาก `customer_tags` table
     - Tag หายไปจากรายชื่อ Customer ทันที

2. **ทดสอบลบ System Tag:**
   - ลบ System Tag ที่มีการใช้งาน
   - ตรวจสอบว่าถูกลบออกจากทุกตาราง

## หมายเหตุ

- การลบ Tag จะลบออกจากทุกตารางใน transaction เดียวกัน
- ถ้าเกิด error ใดๆ จะ rollback ทั้งหมด
- มี error logging เพื่อช่วยในการ debug
- Foreign key CASCADE ควรจะลบอัตโนมัติ แต่เรายังลบ manual เพื่อให้แน่ใจ

