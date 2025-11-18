-- Migration: 20251118_add_parent_order_id_to_order_items.sql
-- Description: Allow order_items to store per-box order IDs without duplicating rows in orders

-- Add parent_order_id column if it does not exist
SET @parent_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_items'
    AND column_name = 'parent_order_id'
);

SET @sql = IF(
  @parent_exists = 0,
  'ALTER TABLE `order_items` ADD COLUMN `parent_order_id` VARCHAR(32) NULL AFTER `order_id`',
  'SELECT "Skipping add column parent_order_id - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill parent_order_id values (strip trailing -number if present)
UPDATE order_items
SET parent_order_id = CASE
  WHEN parent_order_id IS NOT NULL AND parent_order_id <> '' THEN parent_order_id
  WHEN order_id REGEXP '-[0-9]+$' THEN
    SUBSTRING(order_id, 1, CHAR_LENGTH(order_id) - CHAR_LENGTH(SUBSTRING_INDEX(order_id, '-', -1)) - 1)
  ELSE order_id
END
WHERE parent_order_id IS NULL OR parent_order_id = '';

-- Ensure column is NOT NULL
SET @sql = 'ALTER TABLE `order_items` MODIFY `parent_order_id` VARCHAR(32) NOT NULL';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop legacy foreign key if it exists (order_id -> orders)
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'order_items'
    AND constraint_name = 'fk_order_items_order'
);

SET @sql = IF(
  @fk_exists > 0,
  'ALTER TABLE `order_items` DROP FOREIGN KEY `fk_order_items_order`',
  'SELECT "Skipping drop FK fk_order_items_order - does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure historical rows without suffix adopt box-specific IDs (based on box_number)
UPDATE order_items
SET order_id = CONCAT(
  parent_order_id,
  '-',
  GREATEST(1, IFNULL(box_number, 1))
)
WHERE order_id NOT REGEXP '-[0-9]+$';

-- Fallback: if derived parent_order_id has no matching order, fall back to existing order_id (when it exists)
UPDATE order_items oi
LEFT JOIN orders parent_orders ON parent_orders.id = oi.parent_order_id
LEFT JOIN orders order_rows ON order_rows.id = oi.order_id
SET oi.parent_order_id = oi.order_id
WHERE parent_orders.id IS NULL AND order_rows.id IS NOT NULL;

-- Add index for parent_order_id if needed
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'order_items'
    AND index_name = 'idx_order_items_parent_order'
);

SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE `order_items` ADD INDEX `idx_order_items_parent_order` (`parent_order_id`)',
  'SELECT "Skipping add index idx_order_items_parent_order - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add new foreign key linking parent_order_id -> orders.id if missing
SET @fk_parent_exists = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'order_items'
    AND constraint_name = 'fk_order_items_parent_order'
);

SET @sql = IF(
  @fk_parent_exists = 0,
  'ALTER TABLE `order_items` ADD CONSTRAINT `fk_order_items_parent_order` FOREIGN KEY (`parent_order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE',
  'SELECT "Skipping add FK fk_order_items_parent_order - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 20251118_add_parent_order_id_to_order_items.sql completed' AS message;
