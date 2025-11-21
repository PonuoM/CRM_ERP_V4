-- Migration: 20251118_update_order_tracking_numbers.sql
-- Description: Support per-box tracking numbers by separating parent order reference

-- Add parent_order_id column if missing
SET @parent_col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_tracking_numbers'
    AND column_name = 'parent_order_id'
);

SET @sql = IF(
  @parent_col_exists = 0,
  'ALTER TABLE `order_tracking_numbers` ADD COLUMN `parent_order_id` VARCHAR(32) NULL AFTER `order_id`',
  'SELECT "Skipping add column parent_order_id - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add box_number column if missing
SET @box_col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_tracking_numbers'
    AND column_name = 'box_number'
);

SET @sql = IF(
  @box_col_exists = 0,
  'ALTER TABLE `order_tracking_numbers` ADD COLUMN `box_number` INT NULL AFTER `parent_order_id`',
  'SELECT "Skipping add column box_number - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill parent_order_id with existing order_id when NULL
UPDATE order_tracking_numbers
SET parent_order_id = order_id
WHERE parent_order_id IS NULL OR parent_order_id = '';

-- Ensure parent_order_id is NOT NULL
SET @sql = 'ALTER TABLE `order_tracking_numbers` MODIFY `parent_order_id` VARCHAR(32) NOT NULL';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop legacy foreign key (order_id -> orders.id) if present
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'order_tracking_numbers'
    AND constraint_name = 'fk_order_tracking_order'
);

SET @sql = IF(
  @fk_exists > 0,
  'ALTER TABLE `order_tracking_numbers` DROP FOREIGN KEY `fk_order_tracking_order`',
  'SELECT "Skipping drop FK fk_order_tracking_order - does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for parent_order_id if missing
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'order_tracking_numbers'
    AND index_name = 'idx_order_tracking_parent_order'
);

SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE `order_tracking_numbers` ADD INDEX `idx_order_tracking_parent_order` (`parent_order_id`)',
  'SELECT "Skipping add index idx_order_tracking_parent_order - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add new foreign key referencing parent_order_id -> orders(id) if missing
SET @fk_parent_exists = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'order_tracking_numbers'
    AND constraint_name = 'fk_order_tracking_parent_order'
);

SET @sql = IF(
  @fk_parent_exists = 0,
  'ALTER TABLE `order_tracking_numbers` ADD CONSTRAINT `fk_order_tracking_parent_order` FOREIGN KEY (`parent_order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE',
  'SELECT "Skipping add FK fk_order_tracking_parent_order - already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 20251118_update_order_tracking_numbers.sql completed' AS message;
