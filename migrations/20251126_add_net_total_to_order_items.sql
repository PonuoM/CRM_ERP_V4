-- Migration: Add net_total column to order_items for per-line net amounts
-- Purpose: Persist the net total (price * quantity - discount) for each line item, accounting for freebies

-- Step 1: Add column if missing
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'net_total'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `order_items`
     ADD COLUMN `net_total` DECIMAL(12,2) NOT NULL DEFAULT 0
     COMMENT ''ยอดสุทธิของรายการ (price_per_unit * quantity - discount), freebies จะเป็น 0''
     AFTER `discount`',
    'SELECT ''Column net_total already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Backfill existing data
UPDATE order_items
SET net_total = CASE
    WHEN is_freebie = 1 THEN 0
    ELSE GREATEST((price_per_unit * quantity) - discount, 0)
END;

-- Step 3: Quick sanity check
SELECT 
    COUNT(*) AS total_items,
    SUM(CASE WHEN net_total IS NULL THEN 1 ELSE 0 END) AS items_missing_net_total
FROM order_items;
