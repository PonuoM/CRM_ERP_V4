-- ย้อน 094 กลับเป็น trigger เดิม เผื่อกรณีฉุกเฉิน
--
-- ไม่ต้องลบคอลัมน์ api_source ทิ้ง มันเป็น NULL ได้และไม่มีใครบังคับให้ต้องมีค่า
-- ปล่อยไว้ปลอดภัยกว่าและทำให้รัน 094 ซ้ำได้ทันทีถ้าจะกลับมาใช้อีก
--
-- หมายเหตุ: ของเดิมมีพฤติกรรมที่รู้ทั้งรู้ว่าไม่ถูก เก็บไว้ตรงนี้ตามจริงเพื่อให้ย้อนได้เหมือนเดิมเป๊ะ
--   - created_by เขียนเป็น NEW.assigned_to คือผู้รับ ไม่ใช่ผู้ลงมือ
--   - has_changes ใช้ <> จึงตกหล่นทุกครั้งที่ค่าฝั่งใดฝั่งหนึ่งเป็น NULL

DROP TRIGGER IF EXISTS customer_after_update;

DELIMITER $$
CREATE TRIGGER customer_after_update AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
    DECLARE has_changes BOOLEAN DEFAULT FALSE;
    DECLARE changed_fields_json JSON;

    SET has_changes = (
        OLD.bucket_type <> NEW.bucket_type OR
        OLD.lifecycle_status <> NEW.lifecycle_status OR
        OLD.assigned_to <> NEW.assigned_to
    );

    IF has_changes THEN
        INSERT INTO customer_logs (
            customer_id, bucket_type, lifecycle_status, assigned_to,
            action_type, old_values, new_values, changed_fields, created_by
        ) VALUES (
            NEW.customer_id, NEW.bucket_type, NEW.lifecycle_status, NEW.assigned_to,
            'update',
            JSON_OBJECT(
                'bucket_type', OLD.bucket_type,
                'lifecycle_status', OLD.lifecycle_status,
                'assigned_to', OLD.assigned_to
            ),
            JSON_OBJECT(
                'bucket_type', NEW.bucket_type,
                'lifecycle_status', NEW.lifecycle_status,
                'assigned_to', NEW.assigned_to
            ),
            JSON_ARRAY(
                CASE WHEN NOT (OLD.bucket_type <=> NEW.bucket_type) THEN 'bucket_type' END,
                CASE WHEN NOT (OLD.lifecycle_status <=> NEW.lifecycle_status) THEN 'lifecycle_status' END,
                CASE WHEN NOT (OLD.assigned_to <=> NEW.assigned_to) THEN 'assigned_to' END
            ),
            NEW.assigned_to
        );
    END IF;
END$$
DELIMITER ;
