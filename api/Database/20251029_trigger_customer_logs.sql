DELIMITER $$

-- Trigger สำหรับ INSERT (สร้างลูกค้าใหม่)
CREATE TRIGGER customer_after_insert
AFTER INSERT ON customers
FOR EACH ROW
BEGIN
    INSERT INTO customer_logs (
        customer_id,
        bucket_type,
        lifecycle_status,
        assigned_to,
        action_type,
        new_values,
        changed_fields,
        created_by
    ) VALUES (
        NEW.customer_id,
        NEW.bucket_type,
        NEW.lifecycle_status,
        NEW.assigned_to,
        'create',
        JSON_OBJECT(
            'bucket_type', NEW.bucket_type,
            'lifecycle_status', NEW.lifecycle_status,
            'assigned_to', NEW.assigned_to,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email
        ),
        JSON_ARRAY('bucket_type', 'lifecycle_status', 'assigned_to'),
        NEW.assigned_to
    );
END$$

-- Trigger สำหรับ UPDATE (อัพเดทข้อมูลลูกค้า)
CREATE TRIGGER customer_after_update
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
    DECLARE has_changes BOOLEAN DEFAULT FALSE;
    DECLARE changed_fields_json JSON;

    -- เช็คว่ามีการเปลี่ยนแปลงฟิลด์ที่สนใจหรือไม่
    SET has_changes = (
        OLD.bucket_type <> NEW.bucket_type OR
        OLD.lifecycle_status <> NEW.lifecycle_status OR
        OLD.assigned_to <> NEW.assigned_to
    );

    IF has_changes THEN
        INSERT INTO customer_logs (
            customer_id,
            bucket_type,
            lifecycle_status,
            assigned_to,
            action_type,
            old_values,
            new_values,
            changed_fields,
            created_by
        ) VALUES (
            NEW.customer_id,
            NEW.bucket_type,
            NEW.lifecycle_status,
            NEW.assigned_to,
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
                CASE WHEN OLD.bucket_type <> NEW.bucket_type THEN 'bucket_type' END,
                CASE WHEN OLD.lifecycle_status <> NEW.lifecycle_status THEN 'lifecycle_status' END,
                CASE WHEN OLD.assigned_to <> NEW.assigned_to THEN 'assigned_to' END
            ),
            NEW.assigned_to
        );
    END IF;
END$$

-- Trigger สำหรับ DELETE (ลบลูกค้า)
CREATE TRIGGER customer_before_delete
BEFORE DELETE ON customers
FOR EACH ROW
BEGIN
    INSERT INTO customer_logs (
        customer_id,
        bucket_type,
        lifecycle_status,
        assigned_to,
        action_type,
        old_values,
        new_values,
        changed_fields,
        created_by
    ) VALUES (
        OLD.customer_id,
        OLD.bucket_type,
        OLD.lifecycle_status,
        OLD.assigned_to,
        'delete',
        JSON_OBJECT(
            'bucket_type', OLD.bucket_type,
            'lifecycle_status', OLD.lifecycle_status,
            'assigned_to', OLD.assigned_to,
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'email', OLD.email
        ),
        NULL,
        JSON_ARRAY('bucket_type', 'lifecycle_status', 'assigned_to'),
        OLD.assigned_to
    );
END$$

DELIMITER ;
