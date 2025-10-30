-- Create table for customer blocks and add flag to customers
CREATE TABLE IF NOT EXISTS customer_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  blocked_by INT NOT NULL,
  blocked_at DATETIME NOT NULL,
  unblocked_by INT NULL,
  unblocked_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add is_blocked flag to customers if missing (MySQL-compatible)
SET @db := DATABASE();
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_blocked'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE customers ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Optional: add helpful indexes for filtering
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_blocked'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE customers ADD INDEX idx_customers_blocked (is_blocked)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_waiting'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE customers ADD INDEX idx_customers_waiting (is_in_waiting_basket)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_assigned_to'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE customers ADD INDEX idx_customers_assigned_to (assigned_to)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Normalize existing overlapped states: waiting basket should not have owner
UPDATE customers SET assigned_to = NULL
WHERE is_in_waiting_basket = 1 AND assigned_to IS NOT NULL;

-- Blocked customers must not be assigned nor in waiting
UPDATE customers SET assigned_to = NULL, is_in_waiting_basket = 0
WHERE is_blocked = 1;

-- Create/replace a view for quick bucket inspection
DROP VIEW IF EXISTS v_customer_buckets;
CREATE VIEW v_customer_buckets AS
SELECT c.*,
  CASE
    WHEN COALESCE(c.is_blocked,0)=1 THEN 'blocked'
    WHEN COALESCE(c.is_in_waiting_basket,0)=1 THEN 'waiting'
    WHEN c.assigned_to IS NULL THEN 'ready'
    ELSE 'assigned'
  END AS bucket
FROM customers c;

-- Add is_in_waiting_basket if missing
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_in_waiting_basket'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE customers ADD COLUMN is_in_waiting_basket TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add bucket_type generated column for direct access to the bucket logic
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'bucket_type'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE customers ADD COLUMN bucket_type VARCHAR(16) GENERATED ALWAYS AS (CASE WHEN COALESCE(is_blocked,0)=1 THEN ''blocked'' WHEN COALESCE(is_in_waiting_basket,0)=1 THEN ''waiting'' WHEN assigned_to IS NULL THEN ''ready'' ELSE ''assigned'' END) STORED',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add waiting_basket_start_date if missing
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'waiting_basket_start_date'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE customers ADD COLUMN waiting_basket_start_date DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
