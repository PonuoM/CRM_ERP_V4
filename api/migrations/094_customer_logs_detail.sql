-- 094: ทำให้ "กิจกรรมล่าสุด" ของลูกค้าเล่าเรื่องได้จริง
--
-- ก่อนหน้านี้ทุกบรรทัดในฟีดขึ้นว่า "ปรับปรุงข้อมูลลูกค้า" เหมือนกันหมด เพราะ trigger เดิม
-- มีข้อจำกัด 3 อย่าง:
--
--   1. ไม่เก็บ "ที่มา" ของการเปลี่ยน จึงไม่รู้ว่าขาย โอน ดึงคืน แจก หรือย้ายถังตามกฎ
--      ทั้งที่ trigger อีกตัว (trg_customer_audit_update) เก็บ @audit_api_source อยู่แล้ว
--   2. created_by เขียนเป็น NEW.assigned_to คือ "คนที่ได้รับลูกค้า" ไม่ใช่ "คนที่ลงมือทำ"
--      ฟีดจึงชี้คนผิดทุกครั้งที่แอดมินโอนลูกค้าให้เทเล
--   3. has_changes ใช้ <> ซึ่งไม่ NULL-safe การแจกลูกค้าที่ยังไม่มีเจ้าของ (NULL -> คน)
--      เทียบได้ NULL ทั้งก้อนแล้วหลุดทั้งแถว ไม่ถูกบันทึกเลย ทั้งที่เป็นเหตุการณ์ที่อยากรู้ที่สุด
--
-- และเดิมเฝ้าแค่ 3 คอลัมน์ การกดปุ่มแก้ไขข้อมูลลูกค้า (ชื่อ เบอร์ ที่อยู่ บล็อค) จึงไม่ทิ้งร่องรอยใด ๆ
--
-- ไม่ backfill api_source ย้อนหลังในไฟล์นี้ ตาราง 1.5 ล้านแถวคู่กับ audit 3.2 ล้านแถว
-- การ UPDATE มวลชนบน prod แลกไม่คุ้ม ฝั่ง API เติมให้ตอนอ่านทีละ <=200 แถวแทน

-- ต่อท้ายตารางโดยเจตนา ไม่ใช้ AFTER เพราะ AFTER บังคับให้ InnoDB สร้างตาราง 1.5 ล้านแถวใหม่
-- ทั้งก้อนและล็อกการเขียนระหว่างนั้น ส่วนการต่อท้ายเป็น INSTANT ADD COLUMN จบในพริบตา
-- ไม่เพิ่ม index ใหม่ idx_customer_id ที่มีอยู่ครอบคลุมการอ่านของหน้าประวัติแล้ว
ALTER TABLE customer_logs
  ADD COLUMN api_source VARCHAR(64) NULL COMMENT 'ที่มาของการเปลี่ยน จาก @audit_api_source';

DROP TRIGGER IF EXISTS customer_after_update;

DELIMITER $$
CREATE TRIGGER customer_after_update AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
    DECLARE old_json JSON DEFAULT JSON_OBJECT();
    DECLARE new_json JSON DEFAULT JSON_OBJECT();
    DECLARE fields   JSON DEFAULT JSON_ARRAY();

    -- ---- สิทธิ์ครอบครองและถัง: หัวใจของเรื่อง "ใครถือลูกค้ารายนี้อยู่" ----
    IF NOT (OLD.assigned_to <=> NEW.assigned_to) THEN
        SET old_json = JSON_SET(old_json, '$.assigned_to', OLD.assigned_to),
            new_json = JSON_SET(new_json, '$.assigned_to', NEW.assigned_to),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'assigned_to');
    END IF;
    IF NOT (OLD.current_basket_key <=> NEW.current_basket_key) THEN
        SET old_json = JSON_SET(old_json, '$.current_basket_key', OLD.current_basket_key),
            new_json = JSON_SET(new_json, '$.current_basket_key', NEW.current_basket_key),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'current_basket_key');
    END IF;
    IF NOT (OLD.bucket_type <=> NEW.bucket_type) THEN
        SET old_json = JSON_SET(old_json, '$.bucket_type', OLD.bucket_type),
            new_json = JSON_SET(new_json, '$.bucket_type', NEW.bucket_type),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'bucket_type');
    END IF;
    IF NOT (OLD.lifecycle_status <=> NEW.lifecycle_status) THEN
        SET old_json = JSON_SET(old_json, '$.lifecycle_status', OLD.lifecycle_status),
            new_json = JSON_SET(new_json, '$.lifecycle_status', NEW.lifecycle_status),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'lifecycle_status');
    END IF;
    IF NOT (OLD.ownership_expires <=> NEW.ownership_expires) THEN
        SET old_json = JSON_SET(old_json, '$.ownership_expires', OLD.ownership_expires),
            new_json = JSON_SET(new_json, '$.ownership_expires', NEW.ownership_expires),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'ownership_expires');
    END IF;

    -- ---- ปุ่มแก้ไขข้อมูลลูกค้า: เก็บให้ครบเพื่อย้อนดูได้ว่าใครแก้อะไรเป็นอะไร ----
    IF NOT (OLD.first_name <=> NEW.first_name) THEN
        SET old_json = JSON_SET(old_json, '$.first_name', OLD.first_name),
            new_json = JSON_SET(new_json, '$.first_name', NEW.first_name),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'first_name');
    END IF;
    IF NOT (OLD.last_name <=> NEW.last_name) THEN
        SET old_json = JSON_SET(old_json, '$.last_name', OLD.last_name),
            new_json = JSON_SET(new_json, '$.last_name', NEW.last_name),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'last_name');
    END IF;
    IF NOT (OLD.phone <=> NEW.phone) THEN
        SET old_json = JSON_SET(old_json, '$.phone', OLD.phone),
            new_json = JSON_SET(new_json, '$.phone', NEW.phone),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'phone');
    END IF;
    IF NOT (OLD.backup_phone <=> NEW.backup_phone) THEN
        SET old_json = JSON_SET(old_json, '$.backup_phone', OLD.backup_phone),
            new_json = JSON_SET(new_json, '$.backup_phone', NEW.backup_phone),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'backup_phone');
    END IF;
    IF NOT (OLD.recipient_phone <=> NEW.recipient_phone) THEN
        SET old_json = JSON_SET(old_json, '$.recipient_phone', OLD.recipient_phone),
            new_json = JSON_SET(new_json, '$.recipient_phone', NEW.recipient_phone),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'recipient_phone');
    END IF;
    IF NOT (OLD.email <=> NEW.email) THEN
        SET old_json = JSON_SET(old_json, '$.email', OLD.email),
            new_json = JSON_SET(new_json, '$.email', NEW.email),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'email');
    END IF;
    IF NOT (OLD.facebook_name <=> NEW.facebook_name) THEN
        SET old_json = JSON_SET(old_json, '$.facebook_name', OLD.facebook_name),
            new_json = JSON_SET(new_json, '$.facebook_name', NEW.facebook_name),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'facebook_name');
    END IF;
    IF NOT (OLD.line_id <=> NEW.line_id) THEN
        SET old_json = JSON_SET(old_json, '$.line_id', OLD.line_id),
            new_json = JSON_SET(new_json, '$.line_id', NEW.line_id),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'line_id');
    END IF;
    IF NOT (OLD.birth_date <=> NEW.birth_date) THEN
        SET old_json = JSON_SET(old_json, '$.birth_date', OLD.birth_date),
            new_json = JSON_SET(new_json, '$.birth_date', NEW.birth_date),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'birth_date');
    END IF;
    IF NOT (OLD.street <=> NEW.street) THEN
        SET old_json = JSON_SET(old_json, '$.street', OLD.street),
            new_json = JSON_SET(new_json, '$.street', NEW.street),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'street');
    END IF;
    IF NOT (OLD.subdistrict <=> NEW.subdistrict) THEN
        SET old_json = JSON_SET(old_json, '$.subdistrict', OLD.subdistrict),
            new_json = JSON_SET(new_json, '$.subdistrict', NEW.subdistrict),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'subdistrict');
    END IF;
    IF NOT (OLD.district <=> NEW.district) THEN
        SET old_json = JSON_SET(old_json, '$.district', OLD.district),
            new_json = JSON_SET(new_json, '$.district', NEW.district),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'district');
    END IF;
    IF NOT (OLD.province <=> NEW.province) THEN
        SET old_json = JSON_SET(old_json, '$.province', OLD.province),
            new_json = JSON_SET(new_json, '$.province', NEW.province),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'province');
    END IF;
    IF NOT (OLD.postal_code <=> NEW.postal_code) THEN
        SET old_json = JSON_SET(old_json, '$.postal_code', OLD.postal_code),
            new_json = JSON_SET(new_json, '$.postal_code', NEW.postal_code),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'postal_code');
    END IF;
    IF NOT (OLD.grade <=> NEW.grade) THEN
        SET old_json = JSON_SET(old_json, '$.grade', OLD.grade),
            new_json = JSON_SET(new_json, '$.grade', NEW.grade),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'grade');
    END IF;
    IF NOT (OLD.is_blocked <=> NEW.is_blocked) THEN
        SET old_json = JSON_SET(old_json, '$.is_blocked', OLD.is_blocked),
            new_json = JSON_SET(new_json, '$.is_blocked', NEW.is_blocked),
            fields   = JSON_ARRAY_APPEND(fields, '$', 'is_blocked');
    END IF;

    IF JSON_LENGTH(fields) > 0 THEN
        INSERT INTO customer_logs (
            customer_id, bucket_type, lifecycle_status, assigned_to,
            action_type, api_source, old_values, new_values, changed_fields, created_by
        ) VALUES (
            NEW.customer_id, NEW.bucket_type, NEW.lifecycle_status, NEW.assigned_to,
            'update',
            IFNULL(@audit_api_source, 'direct_db'),
            old_json, new_json, fields,
            -- คนที่ลงมือทำ ไม่ใช่คนที่ได้รับลูกค้า ถ้าไม่รู้ก็ปล่อย NULL ให้เห็นว่าไม่รู้
            -- ดีกว่าชี้ผิดคน ส่วนผู้รับยังอ่านได้จากคอลัมน์ assigned_to อยู่แล้ว
            @audit_user_id
        );
    END IF;
END$$
DELIMITER ;
