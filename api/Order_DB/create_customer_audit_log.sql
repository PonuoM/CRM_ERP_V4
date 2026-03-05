-- =====================================================
-- Customer Audit Log: Track assigned_to + current_basket_key changes
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT 'customers.customer_id (PK)',
  field_name VARCHAR(50) NOT NULL COMMENT 'ชื่อฟิลด์ที่เปลี่ยน',
  old_value VARCHAR(255) DEFAULT NULL,
  new_value VARCHAR(255) DEFAULT NULL,
  api_source VARCHAR(100) DEFAULT NULL COMMENT 'API ที่ทำการเปลี่ยนแปลง เช่น basket_config/distribute',
  changed_by INT DEFAULT NULL COMMENT 'user_id ที่ทำการเปลี่ยนแปลง',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_id (customer_id),
  INDEX idx_created_at (created_at),
  INDEX idx_field_name (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TRIGGER: Log assigned_to + current_basket_key changes
-- Uses MySQL session variables:
--   @audit_api_source = 'api_name' (set by PHP before UPDATE)
--   @audit_user_id    = user_id    (set by PHP before UPDATE)
-- =====================================================

DROP TRIGGER IF EXISTS trg_customer_audit_update;

DELIMITER $$
CREATE TRIGGER trg_customer_audit_update
BEFORE UPDATE ON customers
FOR EACH ROW
BEGIN
  -- Track assigned_to changes (NULL-safe comparison)
  IF NOT (OLD.assigned_to <=> NEW.assigned_to) THEN
    INSERT INTO customer_audit_log (customer_id, field_name, old_value, new_value, api_source, changed_by)
    VALUES (OLD.customer_id, 'assigned_to',
      CAST(OLD.assigned_to AS CHAR), CAST(NEW.assigned_to AS CHAR),
      IFNULL(@audit_api_source, 'direct_db'), @audit_user_id);
  END IF;

  -- Track current_basket_key changes (NULL-safe comparison)
  IF NOT (OLD.current_basket_key <=> NEW.current_basket_key) THEN
    INSERT INTO customer_audit_log (customer_id, field_name, old_value, new_value, api_source, changed_by)
    VALUES (OLD.customer_id, 'current_basket_key',
      CAST(OLD.current_basket_key AS CHAR), CAST(NEW.current_basket_key AS CHAR),
      IFNULL(@audit_api_source, 'direct_db'), @audit_user_id);
  END IF;
END$$
DELIMITER ;
