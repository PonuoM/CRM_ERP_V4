-- Migration: Strengthen per-box COD tracking and history
-- Focus:
--  - Extend order_boxes with payment/status/audit columns
--  - Enforce per-box amount rules so COD sum never exceeds order total
--  - Record adjustments in order_box_collection_logs for auditability

SET @db_name = DATABASE();

-- Helper: add column if missing
DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @db_name
          AND TABLE_NAME = p_table
          AND COLUMN_NAME = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- 1) Extend order_boxes
CALL add_column_if_missing('order_boxes', 'payment_method', 'payment_method ENUM(''COD'',''Transfer'',''PayAfter'') NULL AFTER box_number');
CALL add_column_if_missing('order_boxes', 'collection_amount', 'collection_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER cod_amount');
CALL add_column_if_missing('order_boxes', 'collected_amount', 'collected_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER collection_amount');
CALL add_column_if_missing('order_boxes', 'waived_amount', 'waived_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER collected_amount');
CALL add_column_if_missing('order_boxes', 'status', 'status ENUM(''PENDING'',''PREPARING'',''SHIPPED'',''DELIVERED'',''RETURNED'',''CANCELLED'') NOT NULL DEFAULT ''PENDING'' AFTER payment_method');
CALL add_column_if_missing('order_boxes', 'created_at', 'created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER waived_amount');
CALL add_column_if_missing('order_boxes', 'updated_at', 'updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
CALL add_column_if_missing('order_boxes', 'shipped_at', 'shipped_at DATETIME NULL AFTER updated_at');
CALL add_column_if_missing('order_boxes', 'delivered_at', 'delivered_at DATETIME NULL AFTER shipped_at');
CALL add_column_if_missing('order_boxes', 'sub_order_id', 'sub_order_id VARCHAR(64) NOT NULL DEFAULT '''' AFTER order_id');

-- 2) Add/ensure indexes
SET @has_unique_box := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'order_boxes'
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'uniq_order_box_per_order'
);
SET @ddl := IF(@has_unique_box = 0,
    'ALTER TABLE order_boxes ADD CONSTRAINT uniq_order_box_per_order UNIQUE KEY (order_id, box_number)',
    'SELECT ''uniq_order_box_per_order exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_unique_sub_order := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'order_boxes'
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'uniq_sub_order_id'
);
SET @ddl := IF(@has_unique_sub_order = 0,
    'ALTER TABLE order_boxes ADD CONSTRAINT uniq_sub_order_id UNIQUE KEY (sub_order_id)',
    'SELECT ''uniq_sub_order_id exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_status := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'order_boxes'
      AND INDEX_NAME = 'idx_order_boxes_status'
);
SET @ddl := IF(@has_idx_status = 0,
    'CREATE INDEX idx_order_boxes_status ON order_boxes(status)',
    'SELECT ''idx_order_boxes_status exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Backfill existing rows
UPDATE order_boxes ob
LEFT JOIN orders o ON o.id = ob.order_id
SET
    ob.payment_method = COALESCE(NULLIF(ob.payment_method, ''), NULLIF(o.payment_method, ''), 'COD'),
    ob.collection_amount = CASE
        WHEN ob.collection_amount IS NULL OR ob.collection_amount = 0 THEN COALESCE(ob.cod_amount, 0)
        ELSE ob.collection_amount
    END,
    ob.status = COALESCE(ob.status, 'PENDING'),
    ob.sub_order_id = CASE
        WHEN ob.sub_order_id IS NULL OR ob.sub_order_id = '' THEN CONCAT(ob.order_id, '-', ob.box_number)
        ELSE ob.sub_order_id
    END;

-- 4) History table for audit trail
SET @has_logs_table := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'order_box_collection_logs'
);

SET @ddl := IF(@has_logs_table = 0,
    'CREATE TABLE order_box_collection_logs (
        id INT NOT NULL AUTO_INCREMENT,
        order_box_id INT NOT NULL,
        order_id VARCHAR(32) NOT NULL,
        sub_order_id VARCHAR(64) NOT NULL,
        box_number INT NOT NULL,
        change_type ENUM(''CREATE'',''AMOUNT_UPDATE'',''STATUS_UPDATE'',''PAYMENT_UPDATE'',''WAIVE_UPDATE'',''COLLECT_UPDATE'') NOT NULL,
        old_collection_amount DECIMAL(12,2) NULL,
        new_collection_amount DECIMAL(12,2) NULL,
        old_collected_amount DECIMAL(12,2) NULL,
        new_collected_amount DECIMAL(12,2) NULL,
        old_waived_amount DECIMAL(12,2) NULL,
        new_waived_amount DECIMAL(12,2) NULL,
        old_payment_method ENUM(''COD'',''Transfer'',''PayAfter'') NULL,
        new_payment_method ENUM(''COD'',''Transfer'',''PayAfter'') NULL,
        old_status ENUM(''PENDING'',''PREPARING'',''SHIPPED'',''DELIVERED'',''RETURNED'',''CANCELLED'') NULL,
        new_status ENUM(''PENDING'',''PREPARING'',''SHIPPED'',''DELIVERED'',''RETURNED'',''CANCELLED'') NULL,
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_ob_logs_box (order_box_id),
        KEY idx_ob_logs_order (order_id),
        KEY idx_ob_logs_sub_order (sub_order_id),
        KEY idx_ob_logs_change_type (change_type),
        CONSTRAINT fk_ob_logs_box FOREIGN KEY (order_box_id) REFERENCES order_boxes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;',
    'SELECT ''order_box_collection_logs exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5) Triggers: enforce totals and log changes
DROP TRIGGER IF EXISTS trg_order_boxes_bi_enforce;
DELIMITER $$
CREATE TRIGGER trg_order_boxes_bi_enforce
BEFORE INSERT ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment ENUM('COD','Transfer','PayAfter');
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;

    SELECT NULLIF(payment_method, ''), COALESCE(cod_amount, total_amount, 0)
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    SET NEW.payment_method = COALESCE(NULLIF(NEW.payment_method, ''), v_order_payment, 'COD');
    SET NEW.status = COALESCE(NEW.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, COALESCE(NEW.cod_amount, 0));
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, 0);

    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    SELECT COALESCE(SUM(collection_amount), 0) INTO v_sum FROM order_boxes WHERE order_id = NEW.order_id;
    SET v_sum = v_sum + NEW.collection_amount;

    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
    ELSE
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_order_boxes_bu_enforce;
DELIMITER $$
CREATE TRIGGER trg_order_boxes_bu_enforce
BEFORE UPDATE ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment ENUM('COD','Transfer','PayAfter');
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;
    DECLARE v_effective_payment ENUM('COD','Transfer','PayAfter');

    SELECT NULLIF(payment_method, ''), COALESCE(cod_amount, total_amount, 0)
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    SET v_effective_payment = COALESCE(NULLIF(NEW.payment_method, ''), NULLIF(OLD.payment_method, ''), v_order_payment, 'COD');
    SET NEW.payment_method = v_effective_payment;
    SET NEW.status = COALESCE(NEW.status, OLD.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, OLD.collection_amount, 0);
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, OLD.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, OLD.waived_amount, 0);

    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    IF NEW.collection_amount <> OLD.collection_amount AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change collection_amount after shipping';
    END IF;
    IF NEW.payment_method <> OLD.payment_method AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change payment_method after shipping';
    END IF;

    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id AND id <> OLD.id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    SELECT COALESCE(SUM(collection_amount), 0)
    INTO v_sum
    FROM order_boxes
    WHERE order_id = NEW.order_id
      AND id <> OLD.id;
    SET v_sum = v_sum + NEW.collection_amount;

    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
    ELSE
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_order_boxes_ai_log;
DELIMITER $$
CREATE TRIGGER trg_order_boxes_ai_log
AFTER INSERT ON order_boxes
FOR EACH ROW
BEGIN
    INSERT INTO order_box_collection_logs (
        order_box_id, order_id, sub_order_id, box_number, change_type,
        old_collection_amount, new_collection_amount,
        old_collected_amount, new_collected_amount,
        old_waived_amount, new_waived_amount,
        old_payment_method, new_payment_method,
        old_status, new_status,
        notes
    ) VALUES (
        NEW.id, NEW.order_id, NEW.sub_order_id, NEW.box_number, 'CREATE',
        NULL, NEW.collection_amount,
        NULL, NEW.collected_amount,
        NULL, NEW.waived_amount,
        NULL, NEW.payment_method,
        NULL, NEW.status,
        'Created order box'
    );
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS trg_order_boxes_au_log;
DELIMITER $$
CREATE TRIGGER trg_order_boxes_au_log
AFTER UPDATE ON order_boxes
FOR EACH ROW
BEGIN
    IF NEW.collection_amount <> OLD.collection_amount
        OR NEW.collected_amount <> OLD.collected_amount
        OR NEW.waived_amount <> OLD.waived_amount
        OR NEW.payment_method <> OLD.payment_method
        OR NEW.status <> OLD.status THEN

        INSERT INTO order_box_collection_logs (
            order_box_id, order_id, sub_order_id, box_number, change_type,
            old_collection_amount, new_collection_amount,
            old_collected_amount, new_collected_amount,
            old_waived_amount, new_waived_amount,
            old_payment_method, new_payment_method,
            old_status, new_status,
            notes
        ) VALUES (
            NEW.id, NEW.order_id, NEW.sub_order_id, NEW.box_number,
            CASE
                WHEN NEW.collection_amount <> OLD.collection_amount THEN 'AMOUNT_UPDATE'
                WHEN NEW.payment_method <> OLD.payment_method THEN 'PAYMENT_UPDATE'
                WHEN NEW.status <> OLD.status THEN 'STATUS_UPDATE'
                WHEN NEW.waived_amount <> OLD.waived_amount THEN 'WAIVE_UPDATE'
                WHEN NEW.collected_amount <> OLD.collected_amount THEN 'COLLECT_UPDATE'
                ELSE 'STATUS_UPDATE'
            END,
            OLD.collection_amount, NEW.collection_amount,
            OLD.collected_amount, NEW.collected_amount,
            OLD.waived_amount, NEW.waived_amount,
            OLD.payment_method, NEW.payment_method,
            OLD.status, NEW.status,
            'Order box updated'
        );
    END IF;
END$$
DELIMITER ;

-- Cleanup helper procedure
DROP PROCEDURE IF EXISTS add_column_if_missing;
