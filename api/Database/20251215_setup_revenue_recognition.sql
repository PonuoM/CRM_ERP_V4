-- 1. Create the Audit Log Table
CREATE TABLE IF NOT EXISTS order_status_logs (
    id INT NOT NULL AUTO_INCREMENT,
    order_id VARCHAR(32) NOT NULL,
    previous_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NULL,
    previous_tracking VARCHAR(100) NULL,
    new_tracking VARCHAR(100) NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trigger_type VARCHAR(20) NOT NULL COMMENT 'StatusChange, TrackingUpdate, Manual',
    PRIMARY KEY (id),
    KEY idx_order_log_order_id (order_id),
    KEY idx_order_log_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Trigger for Order Status Changes (on orders table)
-- Drop existing trigger if exists to ensure clean update
DROP TRIGGER IF EXISTS trg_order_status_update;

DELIMITER //
CREATE TRIGGER trg_order_status_update
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    -- Detect Status Change
    IF NOT (NEW.order_status <=> OLD.order_status) THEN
        INSERT INTO order_status_logs (order_id, previous_status, new_status, trigger_type, changed_at)
        VALUES (NEW.id, OLD.order_status, NEW.order_status, 'StatusChange', NOW());
    END IF;
END //
DELIMITER ;

-- 3. Trigger for New Tracking Numbers (on order_tracking_numbers table)
-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_tracking_insert;

DELIMITER //
CREATE TRIGGER trg_tracking_insert
AFTER INSERT ON order_tracking_numbers
FOR EACH ROW
BEGIN
    INSERT INTO order_status_logs (order_id, new_tracking, trigger_type, changed_at)
    VALUES (NEW.parent_order_id, NEW.tracking_number, 'TrackingUpdate', NOW());
END //
DELIMITER ;

-- 4. Trigger for Updated Tracking Numbers (if tracking is edited)
-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_tracking_update;

DELIMITER //
CREATE TRIGGER trg_tracking_update
AFTER UPDATE ON order_tracking_numbers
FOR EACH ROW
BEGIN
    IF NOT (NEW.tracking_number <=> OLD.tracking_number) THEN
        INSERT INTO order_status_logs (order_id, previous_tracking, new_tracking, trigger_type, changed_at)
        VALUES (NEW.parent_order_id, OLD.tracking_number, NEW.tracking_number, 'TrackingUpdate', NOW());
    END IF;
END //
DELIMITER ;
