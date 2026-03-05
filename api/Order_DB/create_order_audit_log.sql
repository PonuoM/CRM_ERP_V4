-- =====================================================
-- Order Audit Log: Track order_status, payment_status, total_amount changes
-- =====================================================

CREATE TABLE IF NOT EXISTS order_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL COMMENT 'orders.id',
  field_name VARCHAR(50) NOT NULL COMMENT 'ชื่อฟิลด์ที่เปลี่ยน',
  old_value VARCHAR(255) DEFAULT NULL,
  new_value VARCHAR(255) DEFAULT NULL,
  api_source VARCHAR(100) DEFAULT NULL COMMENT 'API ที่ทำการเปลี่ยนแปลง',
  changed_by INT DEFAULT NULL COMMENT 'user_id ที่ทำการเปลี่ยนแปลง',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_created_at (created_at),
  INDEX idx_field_name (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TRIGGER: Log order_status, payment_status, total_amount changes
-- Reuses same session variables as customer audit:
--   @audit_api_source = 'api_name' (set by PHP before UPDATE)
--   @audit_user_id    = user_id    (set by PHP before UPDATE)
-- =====================================================

DROP TRIGGER IF EXISTS trg_order_audit_update;

DELIMITER $$
CREATE TRIGGER trg_order_audit_update
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  -- Track order_status changes (NULL-safe comparison)
  IF NOT (OLD.order_status <=> NEW.order_status) THEN
    INSERT INTO order_audit_log (order_id, field_name, old_value, new_value, api_source, changed_by)
    VALUES (OLD.id, 'order_status',
      OLD.order_status, NEW.order_status,
      IFNULL(@audit_api_source, 'direct_db'), @audit_user_id);
  END IF;

  -- Track payment_status changes (NULL-safe comparison)
  IF NOT (OLD.payment_status <=> NEW.payment_status) THEN
    INSERT INTO order_audit_log (order_id, field_name, old_value, new_value, api_source, changed_by)
    VALUES (OLD.id, 'payment_status',
      OLD.payment_status, NEW.payment_status,
      IFNULL(@audit_api_source, 'direct_db'), @audit_user_id);
  END IF;

  -- Track total_amount changes (NULL-safe comparison)
  IF NOT (OLD.total_amount <=> NEW.total_amount) THEN
    INSERT INTO order_audit_log (order_id, field_name, old_value, new_value, api_source, changed_by)
    VALUES (OLD.id, 'total_amount',
      CAST(OLD.total_amount AS CHAR), CAST(NEW.total_amount AS CHAR),
      IFNULL(@audit_api_source, 'direct_db'), @audit_user_id);
  END IF;
END$$
DELIMITER ;
